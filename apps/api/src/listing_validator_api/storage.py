from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from listing_validator_api.config import Settings, get_settings


class ObjectStorage(ABC):
    @abstractmethod
    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        """Store bytes and return a storage path / public URL reference."""

    @abstractmethod
    async def read(self, path: str) -> bytes:
        """Load bytes previously returned by upload."""


class LocalStorage(ObjectStorage):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        folder = self.root / listing_id
        folder.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
        path = folder / safe_name
        await asyncio.to_thread(path.write_bytes, data)
        return str(path.resolve())

    async def read(self, path: str) -> bytes:
        candidate = Path(path)
        if not candidate.is_absolute():
            candidate = self.root / candidate
        file_path = candidate.resolve()
        root = self.root.resolve()
        if root != file_path and root not in file_path.parents:
            raise PermissionError("Image path is outside the upload directory")
        return await asyncio.to_thread(file_path.read_bytes)


class SupabaseStorage(ObjectStorage):
    def __init__(self, settings: Settings) -> None:
        from supabase import create_client

        self.bucket = settings.supabase_storage_bucket
        self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    async def upload(self, listing_id: str, filename: str, data: bytes, content_type: str) -> str:
        safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
        key = f"{listing_id}/{safe_name}"

        def _upload() -> str:
            self.client.storage.from_(self.bucket).upload(
                path=key,
                file=data,
                file_options={"content-type": content_type, "upsert": "false"},
            )
            return self.client.storage.from_(self.bucket).get_public_url(key)

        return await asyncio.to_thread(_upload)

    async def read(self, path: str) -> bytes:
        key = self._key_from_path(path)

        def _download() -> bytes:
            data = self.client.storage.from_(self.bucket).download(key)
            if isinstance(data, bytes):
                return data
            return bytes(data)

        return await asyncio.to_thread(_download)

    def _key_from_path(self, path: str) -> str:
        for marker in (
            f"/object/public/{self.bucket}/",
            f"/object/authenticated/{self.bucket}/",
            f"/object/sign/{self.bucket}/",
        ):
            if marker in path:
                return path.split(marker, 1)[1].split("?", 1)[0]
        return path.lstrip("/")


def get_storage() -> ObjectStorage:
    settings = get_settings()
    if settings.supabase_configured:
        return SupabaseStorage(settings)
    return LocalStorage(settings.upload_path)
