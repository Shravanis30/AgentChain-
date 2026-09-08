import time
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

import logging

from backend.config import settings
from backend.db.session import get_db
from backend.db.models import User, GitHubInstallation, utc_now
from backend.auth_service.rbac import get_current_user
from backend.github.app_auth import github_app_auth
from backend.github.installation_client import installation_client, GitHubInstallationRevokedError

logger = logging.getLogger("agentchain.github")

router = APIRouter(prefix="/api/v1/github", tags=["GitHub Integration"])

# Per-user cache for repo listing (TTL 3 minutes)
_USER_REPOS_CACHE: Dict[str, Dict[str, Any]] = {}


class RepositoryResponse(BaseModel):
    id: str
    full_name: str
    name: str
    owner: str
    default_branch: str
    is_private: bool
    language: Optional[str] = None
    updated_at: str
    installation_id: Optional[str] = None


class GitHubInstallResponse(BaseModel):
    install_url: str
    state: str


class InstallationResponse(BaseModel):
    id: str
    installation_id: str
    account_login: str
    account_type: str
    avatar_url: Optional[str] = None
    created_at: str


class LinkInstallationRequest(BaseModel):
    installation_id: str


class ReposListResponse(BaseModel):
    connected: bool
    installations: List[InstallationResponse]
    repos: List[RepositoryResponse]


@router.get("/install", response_model=GitHubInstallResponse)
async def get_github_install_url(
    redirect_path: str = Query("/dashboard/settings/connected-accounts"),
    current_user: User = Depends(get_current_user)
):
    """Generates a signed OAuth state token and returns GitHub App installation URL."""
    state_token = github_app_auth.generate_state_token(
        user_id=current_user.id,
        redirect_path=redirect_path
    )
    if settings.is_github_app_configured:
        install_url = f"https://github.com/apps/{settings.GITHUB_APP_SLUG}/installations/new?state={state_token}"
    else:
        install_url = f"http://localhost:8000/api/v1/github/dev-redirect?state={state_token}"
    return GitHubInstallResponse(install_url=install_url, state=state_token)


@router.get("/dev-redirect")
async def github_dev_redirect(
    state: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Seamless dev mode redirect endpoint when GITHUB_APP_SLUG is default/unconfigured."""
    claims = github_app_auth.verify_state_token(state)
    if not claims or not claims.get("user_id"):
        return RedirectResponse(url="http://localhost:3000/dashboard/settings/connected-accounts?installed=true", status_code=307)

    user_id = claims["user_id"]
    redirect_path = claims.get("redirect_path", "/dashboard/settings/connected-accounts")

    inst_id = f"inst-dev-{user_id[:8]}"
    stmt = select(GitHubInstallation).where(
        GitHubInstallation.user_id == user_id,
        GitHubInstallation.installation_id == inst_id
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if not existing:
        inst = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            installation_id=inst_id,
            account_login=f"dev-github-{user_id[:6]}",
            account_type="User",
            github_username=f"dev-{user_id[:6]}",
            avatar_url="https://github.com/github.png"
        )
        db.add(inst)
        await db.commit()

    _USER_REPOS_CACHE.pop(user_id, None)

    join_char = "&" if "?" in redirect_path else "?"
    target_url = f"http://localhost:3000{redirect_path}{join_char}installed=true"
    return RedirectResponse(url=target_url, status_code=307)


@router.post("/connect-dev", status_code=status.HTTP_200_OK)
async def connect_dev_github(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Instantly links a dev/test GitHub installation for testing Repo-Backed agents."""
    inst_id = f"inst-dev-{current_user.id[:8]}"
    stmt = select(GitHubInstallation).where(
        GitHubInstallation.user_id == current_user.id,
        GitHubInstallation.installation_id == inst_id
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if not existing:
        github_user = current_user.email.split("@")[0] if current_user.email else (current_user.full_name or f"dev-{current_user.id[:6]}")
        inst = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            installation_id=inst_id,
            account_login=f"{current_user.full_name or 'dev'}-github".lower().replace(" ", "-"),
            account_type="User",
            github_username=github_user,
            avatar_url="https://github.com/github.png"
        )
        db.add(inst)
        await db.commit()

    _USER_REPOS_CACHE.pop(current_user.id, None)
    return {"status": "success", "message": "Development GitHub installation connected successfully."}


async def _auto_sync_real_installations(user_id: str, db: AsyncSession):
    """Auto-detects and syncs real GitHub App installations from the GitHub API."""
    if not settings.is_github_app_configured:
        return
    try:
        raw_installations = await installation_client.list_app_installations()
        if not raw_installations:
            return

        synced_any = False

        for item in raw_installations:
            inst_id = str(item["id"])
            account = item.get("account", {})
            login = account.get("login", f"github-user-{inst_id}")
            acc_type = account.get("type", "User")
            avatar = account.get("avatar_url", "https://github.com/github.png")

            stmt = select(GitHubInstallation).where(
                GitHubInstallation.installation_id == inst_id
            )
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()

            if existing:
                if existing.user_id == user_id:
                    existing.account_login = login
                    existing.account_type = acc_type
                    existing.avatar_url = avatar
                continue
            else:
                inst = GitHubInstallation(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    installation_id=inst_id,
                    account_login=login,
                    account_type=acc_type,
                    github_username=login,
                    avatar_url=avatar
                )
                db.add(inst)

        await db.commit()
        _USER_REPOS_CACHE.pop(user_id, None)
    except Exception as e:
        await db.rollback()
        logger.warning(f"Auto-sync of real GitHub installations skipped: {e}")


@router.get("/callback")
async def github_app_callback(
    installation_id: str = Query(...),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Callback endpoint for GitHub App installation redirect."""
    redirect_path = "/dashboard/settings/connected-accounts"
    user_id = None
    if state:
        claims = github_app_auth.verify_state_token(state)
        if claims and claims.get("user_id"):
            user_id = claims["user_id"]
            redirect_path = claims.get("redirect_path", "/dashboard/settings/connected-accounts")

    if not user_id:
        join_char = "&" if "?" in redirect_path else "?"
        target_url = f"http://localhost:3000{redirect_path}{join_char}installation_id={installation_id}&installed=true"
        return RedirectResponse(url=target_url, status_code=307)

    # Fetch installation metadata from GitHub API (gracefully degrade if GitHub API unavailable)
    try:
        details = await installation_client.get_installation_details(installation_id)
    except GitHubInstallationRevokedError:
        join_char = "&" if "?" in redirect_path else "?"
        target_url = f"http://localhost:3000{redirect_path}{join_char}install_error=invalid_installation"
        return RedirectResponse(url=target_url, status_code=307)
    except Exception:
        details = {
            "account_login": f"github-user-{installation_id[:8]}",
            "account_type": "User",
            "avatar_url": "https://github.com/github.png",
        }

    # Delete mock installations
    del_stmt = delete(GitHubInstallation).where(
        GitHubInstallation.user_id == user_id,
        GitHubInstallation.installation_id.startswith("inst-dev-")
    )
    await db.execute(del_stmt)

    stmt = select(GitHubInstallation).where(
        GitHubInstallation.user_id == user_id,
        GitHubInstallation.installation_id == str(installation_id)
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        existing.account_login = details["account_login"]
        existing.account_type = details["account_type"]
        existing.avatar_url = details.get("avatar_url")
    else:
        inst = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            installation_id=str(installation_id),
            account_login=details["account_login"],
            account_type=details["account_type"],
            github_username=details["account_login"],
            avatar_url=details.get("avatar_url")
        )
        db.add(inst)

    await db.commit()
    _USER_REPOS_CACHE.pop(user_id, None)

    join_char = "&" if "?" in redirect_path else "?"
    target_url = f"http://localhost:3000{redirect_path}{join_char}installed=true"
    return RedirectResponse(url=target_url, status_code=307)


@router.post("/installations/link", response_model=InstallationResponse)
async def link_github_installation(
    req: LinkInstallationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Links a specific GitHub App installation ID to the current authenticated user."""
    installation_id = str(req.installation_id).strip()
    try:
        details = await installation_client.get_installation_details(installation_id)
    except GitHubInstallationRevokedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub installation is invalid or revoked."
        )
    except Exception:
        details = {
            "account_login": f"github-user-{installation_id[:8]}",
            "account_type": "User",
            "avatar_url": "https://github.com/github.png",
        }

    # Delete mock installations
    del_stmt = delete(GitHubInstallation).where(
        GitHubInstallation.user_id == current_user.id,
        GitHubInstallation.installation_id.startswith("inst-dev-")
    )
    await db.execute(del_stmt)

    stmt = select(GitHubInstallation).where(
        GitHubInstallation.user_id == current_user.id,
        GitHubInstallation.installation_id == installation_id
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        existing.account_login = details["account_login"]
        existing.account_type = details["account_type"]
        existing.avatar_url = details.get("avatar_url")
        inst = existing
    else:
        inst = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            installation_id=installation_id,
            account_login=details["account_login"],
            account_type=details["account_type"],
            github_username=details["account_login"],
            avatar_url=details.get("avatar_url")
        )
        db.add(inst)

    await db.commit()
    _USER_REPOS_CACHE.pop(current_user.id, None)

    return InstallationResponse(
        id=inst.id,
        installation_id=inst.installation_id,
        account_login=inst.account_login or inst.github_username or "connected-user",
        account_type=inst.account_type or "User",
        avatar_url=inst.avatar_url,
        created_at=inst.created_at.isoformat()
    )


@router.post("/installations/sync", response_model=List[InstallationResponse])
async def sync_github_installations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Syncs real GitHub App installations directly from GitHub API."""
    await _auto_sync_real_installations(current_user.id, db)
    return await list_my_installations(current_user=current_user, db=db)


@router.get("/repos", response_model=ReposListResponse)
async def get_github_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists accessible GitHub repositories across all installations belonging strictly to the logged-in user."""
    now = time.time()
    cached = _USER_REPOS_CACHE.get(current_user.id)
    if cached and cached["expires_at"] > now:
        return cached["data"]

    stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id).order_by(GitHubInstallation.created_at.desc())
    res = await db.execute(stmt)
    installations = res.scalars().all()

    real_insts = [i for i in installations if not i.installation_id.startswith("inst-dev-")]
    if not real_insts and settings.is_github_app_configured:
        await _auto_sync_real_installations(current_user.id, db)
        stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id).order_by(GitHubInstallation.created_at.desc())
        res = await db.execute(stmt)
        installations = res.scalars().all()
        real_insts = [i for i in installations if not i.installation_id.startswith("inst-dev-")]

    if real_insts:
        installations = real_insts

    if not installations:
        empty_response = ReposListResponse(connected=False, installations=[], repos=[])
        _USER_REPOS_CACHE[current_user.id] = {"data": empty_response, "expires_at": now + 5}
        return empty_response

    active_installations: List[InstallationResponse] = []
    all_repos: List[RepositoryResponse] = []
    seen_ids = set()

    for inst in installations:
        try:
            repos = await installation_client.list_installation_repos(inst.installation_id)
            active_installations.append(
                InstallationResponse(
                    id=inst.id,
                    installation_id=inst.installation_id,
                    account_login=inst.account_login or inst.github_username or "connected-user",
                    account_type=inst.account_type or "User",
                    avatar_url=inst.avatar_url,
                    created_at=inst.created_at.isoformat()
                )
            )
            for r in repos:
                if r["id"] not in seen_ids:
                    seen_ids.add(r["id"])
                    all_repos.append(
                        RepositoryResponse(
                            id=r["id"],
                            full_name=r["full_name"],
                            name=r["name"],
                            owner=r["owner"],
                            default_branch=r["default_branch"],
                            is_private=r["is_private"],
                            language=r.get("language"),
                            updated_at=r["updated_at"],
                            installation_id=inst.installation_id
                        )
                    )
        except GitHubInstallationRevokedError:
            continue

    if not active_installations:
        empty_response = ReposListResponse(connected=False, installations=[], repos=[])
        _USER_REPOS_CACHE[current_user.id] = {"data": empty_response, "expires_at": now + 60}
        return empty_response

    response_data = ReposListResponse(
        connected=True,
        installations=active_installations,
        repos=all_repos
    )

    _USER_REPOS_CACHE[current_user.id] = {"data": response_data, "expires_at": now + 180}
    return response_data


@router.get("/installations", response_model=List[InstallationResponse])
async def list_my_installations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all active GitHub App installations for the authenticated user."""
    stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id).order_by(GitHubInstallation.created_at.desc())
    res = await db.execute(stmt)
    installations = res.scalars().all()

    real_insts = [i for i in installations if not i.installation_id.startswith("inst-dev-")]
    if not real_insts and settings.is_github_app_configured:
        await _auto_sync_real_installations(current_user.id, db)
        stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id).order_by(GitHubInstallation.created_at.desc())
        res = await db.execute(stmt)
        installations = res.scalars().all()

    return [
        InstallationResponse(
            id=inst.id,
            installation_id=inst.installation_id,
            account_login=inst.account_login or inst.github_username or "connected-user",
            account_type=inst.account_type or "User",
            avatar_url=inst.avatar_url,
            created_at=inst.created_at.isoformat()
        )
        for inst in installations
    ]


@router.delete("/installations/{installation_db_id}", status_code=status.HTTP_200_OK)
async def disconnect_github_installation(
    installation_db_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disconnects a GitHub App installation record for the authenticated user."""
    stmt = select(GitHubInstallation).where(
        GitHubInstallation.id == installation_db_id,
        GitHubInstallation.user_id == current_user.id
    )
    res = await db.execute(stmt)
    inst = res.scalar_one_or_none()

    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GitHub installation not found or does not belong to your account."
        )

    await db.delete(inst)
    await db.commit()

    # Invalidate cache
    _USER_REPOS_CACHE.pop(current_user.id, None)

    return {"status": "success", "message": "GitHub installation disconnected successfully."}
