import os
import re
import secrets
import time
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from eth_account.messages import encode_defunct
from eth_account import Account
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from backend.config import settings
from backend.db.models import User, Wallet, Session as UserSession, Role, UserRole, Permission, RolePermission, SecurityEvent, AuditLog, utc_now
from backend.auth_service.redis_client import redis_service

ph = PasswordHasher()

class AuthService:
    """Enterprise Cryptographic Authentication Service for SIWE and RBAC."""

    @staticmethod
    async def generate_siwe_nonce(wallet_address: Optional[str] = None) -> str:
        """Generates a cryptographically secure random SIWE nonce backed by Redis."""
        nonce = secrets.token_hex(16)
        metadata = {
            "created_at": time.time(),
            "wallet_address": wallet_address.lower() if wallet_address else None,
            "domain": settings.SIWE_DOMAIN
        }
        await redis_service.set_nonce(nonce, metadata, ttl=settings.SIWE_NONCE_EXPIRE_SECONDS)
        return nonce

    @staticmethod
    async def consume_siwe_nonce(nonce: str) -> Optional[Dict[str, Any]]:
        """Validates and consumes a single-use nonce from Redis, preventing replay attacks."""
        return await redis_service.consume_nonce(nonce)

    @staticmethod
    def hash_password(password: str) -> str:
        """Hashes plaintext password using Argon2id with strict parameters."""
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters long."
            )
        return ph.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifies plaintext password against Argon2id hash."""
        try:
            return ph.verify(hashed_password, plain_password)
        except (VerifyMismatchError, Exception):
            return False

    @staticmethod
    def create_access_token(
        user_id: str,
        email: Optional[str] = None,
        wallet_address: Optional[str] = None,
        roles: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None
    ) -> str:
        """Issues a signed JWT access token with unique JTI claim."""
        jti = secrets.token_hex(16)
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "sub": user_id,
            "email": email,
            "wallet_address": wallet_address.lower() if wallet_address else None,
            "roles": roles or ["USER"],
            "permissions": permissions or [],
            "exp": int(expire.timestamp()),
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "jti": jti,
            "iss": "agentchain.ai"
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    async def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
        """Verifies JWT signature, expiration, and Redis token revocation blacklist."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if payload.get("exp", 0) < time.time():
                return None

            jti = payload.get("jti")
            if jti and await redis_service.is_token_blacklisted(jti):
                return None

            return payload
        except Exception:
            return None

    @staticmethod
    def verify_siwe_signature(wallet_address: str, message: str, signature: str) -> bool:
        """
        Cryptographically recovers signer address from EIP-4361 message and signature.
        """
        try:
            if not wallet_address or not message or not signature:
                return False

            clean_expected = wallet_address.strip().lower()

            # EIP-191 defunct encoding
            signable_message = encode_defunct(text=message)
            recovered_address = Account.recover_message(signable_message, signature=signature)

            return recovered_address.lower() == clean_expected
        except Exception:
            return False

    @staticmethod
    def parse_siwe_message(message: str) -> Dict[str, Any]:
        """Parses standard EIP-4361 SIWE message fields strictly."""
        fields = {}
        lines = message.split("\n")

        if len(lines) > 0 and "wants you to sign in with your Ethereum account:" in lines[0]:
            domain = lines[0].replace("wants you to sign in with your Ethereum account:", "").strip()
            fields["domain"] = domain

        addr_match = re.search(r"0x[a-fA-F0-9]{40}", message)
        if addr_match:
            fields["address"] = addr_match.group(0).lower()

        nonce_match = re.search(r"Nonce:\s*([a-zA-Z0-9]+)", message)
        if nonce_match:
            fields["nonce"] = nonce_match.group(1).strip()

        chain_match = re.search(r"Chain ID:\s*([0-9]+)", message)
        if chain_match:
            fields["chain_id"] = int(chain_match.group(1).strip())

        uri_match = re.search(r"URI:\s*(\S+)", message)
        if uri_match:
            fields["uri"] = uri_match.group(1).strip()

        issued_match = re.search(r"Issued At:\s*(\S+)", message)
        if issued_match:
            fields["issued_at"] = issued_match.group(1).strip()

        exp_match = re.search(r"Expiration Time:\s*(\S+)", message)
        if exp_match:
            fields["expiration_time"] = exp_match.group(1).strip()

        return fields

    async def authenticate_wallet(
        self,
        session: AsyncSession,
        wallet_address: str,
        message: str,
        signature: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full cryptographic SIWE login flow with replay defense:
        1. Signature replay check.
        2. Parse & validate EIP-4361 message fields.
        3. Consume Redis single-use nonce challenge.
        4. Cryptographic signature recovery & address match.
        5. User & Wallet resolution in DB.
        6. Persistent session registration.
        """
        clean_wallet = wallet_address.strip().lower()

        # 1. Signature Replay Check
        sig_hash = hashlib.sha256(signature.encode("utf-8")).hexdigest()
        if await redis_service.is_signature_used(sig_hash):
            sec_event = SecurityEvent(
                event_type="SIWE_SIGNATURE_REPLAY_ATTACK",
                severity="CRITICAL",
                ip_address=ip_address,
                raw_payload={"wallet": clean_wallet, "signature_hash": sig_hash},
                mitigated=True
            )
            session.add(sec_event)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Replay attack detected: This signature has already been consumed."
            )

        # 2. Parse & Validate SIWE Message Fields
        parsed = self.parse_siwe_message(message)
        nonce = parsed.get("nonce")

        if not nonce:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid SIWE message: missing Nonce field."
            )

        # Domain Validation
        msg_domain = parsed.get("domain")
        if msg_domain and msg_domain != settings.SIWE_DOMAIN and msg_domain not in settings.SIWE_DOMAIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SIWE message domain '{msg_domain}' does not match expected platform domain '{settings.SIWE_DOMAIN}'."
            )

        # Address Field Mismatch Check
        msg_address = parsed.get("address")
        if msg_address and msg_address.lower() != clean_wallet:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SIWE message address field does not match requested wallet address."
            )

        # Chain ID Validation
        chain_id = parsed.get("chain_id", settings.CHAIN_ID)
        if chain_id not in settings.SUPPORTED_CHAIN_IDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported chain ID {chain_id}. Supported chain IDs: {settings.SUPPORTED_CHAIN_IDS}."
            )

        # Expiration Time & Issued At Validation
        now = datetime.now(timezone.utc)
        exp_str = parsed.get("expiration_time")
        if exp_str:
            try:
                exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                if now > exp_dt:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="SIWE message has expired."
                    )
            except ValueError:
                pass

        issued_str = parsed.get("issued_at")
        if issued_str:
            try:
                issued_dt = datetime.fromisoformat(issued_str.replace("Z", "+00:00"))
                if issued_dt > now + timedelta(seconds=60):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="SIWE message issued timestamp is in the future."
                    )
            except ValueError:
                pass

        # 3. Consume Redis Nonce
        consumed = await self.consume_siwe_nonce(nonce)
        if not consumed:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or previously consumed SIWE nonce challenge."
            )

        # 4. Cryptographic Signature Recovery
        if not self.verify_siwe_signature(clean_wallet, message, signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Cryptographic signature verification failed for address."
            )

        # Mark signature as consumed (Replay prevention for 24 hours)
        await redis_service.mark_signature_used(sig_hash, ttl=86400)

        # 5. Lookup or provision Wallet & User
        stmt_w = select(Wallet).where(Wallet.address == clean_wallet)
        res_w = await session.execute(stmt_w)
        wallet = res_w.scalar_one_or_none()

        if wallet:
            user = wallet.user
        else:
            user = User(
                full_name=f"User {clean_wallet[:6]}...{clean_wallet[-4:]}",
                is_active=True,
                is_verified=True
            )
            session.add(user)
            await session.flush()

            wallet = Wallet(
                user_id=user.id,
                address=clean_wallet,
                chain_id=chain_id,
                is_primary=True,
                is_verified=True
            )
            session.add(wallet)

            stmt_role = select(Role).where(Role.name == "USER")
            res_role = await session.execute(stmt_role)
            user_role_obj = res_role.scalar_one_or_none()
            if user_role_obj:
                ur = UserRole(user_id=user.id, role_id=user_role_obj.id)
                session.add(ur)

            await session.flush()

        roles, permissions = await self.get_user_roles_and_permissions(session, user.id)

        # 6. Issue JWT & Session
        token = self.create_access_token(
            user_id=user.id,
            email=user.email,
            wallet_address=clean_wallet,
            roles=roles,
            permissions=permissions
        )
        parsed_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        jti = parsed_payload.get("jti", secrets.token_hex(16))

        user_session = UserSession(
            user_id=user.id,
            token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
            ip_address=ip_address,
            user_agent=user_agent,
            auth_method="siwe",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        session.add(user_session)

        audit = AuditLog(
            actor_id=user.id,
            action="SIWE_AUTH_SUCCESS",
            resource_type="auth",
            resource_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"wallet_address": clean_wallet, "chain_id": chain_id}
        )
        session.add(audit)
        await session.commit()

        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "wallet_address": clean_wallet,
            "roles": roles,
            "permissions": permissions,
            "session_id": user_session.id
        }

    async def get_user_roles_and_permissions(self, session: AsyncSession, user_id: str) -> Tuple[List[str], List[str]]:
        """Retrieves aggregated roles and granular permissions for a user from DB."""
        stmt = select(UserRole).where(UserRole.user_id == user_id)
        res = await session.execute(stmt)
        user_roles = res.scalars().all()

        roles = []
        permission_set = set()

        for ur in user_roles:
            role = ur.role
            roles.append(role.name)
            for rp in role.role_permissions:
                permission_set.add(rp.permission.name)

        if not roles:
            roles = ["USER"]

        return roles, sorted(list(permission_set))

    async def revoke_user_session(self, session: AsyncSession, user_id: str, session_id: str, jti: str) -> None:
        """Revokes a specific session and blacklists its JTI token in Redis."""
        stmt = select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
        res = await session.execute(stmt)
        user_session = res.scalar_one_or_none()

        if user_session:
            user_session.is_revoked = True
            await session.commit()

        if jti:
            await redis_service.blacklist_token(jti, ttl=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    async def revoke_all_user_sessions(self, session: AsyncSession, user_id: str) -> None:
        """Revokes all active sessions for a user (e.g. after password change)."""
        stmt = select(UserSession).where(UserSession.user_id == user_id, UserSession.is_revoked == False)
        res = await session.execute(stmt)
        sessions = res.scalars().all()

        for s in sessions:
            s.is_revoked = True
            if s.token_hash:
                await redis_service.blacklist_token(s.token_hash, ttl=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

        await session.commit()

auth_service = AuthService()
