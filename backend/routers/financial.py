from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User, LedgerAccount, LedgerEntry, Withdrawal
from backend.auth_service.rbac import get_current_user, require_permission
from backend.financial.ledger import ledger_service
from backend.financial.withdrawals import withdrawal_service

router = APIRouter(prefix="/api/v1/financial", tags=["Financial Ledger & Earnings"])

class WithdrawalRequestSchema(BaseModel):
    destination_wallet: str
    amount_usdc: float = Field(..., gt=0.0)

@router.get("/summary")
async def get_financial_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns developer's available balance, ledger entries, and pending withdrawals."""
    balance = await ledger_service.get_user_balance(session, user.id)
    withdrawals = await withdrawal_service.list_withdrawals(session, user.id)

    # Load recent ledger entries
    acc = await ledger_service.get_or_create_account(session, "DEVELOPER_EARNINGS", user_id=user.id)
    stmt = select(LedgerEntry).where(LedgerEntry.account_id == acc.id).order_by(LedgerEntry.created_at.desc()).limit(20)
    res = await session.execute(stmt)
    entries = res.scalars().all()

    return {
        "user_id": user.id,
        "available_balance_usdc": balance,
        "currency": "USDC",
        "recent_entries": [
            {
                "id": e.id,
                "type": e.entry_type,
                "amount": float(e.amount),
                "balance_after": float(e.balance_after),
                "description": e.description,
                "created_at": e.created_at.isoformat()
            }
            for e in entries
        ],
        "withdrawals": withdrawals
    }

@router.post("/withdraw", dependencies=[Depends(require_permission("withdrawal:create"))])
async def request_developer_withdrawal(
    req: WithdrawalRequestSchema,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Initiates a non-custodial withdrawal request from developer earnings balance."""
    return await withdrawal_service.request_withdrawal(
        session=session,
        user=user,
        destination_wallet=req.destination_wallet,
        amount_usdc=req.amount_usdc
    )

@router.get("/withdrawals")
async def list_withdrawals(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await withdrawal_service.list_withdrawals(session, user.id)
