from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from decimal import Decimal

from backend.db.models import (
    Withdrawal, LedgerAccount, LedgerEntry, User, AuditLog, utc_now
)
from backend.financial.ledger import ledger_service

class WithdrawalService:
    """Non-custodial withdrawal management with automated risk checks and ledger debit."""

    @staticmethod
    async def request_withdrawal(
        session: AsyncSession,
        user: User,
        destination_wallet: str,
        amount_usdc: float
    ) -> Dict[str, Any]:
        if amount_usdc <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Withdrawal amount must be greater than zero."
            )

        clean_destination = destination_wallet.strip().lower()
        if not clean_destination.startswith("0x") or len(clean_destination) != 42:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid destination Ethereum/Polygon wallet address format."
            )

        # 1. Check Available Balance in Ledger
        acc = await ledger_service.get_or_create_account(session, "DEVELOPER_EARNINGS", user_id=user.id)
        current_balance = Decimal(str(acc.balance))
        req_amount = Decimal(str(amount_usdc))

        if current_balance < req_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient balance. Available: ${float(current_balance):.2f} USDC, Requested: ${amount_usdc:.2f} USDC."
            )

        # 2. Debit Developer Ledger Account
        new_balance = current_balance - req_amount
        acc.balance = float(new_balance)

        withdrawal = Withdrawal(
            user_id=user.id,
            destination_wallet=clean_destination,
            amount_usdc=amount_usdc,
            status="PENDING",
            risk_score=10 if amount_usdc < 1000 else 40
        )
        session.add(withdrawal)
        await session.flush()

        # Record Ledger Entry
        entry = LedgerEntry(
            account_id=acc.id,
            reference_id=withdrawal.id,
            entry_type="DEBIT",
            amount=amount_usdc,
            balance_after=acc.balance,
            description=f"Withdrawal request {withdrawal.id} to {clean_destination}"
        )
        session.add(entry)

        # Record Audit Log
        audit = AuditLog(
            actor_id=user.id,
            action="WITHDRAWAL_REQUESTED",
            resource_type="withdrawal",
            resource_id=withdrawal.id,
            details={"destination_wallet": clean_destination, "amount_usdc": amount_usdc}
        )
        session.add(audit)
        await session.commit()

        return {
            "status": "success",
            "withdrawal_id": withdrawal.id,
            "amount_usdc": amount_usdc,
            "destination_wallet": clean_destination,
            "remaining_balance_usdc": acc.balance,
            "withdrawal_status": withdrawal.status
        }

    @staticmethod
    async def list_withdrawals(session: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
        stmt = select(Withdrawal).where(Withdrawal.user_id == user_id).order_by(Withdrawal.created_at.desc())
        res = await session.execute(stmt)
        items = res.scalars().all()
        return [
            {
                "id": w.id,
                "amount_usdc": float(w.amount_usdc),
                "destination_wallet": w.destination_wallet,
                "status": w.status,
                "tx_hash": w.tx_hash,
                "created_at": w.created_at.isoformat(),
                "completed_at": w.completed_at.isoformat() if w.completed_at else None
            }
            for w in items
        ]

withdrawal_service = WithdrawalService()
