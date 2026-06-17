from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


def _db_url() -> str:
    db_path: Path = settings.storage_path() / "jobseek.db"
    return f"sqlite:///{db_path.as_posix()}"


engine = create_engine(
    _db_url(),
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_interview_session_columns() -> None:
    try:
        insp = inspect(engine)
        if "interview_sessions" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("interview_sessions")}
        with engine.begin() as conn:
            if "target_company" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE interview_sessions ADD COLUMN target_company VARCHAR(255) NOT NULL DEFAULT ''"
                    )
                )
            if "target_position" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE interview_sessions ADD COLUMN target_position VARCHAR(255) NOT NULL DEFAULT ''"
                    )
                )
    except Exception:
        pass


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_interview_session_columns()
