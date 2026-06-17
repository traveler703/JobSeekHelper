from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
_ENV = _ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    storage_dir: str = "storage"
    chroma_dir: str = "storage/chroma"
    chunk_size: int = 800
    chunk_overlap: int = 100
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    llm_model: str = "deepseek-chat"
    secret_key: str = "jobseek-dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    stt_model: str = "small"

    def storage_path(self) -> Path:
        p = _ROOT / self.storage_dir
        p.mkdir(parents=True, exist_ok=True)
        return p

    def chroma_path(self) -> Path:
        p = _ROOT / self.chroma_dir
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
