from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from listing_validator_api.config import Settings, get_settings


class ObjectStorage(ABC):
    @abstractmethod
    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        """Store bytes and return a storage path / public URL reference."""


class LocalStorage(ObjectStorage):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        folder = self.root / listing_id
        folder.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
        path = folder / safe_name
        path.write_bytes(data)
        return str(path)


class SupabaseStorage(ObjectStorage):
    def __init__(self, settings: Settings) -> None:
        from supabase import create_client

        self.bucket = settings.supabase_storage_bucket
        self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
        key = f"{listing_id}/{safe_name}"
        self.client.storage.from_(self.bucket).upload(
            path=key,
            file=data,
            file_options={"content-type": content_type, "upsert": "false"},
        )
        public = self.client.storage.from_(self.bucket).get_public_url(key)
        return public


def get_storage() -> ObjectStorage:
    settings = get_settings()
    if settings.supabase_configured:
        return SupabaseStorage(settings)
    return LocalStorage(settings.upload_path)
