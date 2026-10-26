"""Vehicle listing validator API."""


def main() -> None:
    import uvicorn

    uvicorn.run(
        "listing_validator_api.main:app",
        host="127.0.0.1",
        port=43124,
        reload=True,
    )
