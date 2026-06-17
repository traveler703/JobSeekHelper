from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field, field_serializer


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}


class ResumeGenRequest(BaseModel):
    job_role: str = Field(
        default="custom",
        description="岗位标识，如 backend、frontend；简历页可传 custom",
    )
    target_company: str = Field(
        default="",
        description="要求职的公司名称，可为空",
    )
    target_position: str = Field(..., description="投递的岗位名称，如 Java 后端开发")


class KnowledgeOut(BaseModel):
    id: int
    filename: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def _k_created(self, v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.strftime("%Y-%m-%dT%H:%M:%SZ")


class InterviewSessionOut(BaseModel):
    id: int
    job_role: str
    target_company: str = ""
    target_position: str = ""
    status: str
    started_at: datetime
    ended_at: datetime | None
    ended_reason: str | None

    model_config = {"from_attributes": True}

    @field_serializer("started_at", "ended_at")
    def _iso_utc_z(self, v: datetime | None) -> str | None:
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.strftime("%Y-%m-%dT%H:%M:%SZ")


class InterviewSessionDetailOut(InterviewSessionOut):
    messages: list[dict] = Field(default_factory=list)
    evaluation: dict | None = None
