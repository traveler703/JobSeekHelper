"""清空本地业务数据：简历档案、上传文件、知识库与向量、面试记录。不删除用户账号。

用法：在 ``backend`` 目录执行 ``python scripts/clear_local_history.py``。
"""
from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import shutil

from sqlalchemy import delete, select

from app.config import settings
from app.database import SessionLocal, init_db
from app.models import InterviewSession, KnowledgeDocument, ResumeProfile


def _rm_contents(path: Path) -> None:
    if not path.exists():
        return
    for child in path.iterdir():
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            try:
                child.unlink()
            except OSError:
                pass


def main() -> None:
    init_db()
    with SessionLocal() as db:
        db.execute(delete(InterviewSession))
        db.execute(delete(KnowledgeDocument))
        for row in db.scalars(select(ResumeProfile)):
            row.profile_json = "{}"
        db.commit()

    root = settings.storage_path()
    for name in ("resumes", "uploads", "knowledge"):
        _rm_contents(root / name)
        (root / name).mkdir(parents=True, exist_ok=True)

    chroma = settings.chroma_path()
    if chroma.exists():
        shutil.rmtree(chroma, ignore_errors=True)
    chroma.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    main()
