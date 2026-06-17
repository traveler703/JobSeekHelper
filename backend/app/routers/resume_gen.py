from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.constants import JOB_ROLE_NAMES
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import ResumeGenRequest
from app.services.pdf_gen import generate_resume_pdf, save_pdf_bytes
from app.routers.profile import load_profile_dict

router = APIRouter(prefix="/resume", tags=["resume-gen"])


@router.post("/generate-pdf")
def generate_pdf(
    body: ResumeGenRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if body.job_role not in JOB_ROLE_NAMES:
        raise HTTPException(400, "未知岗位类型")
    profile = load_profile_dict(db, current.id)
    if not profile:
        raise HTTPException(400, "请先上传或填写简历档案")

    name = JOB_ROLE_NAMES[body.job_role]
    company = (body.target_company or "").strip()
    position = body.target_position.strip()
    if not position:
        raise HTTPException(400, "请填写投递的岗位")
    try:
        pdf = generate_resume_pdf(
            profile,
            body.job_role,
            company,
            position,
            name,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e
    except Exception as e:
        raise HTTPException(502, f"生成失败: {e}") from e

    fname = f"resume_{body.job_role}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    save_pdf_bytes(pdf, current.id, fname)

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{fname}"',
        },
    )
