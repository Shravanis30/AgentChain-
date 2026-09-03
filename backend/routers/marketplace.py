from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import selectinload

from backend.db.session import get_db
from backend.db.models import Agent, AgentReview, Task, User, AuditLog
from backend.auth_service.rbac import get_current_user

router = APIRouter(prefix="/api/v1/marketplace", tags=["Marketplace Discovery & Reviews"])

class PostReviewSchema(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: Optional[str] = None
    task_id: str

@router.get("/agents")
async def list_marketplace_agents(
    category: Optional[str] = Query(None, description="Filter by domain category"),
    search: Optional[str] = Query(None, description="Search agent name or description"),
    min_price: Optional[float] = Query(None, ge=0.0),
    max_price: Optional[float] = Query(None, ge=0.0),
    sort_by: Optional[str] = Query("newest", description="newest, price_asc, price_desc, rating"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_db)
):
    """
    Returns database-driven list of PUBLISHED AI agents with server-side filtering, search, and pagination.
    """
    category_str = category if isinstance(category, str) else None
    search_str = search if isinstance(search, str) else None
    min_price_val = min_price if isinstance(min_price, (int, float)) else None
    max_price_val = max_price if isinstance(max_price, (int, float)) else None
    sort_by_str = sort_by if isinstance(sort_by, str) else "newest"

    query = select(Agent).options(selectinload(Agent.reviews), selectinload(Agent.versions)).where(Agent.status == "PUBLISHED")

    if category_str:
        query = query.where(Agent.category == category_str.lower())

    if search_str:
        search_pattern = f"%{search_str.strip().lower()}%"
        query = query.where(
            (func.lower(Agent.name).like(search_pattern)) |
            (func.lower(Agent.description).like(search_pattern))
        )

    if min_price_val is not None:
        query = query.where(Agent.price_per_call_usdc >= min_price_val)
    if max_price_val is not None:
        query = query.where(Agent.price_per_call_usdc <= max_price_val)

    if sort_by_str == "price_asc":
        query = query.order_by(Agent.price_per_call_usdc.asc())
    elif sort_by_str == "price_desc":
        query = query.order_by(Agent.price_per_call_usdc.desc())
    else:
        query = query.order_by(Agent.published_at.desc().nullslast(), Agent.created_at.desc())

    limit_val = limit if isinstance(limit, int) else 20
    offset_val = offset if isinstance(offset, int) else 0

    res_all = await session.execute(query)
    all_matching = res_all.scalars().all()
    total_count = len(all_matching)

    agents = all_matching[offset_val : offset_val + limit_val]

    results = []
    for a in agents:
        ratings = [r.rating for r in a.reviews]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
        active_version = a.versions[-1] if a.versions else None

        results.append({
            "id": a.id,
            "name": a.name,
            "slug": a.slug,
            "description": a.description,
            "category": a.category,
            "price_per_call_usdc": float(a.price_per_call_usdc),
            "pricing_model": a.pricing_model,
            "status": a.status,
            "rating": avg_rating,
            "total_reviews": len(a.reviews),
            "current_version": active_version.version if active_version else "v1.0.0",
            "model_provider": active_version.model_provider if active_version else "openai",
            "model_name": active_version.model_name if active_version else "gpt-4o",
            "published_at": a.published_at.isoformat() if a.published_at else a.created_at.isoformat()
        })

    return {
        "agents": results,
        "count": len(results),
        "total": total_count,
        "offset": offset_val,
        "limit": limit_val
    }

@router.get("/agents/{agent_id}")
async def get_marketplace_agent_profile(
    agent_id: str,
    session: AsyncSession = Depends(get_db)
):
    """Retrieves detailed marketplace profile for a published agent."""
    stmt = select(Agent).where(Agent.id == agent_id, Agent.status == "PUBLISHED")
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Marketplace agent not found or not published.")

    ratings = [r.rating for r in agent.reviews]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
    active_version = agent.versions[-1] if agent.versions else None

    return {
        "id": agent.id,
        "name": agent.name,
        "slug": agent.slug,
        "description": agent.description,
        "category": agent.category,
        "price_per_call_usdc": float(agent.price_per_call_usdc),
        "pricing_model": agent.pricing_model,
        "status": agent.status,
        "rating": avg_rating,
        "total_reviews": len(agent.reviews),
        "current_version": {
            "version": active_version.version if active_version else "v1.0.0",
            "model_provider": active_version.model_provider if active_version else "openai",
            "model_name": active_version.model_name if active_version else "gpt-4o"
        },
        "reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "review_text": r.review_text,
                "reviewer_id": r.reviewer_id,
                "created_at": r.created_at.isoformat()
            }
            for r in agent.reviews
        ],
        "tool_permissions": [
            {"tool_name": tp.tool_name, "network": tp.network_enabled, "shell": tp.shell_enabled}
            for tp in agent.tool_permissions
        ],
        "published_at": agent.published_at.isoformat() if agent.published_at else agent.created_at.isoformat()
    }

@router.post("/agents/{agent_id}/review")
async def submit_verified_review(
    agent_id: str,
    req: PostReviewSchema,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Submits a review (enforces verified-purchase check and disallows owner self-review)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    if agent.owner_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of interest: Agent owners cannot submit reviews for their own agents."
        )

    # Verified Purchase Check: User must have completed a task using this agent!
    stmt_task = select(Task).where(
        Task.id == req.task_id,
        Task.created_by == user.id,
        Task.status == "COMPLETED"
    )
    res_task = await session.execute(stmt_task)
    task = res_task.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verified purchase required: You must have a COMPLETED task associated with this task_id to leave a review."
        )

    review = AgentReview(
        agent_id=agent.id,
        reviewer_id=user.id,
        task_id=task.id,
        rating=req.rating,
        review_text=req.review_text
    )
    session.add(review)

    audit = AuditLog(
        actor_id=user.id,
        action="REVIEW_CREATED",
        resource_type="agent_review",
        resource_id=agent.id,
        details={"rating": req.rating, "task_id": task.id}
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "review_id": review.id, "rating": review.rating}
