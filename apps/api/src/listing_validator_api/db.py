from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from listing_validator_api.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_on_connect(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _ensure_sqlite_columns(connection) -> None:  # noqa: ANN001
    """Add columns introduced after the first scaffold without a full migration tool."""
    rows = connection.exec_driver_sql("PRAGMA table_info(listings)").fetchall()
    existing = {row[1] for row in rows}
    if "user_id" not in existing:
        connection.exec_driver_sql("ALTER TABLE listings ADD COLUMN user_id VARCHAR(64)")
        connection.exec_driver_sql(
            "CREATE INDEX IF NOT EXISTS ix_listings_user_id ON listings (user_id)"
        )


async def init_db() -> None:
    from listing_validator_api import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.database_url.startswith("sqlite"):
            await conn.run_sync(_ensure_sqlite_columns)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
