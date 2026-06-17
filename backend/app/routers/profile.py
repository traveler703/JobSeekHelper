import json
from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import ResumeProfile, User

router = APIRouter(prefix="/profile", tags=["profile"])


def _get_profile_row(db: Session, user_id: int) -> ResumeProfile:
    row = db.query(ResumeProfile).filter(ResumeProfile.user_id == user_id).first()
    if row is None:
        row = ResumeProfile(user_id=user_id, profile_json="{}")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("")
def get_profile(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    row = _get_profile_row(db, current.id)
    try:
        data = json.loads(row.profile_json or "{}")
    except json.JSONDecodeError:
        data = {}
    return {"profile": data}


@router.put("")
def put_profile(
    body: dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    row = _get_profile_row(db, current.id)
    try:
        existing = json.loads(row.profile_json or "{}")
    except json.JSONDecodeError:
        existing = {}
    merged: dict[str, Any] = {**existing, **body}
    row.profile_json = json.dumps(merged, ensure_ascii=False)
    db.commit()
    return {"ok": True}


def load_profile_dict(db: Session, user_id: int) -> dict[str, Any]:
    row = _get_profile_row(db, user_id)
    try:
        return json.loads(row.profile_json or "{}")
    except json.JSONDecodeError:
        return {}
