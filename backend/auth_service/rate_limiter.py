from typing import Callable
from fastapi import Request, HTTPException, status
from backend.auth_service.redis_client import redis_service

def rate_limit(max_requests: int = 10, window_seconds: int = 60) -> Callable:
    """FastAPI dependency enforcing sliding-window rate limiting per IP / identity."""
    async def dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        endpoint = request.url.path
        identifier = f"{ip}:{endpoint}"

        is_limited = await redis_service.is_rate_limited(
            identifier=identifier,
            max_requests=max_requests,
            window_seconds=window_seconds
        )

        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds."
            )

    return dependency
