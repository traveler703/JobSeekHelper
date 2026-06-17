from fastapi import APIRouter

from app.constants import JOB_ROLES

router = APIRouter(tags=["meta"])


@router.get("/job-roles")
def job_roles():
    return {"roles": JOB_ROLES}
