from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from backend.db.models import User, Wallet, AuditLog, utc_now
from backend.auth_service.auth import auth_service
from backend.config import settings

class WalletService:
    """Non-custodial Multi-Wallet Management Service."""

    @staticmethod
    async def list_wallets(session: AsyncSession, user_id: str) -> List[Dict[str, Any]]:
        stmt = select(Wallet).where(Wallet.user_id == user_id).order_by(Wallet.created_at.asc())
        res = await session.execute(stmt)
        wallets = res.scalars().all()
        return [
            {
                "id": w.id,
                "address": w.address,
                "chain_id": w.chain_id,
                "wallet_type": w.wallet_type,
                "is_primary": w.is_primary,
                "is_verified": w.is_verified,
                "verified_at": w.verified_at.isoformat() if w.verified_at else None,
                "created_at": w.created_at.isoformat()
            }
            for w in wallets
        ]

    @staticmethod
    async def link_wallet(
        session: AsyncSession,
        user: User,
        wallet_address: str,
        message: str,
        signature: str,
        chain_id: int = 137
    ) -> Dict[str, Any]:
        """Cryptographically verifies and links a secondary wallet to an authenticated user."""
        clean_address = wallet_address.strip().lower()

        if chain_id not in settings.SUPPORTED_CHAIN_IDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported chain ID {chain_id}. Supported chain IDs: {settings.SUPPORTED_CHAIN_IDS}."
            )

        # 1. Cryptographic signature verification
        if not auth_service.verify_siwe_signature(clean_address, message, signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signature verification failed. Cannot link wallet."
            )

        # 2. Check collision across ALL user accounts
        stmt_exist = select(Wallet).where(Wallet.address == clean_address)
        res_exist = await session.execute(stmt_exist)
        existing = res_exist.scalar_one_or_none()

        if existing:
            if existing.user_id == user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This wallet is already linked to your account."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This wallet is already associated with another user account."
                )

        # 3. Create secondary wallet
        new_wallet = Wallet(
            user_id=user.id,
            address=clean_address,
            chain_id=chain_id,
            is_primary=False,
            is_verified=True
        )
        session.add(new_wallet)

        audit = AuditLog(
            actor_id=user.id,
            action="WALLET_LINKED",
            resource_type="wallet",
            resource_id=clean_address,
            details={"chain_id": chain_id}
        )
        session.add(audit)
        await session.commit()

        return {
            "status": "success",
            "message": f"Wallet {clean_address} successfully linked.",
            "wallet": {
                "id": new_wallet.id,
                "address": new_wallet.address,
                "chain_id": new_wallet.chain_id,
                "is_primary": new_wallet.is_primary
            }
        }

    @staticmethod
    async def set_primary_wallet(session: AsyncSession, user: User, wallet_address: str) -> Dict[str, Any]:
        """Atomically designates a wallet as primary for the authenticated user."""
        clean_address = wallet_address.strip().lower()

        stmt = select(Wallet).where(Wallet.user_id == user.id)
        res = await session.execute(stmt)
        wallets = res.scalars().all()

        target_found = False
        for w in wallets:
            if w.address == clean_address:
                w.is_primary = True
                target_found = True
            else:
                w.is_primary = False

        if not target_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified wallet is not associated with your account."
            )

        audit = AuditLog(
            actor_id=user.id,
            action="PRIMARY_WALLET_CHANGED",
            resource_type="wallet",
            resource_id=clean_address
        )
        session.add(audit)
        await session.commit()

        return {"status": "success", "primary_wallet": clean_address}

    @staticmethod
    async def unlink_wallet(session: AsyncSession, user: User, wallet_id: str) -> Dict[str, Any]:
        """Safely unlinks a wallet with strict authentication and primary checks."""
        stmt = select(Wallet).where(Wallet.user_id == user.id)
        res = await session.execute(stmt)
        user_wallets = res.scalars().all()

        target_wallet = next((w for w in user_wallets if w.id == wallet_id), None)
        if not target_wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wallet not found or does not belong to your account."
            )

        # Safety Check 1: Do not unlink if it's the ONLY authentication method
        if len(user_wallets) <= 1 and not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove your only authentication wallet unless a password or secondary wallet is configured."
            )

        was_primary = target_wallet.is_primary
        unlinked_address = target_wallet.address

        await session.delete(target_wallet)
        await session.flush()

        # Safety Check 2: If primary wallet was unlinked, promote remaining wallet
        remaining_wallets = [w for w in user_wallets if w.id != wallet_id]
        if was_primary and remaining_wallets:
            remaining_wallets[0].is_primary = True

        audit = AuditLog(
            actor_id=user.id,
            action="WALLET_UNLINKED",
            resource_type="wallet",
            resource_id=unlinked_address
        )
        session.add(audit)
        await session.commit()

        return {
            "status": "success",
            "message": f"Wallet {unlinked_address} unlinked successfully.",
            "remaining_wallets_count": len(remaining_wallets)
        }

wallet_service = WalletService()
