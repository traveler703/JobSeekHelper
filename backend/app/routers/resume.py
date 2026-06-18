import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.services import llm
from app.services.parser import extract_text_from_upload
from app.services.profile_merge import merge_profile, normalize_profile_structure
from app.routers.profile import _get_profile_row

router = APIRouter(prefix="/resume", tags=["resume"])

ALLOWED = {".pdf", ".docx", ".pptx", ".txt"}


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    name = file.filename or "upload"
    suf = Path(name).suffix.lower()
    if suf not in ALLOWED:
        raise HTTPException(400, f"不支持的格式: {suf}，仅支持 pdf/docx/pptx/txt")

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "文件过大（最大 15MB）")

    try:
        raw = extract_text_from_upload(content, name)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    if not raw.strip():
        raise HTTPException(400, "未能从文件中提取文本")

    try:
        parsed = llm.resume_parse_prompt(raw)
    except Exception as e:
        raise HTTPException(502, f"解析失败: {e}") from e

    row = _get_profile_row(db, current.id)
    try:
        existing = json.loads(row.profile_json or "{}")
    except json.JSONDecodeError:
        existing = {}
    normalized = normalize_profile_structure(parsed if isinstance(parsed, dict) else {})
    merged = merge_profile(existing, normalized)
    row.profile_json = json.dumps(merged, ensure_ascii=False)
    db.commit()

    uid = str(uuid.uuid4())[:8]
    save_dir = settings.storage_path() / "uploads" / str(current.id)
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{uid}_{Path(name).name}"
    save_path.write_bytes(content)

    return {"ok": True, "parsed_preview": merged, "saved_as": save_path.name}
