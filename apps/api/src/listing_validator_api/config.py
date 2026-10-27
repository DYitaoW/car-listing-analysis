from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_files() -> tuple[str, ...]:
    """Load the repo-root env file the README tells people to create, then local overrides."""
    api_dir = Path(__file__).resolve().parents[2]
    repo_root = api_dir.parent.parent
    ordered = (repo_root / ".env", api_dir / ".env", Path.cwd() / ".env")
    seen: list[str] = []
    for path in ordered:
        if not path.is_file():
            continue
        resolved = str(path.resolve())
        if resolved not in seen:
            seen.append(resolved)
    return tuple(seen)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files() or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./data/listings.db"
    redis_url: str = "redis://127.0.0.1:6379/0"
    job_backend: str = "inprocess"  # inprocess | redis

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_storage_bucket: str = "listing-images"
    # When true (default) and Supabase Auth is configured, listing APIs require a signed-in user.
    auth_required: bool = True

    local_upload_dir: str = "./data/uploads"

    llm_provider: str = "stub"  # stub | gemini | ollama
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5vl:7b"

    cors_origins: str = "http://127.0.0.1:43123,http://localhost:43123,http://127.0.0.1:3000,http://localhost:3000"

    rate_limit_enabled: bool = True

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_url and (self.supabase_jwt_secret or self.supabase_anon_key))

    @property
    def require_auth(self) -> bool:
        return self.auth_configured and self.auth_required

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
