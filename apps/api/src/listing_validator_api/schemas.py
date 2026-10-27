from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pydantic.alias_generators import to_camel


ClaimVerdict = Literal["supported", "contradicted", "unclear"]
ListingStatus = Literal["pending", "processing", "completed", "failed"]
Severity = Literal["low", "medium", "high"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ClaimCheck(CamelModel):
    claim: str
    verdict: ClaimVerdict
    detail: str


class RiskFlag(CamelModel):
    code: str
    severity: Severity
    message: str


class VinDecoded(CamelModel):
    make: str | None = None
    model: str | None = None
    model_year: str | None = None
    body_class: str | None = None


class VinMatch(CamelModel):
    checked: bool
    matches_listing: bool | None = None
    decoded: VinDecoded | None = None


class RecallsInfo(CamelModel):
    checked: bool
    count: int = 0
    park_it: bool = False
    park_outside: bool = False


class AnalysisReport(CamelModel):
    risk_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    summary: str
    flags: list[RiskFlag]
    claim_checks: list[ClaimCheck]
    vin_match: VinMatch
    recalls: RecallsInfo
    image_findings: list[str] = Field(default_factory=list)
    history_checked: Literal[False] = False
    title_verified: Literal[False] = False
    disclaimer: str = (
        "This is an AI risk assessment, not a certified inspection or title verification. "
        "Vehicle history and title status were not checked."
    )


class ListingImageOut(CamelModel):
    id: str
    path: str
    content_type: str


class ListingCreate(CamelModel):
    title: str = Field(min_length=1, max_length=512)
    description: str = Field(min_length=1)
    price: float | None = None
    vin: str | None = Field(default=None, max_length=32)
    source_url: HttpUrl | None = None


class ListingOut(CamelModel):
    id: str
    user_id: str | None = None
    title: str
    price: float | None
    description: str
    vin: str | None
    source_url: str | None
    status: ListingStatus
    error: str | None
    images: list[ListingImageOut]
    report: AnalysisReport | None
    created_at: datetime
    updated_at: datetime


class ListingSummaryOut(CamelModel):
    id: str
    title: str
    price: float | None
    status: ListingStatus
    risk_score: int | None = None
    created_at: datetime
    updated_at: datetime


class MeOut(CamelModel):
    id: str
    email: str | None = None
    auth_required: bool


class HealthOut(CamelModel):
    status: str
    storage: Literal["supabase", "local"]
    llm_provider: str
    job_backend: str
    auth: Literal["required", "optional", "disabled"]
