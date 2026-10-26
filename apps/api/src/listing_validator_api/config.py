from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./data/listings.db"
    redis_url: str = "redis://127.0.0.1:6379/0"
    job_backend: str = "inprocess"  # inprocess | redis

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    supabase_storage_bucket: str = "listing-images"

    local_upload_dir: str = "./data/uploads"

    llm_provider: str = "stub"  # stub | gemini | ollama
    gemini_api_key: str = ""
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5vl:7b"

    cors_origins: str = "http://127.0.0.1:43123,http://localhost:43123"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def upload_path(self) -> Path:
        path = Path(self.local_upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    Path("data").mkdir(parents=True, exist_ok=True)
    return settings
