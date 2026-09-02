import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User, GitHubInstallation, utc_now
from backend.auth_service.rbac import get_current_user
from backend.build_engine.github_client import github_client

router = APIRouter(prefix="/api/v1/github", tags=["GitHub Integration"])

class RepositoryResponse(BaseModel):
    id: str
    full_name: str
    name: str
    owner: str
    default_branch: str
    is_private: bool
    language: Optional[str] = None
    updated_at: str

class ConnectGitHubRequest(BaseModel):
    github_username: str
    installation_id: str
    access_token: str

@router.get("/repos", response_model=List[RepositoryResponse])
async def get_github_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List accessible GitHub repositories for the authenticated user."""
    repos = await github_client.list_user_repos(current_user.id)
    return [
        RepositoryResponse(
            id=r["id"],
            full_name=r["full_name"],
            name=r["name"],
            owner=r["owner"],
            default_branch=r["default_branch"],
            is_private=r["is_private"],
            language=r.get("language"),
            updated_at=r["updated_at"]
        )
        for r in repos
    ]

@router.post("/connect", status_code=status.HTTP_201_CREATED)
async def connect_github_app(
    payload: ConnectGitHubRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Connect a GitHub App installation to the user's account."""
    stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        existing.github_username = payload.github_username
        existing.installation_id = payload.installation_id
        existing.access_token = payload.access_token
    else:
        inst = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            github_username=payload.github_username,
            installation_id=payload.installation_id,
            access_token=payload.access_token,
            avatar_url=f"https://github.com/{payload.github_username}.png"
        )
        db.add(inst)

    await db.commit()
    return {"status": "success", "message": f"Successfully connected GitHub account @{payload.github_username}"}
