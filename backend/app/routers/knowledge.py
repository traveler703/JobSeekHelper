import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import KnowledgeDocument, KnowledgePoint, User
from app.schemas import KnowledgeOut
from app.services import llm
from app.services.parser import extract_text_from_upload
from app.services.rag import add_document, delete_document_chunks, load_ids_from_db

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

ALLOWED = {".pdf", ".docx", ".pptx", ".txt"}


def _normalize_point_rows(points: object, limit: int = 20) -> list[dict[str, str]]:
    if not isinstance(points, list):
        return []
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in points[:limit]:
        if not isinstance(item, dict):
            continue
        q = str(item.get("question") or "").strip()
        a = str(item.get("answer") or "").strip()
        if not q or not a or q in seen:
            continue
        seen.add(q)
        normalized.append(
            {
                "topic": str(item.get("topic") or "常见考点").strip()[:40],
                "question": q[:120],
                "answer": a[:500],
            }
        )
    return normalized


def _generate_points_for_text(filename: str, text: str) -> list[dict[str, str]]:
    context = text.strip()[:12000]
    if not context:
        return []
    system = (
        "你是技术面试知识库整理助手。请只基于用户上传资料，归纳可用于面试复习的常见考点。"
        "输出 JSON，不要 Markdown。键 points 是数组，每项包含 topic、question、answer。"
        "question 要像真实面试题，answer 用 80-160 字给出准确、可背诵的中文答案。"
        "优先选择 Java、JVM、并发、MySQL、Redis、网络、操作系统、数据结构等高频知识点。"
        "输出 12-20 项；不要编造资料中完全没有依据的专有细节。"
    )
    user = f"文档名：{filename}\n\n资料正文片段：\n{context}"
    raw = llm.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.35,
        response_format_json=True,
    )
    data = llm.parse_json_loose(raw)
    return _normalize_point_rows(data.get("points") if isinstance(data, dict) else [], limit=20)


def _save_points(
    db: Session,
    *,
    user_id: int,
    document_id: int,
    filename: str,
    points: list[dict[str, str]],
) -> None:
    if not points:
        return
    existing = {
        q
        for (q,) in db.query(KnowledgePoint.question)
        .filter(KnowledgePoint.user_id == user_id)
        .all()
    }
    for item in points:
        if item["question"] in existing:
            continue
        db.add(
            KnowledgePoint(
                user_id=user_id,
                document_id=document_id,
                topic=item["topic"],
                question=item["question"],
                answer=item["answer"],
                source_filename=filename,
            )
        )
        existing.add(item["question"])
    db.commit()


@router.get("", response_model=list[KnowledgeOut])
def list_docs(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.user_id == current.id)
        .order_by(KnowledgeDocument.id.desc())
        .all()
    )
    return [KnowledgeOut.model_validate(r) for r in rows]


@router.get("/common-points")
def common_points(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = (
        db.query(KnowledgePoint)
        .filter(KnowledgePoint.user_id == current.id)
        .order_by(func.random())
        .limit(8)
        .all()
    )
    return {
        "points": [
            {
                "topic": r.topic,
                "question": r.question,
                "answer": r.answer,
                "source_filename": r.source_filename,
            }
            for r in rows
        ]
    }


@router.post("/upload")
async def upload_knowledge(
    files: list[UploadFile] | None = File(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # 兼容旧版单文件字段 file 与新版多文件字段 files。
    upload_files = files or ([file] if file is not None else [])
    if len(upload_files) == 0:
        raise HTTPException(400, "请至少上传一个文件")

    uploaded: list[dict] = []
    point_errors: list[str] = []
    for up in upload_files:
        name = up.filename or "doc"
        suf = Path(name).suffix.lower()
        if suf not in ALLOWED:
            raise HTTPException(400, f"不支持的格式: {suf}")

        content = await up.read()
        if len(content) > 500 * 1024 * 1024:
            raise HTTPException(400, f"{name}: 单个文件不能超过 500MB")

        try:
            text = extract_text_from_upload(content, name)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e

        if not text.strip():
            raise HTTPException(400, f"{name}: 未能提取文本")

        ids = add_document(current.id, text, source=name)
        row = KnowledgeDocument(
            user_id=current.id,
            filename=name,
            chroma_ids=json.dumps(ids, ensure_ascii=False),
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        save_dir = settings.storage_path() / "knowledge" / str(current.id)
        save_dir.mkdir(parents=True, exist_ok=True)
        (save_dir / f"{row.id}_{Path(name).name}").write_bytes(content)

        point_count = 0
        try:
            points = _generate_points_for_text(name, text)
            _save_points(
                db,
                user_id=current.id,
                document_id=row.id,
                filename=name,
                points=points,
            )
            point_count = len(points)
        except Exception as e:
            point_errors.append(f"{name}: {e}")

        uploaded.append(
            {
                "id": row.id,
                "filename": name,
                "chunks": len(ids),
                "points": point_count,
            }
        )

    return {
        "ok": True,
        "count": len(uploaded),
        "documents": uploaded,
        "point_errors": point_errors,
    }


@router.delete("/{doc_id}")
def delete_doc(
    doc_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    row = db.get(KnowledgeDocument, doc_id)
    if row is None or row.user_id != current.id:
        raise HTTPException(404, "文档不存在")
    ids = load_ids_from_db(row.chroma_ids)
    delete_document_chunks(current.id, ids)
    db.delete(row)
    db.commit()
    return {"ok": True}
