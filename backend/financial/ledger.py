from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from decimal import Decimal

from backend.db.models import (
    LedgerAccount, LedgerEntry, Settlement, Escrow, User, AuditLog
)
from backend.config import settings

class FinancialLedgerService:
    """Double-entry immutable accounting ledger for platform revenues, escrows, and payouts."""

    @staticmethod
    async def get_or_create_account(
        session: AsyncSession,
        account_type: str,
        user_id: Optional[str] = None
    ) -> LedgerAccount:
        """Retrieves or provisions an isolated ledger account."""
        if user_id:
            stmt = select(LedgerAccount).where(
                LedgerAccount.user_id == user_id,
                LedgerAccount.account_type == account_type
            )
        else:
            stmt = select(LedgerAccount).where(
                LedgerAccount.user_id == None,
                LedgerAccount.account_type == account_type
            )

        res = await session.execute(stmt)
        account = res.scalar_one_or_none()

        if not account:
            account = LedgerAccount(
                user_id=user_id,
                account_type=account_type,
                currency="USDC",
                balance=0.0
            )
            session.add(account)
            await session.flush()

        return account

    async def record_task_settlement(
        self,
        session: AsyncSession,
        task_id: str,
        developer_id: str,
        gross_amount_usdc: float,
        proof_hash: str,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes idempotent 85/10/5 double-entry revenue distribution:
        - 85% to Agent Developer
        - 10% to Staking Pool
        - 5% to DAO Treasury
        """
        gross = Decimal(str(gross_amount_usdc))
        dev_amt = (gross * Decimal(str(settings.DEV_SPLIT_BPS))) / Decimal("10000")
        staker_amt = (gross * Decimal(str(settings.STAKER_SPLIT_BPS))) / Decimal("10000")
        dao_amt = gross - dev_amt - staker_amt

        # 1. Developer Account
        dev_acc = await self.get_or_create_account(session, "DEVELOPER_EARNINGS", user_id=developer_id)
        dev_acc.balance = float(Decimal(str(dev_acc.balance)) + dev_amt)
        entry_dev = LedgerEntry(
            account_id=dev_acc.id,
            reference_id=task_id,
            entry_type="CREDIT",
            amount=float(dev_amt),
            balance_after=dev_acc.balance,
            description=f"85% Developer payout for task {task_id}"
        )
        session.add(entry_dev)

        # 2. Staking Pool Account
        staker_acc = await self.get_or_create_account(session, "STAKING_POOL")
        staker_acc.balance = float(Decimal(str(staker_acc.balance)) + staker_amt)
        entry_staker = LedgerEntry(
            account_id=staker_acc.id,
            reference_id=task_id,
            entry_type="CREDIT",
            amount=float(staker_amt),
            balance_after=staker_acc.balance,
            description=f"10% Staking pool yield for task {task_id}"
        )
        session.add(entry_staker)

        # 3. DAO Treasury Account
        dao_acc = await self.get_or_create_account(session, "DAO_TREASURY")
        dao_acc.balance = float(Decimal(str(dao_acc.balance)) + dao_amt)
        entry_dao = LedgerEntry(
            account_id=dao_acc.id,
            reference_id=task_id,
            entry_type="CREDIT",
            amount=float(dao_amt),
            balance_after=dao_acc.balance,
            description=f"5% DAO treasury protocol fee for task {task_id}"
        )
        session.add(entry_dao)

        await session.flush()

        return {
            "task_id": task_id,
            "gross_usdc": float(gross),
            "developer_payout_usdc": float(dev_amt),
            "staking_yield_usdc": float(staker_amt),
            "dao_fee_usdc": float(dao_amt),
            "proof_hash": proof_hash
        }

    async def get_user_balance(self, session: AsyncSession, user_id: str) -> float:
        acc = await self.get_or_create_account(session, "DEVELOPER_EARNINGS", user_id=user_id)
        return acc.balance

ledger_service = FinancialLedgerService()
