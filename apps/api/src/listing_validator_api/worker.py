from listing_validator_api.jobs import run_analysis_job


async def analyze_listing(ctx, listing_id: str) -> None:  # noqa: ANN001
    await run_analysis_job(listing_id)


class WorkerSettings:
    functions = [analyze_listing]
    redis_settings = None  # set via REDIS_URL when using ARQ CLI
