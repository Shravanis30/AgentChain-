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

class FaucetRequestSchema(BaseModel):
    wallet_address: str

@router.post("/faucet")
async def claim_testnet_faucet(
    req: FaucetRequestSchema,
    user: User = Depends(get_current_user),
):
    """Dispenses 0.02 testnet POL from the platform deployer wallet to the user's wallet address."""
    from web3 import Web3
    from eth_account import Account
    from backend.config import settings

    deployer_key = settings.DEPLOYER_PRIVATE_KEY
    if not deployer_key:
        raise HTTPException(status_code=500, detail="Platform deployer key not configured.")

    rpc_url = settings.POLYGON_RPC_URL or "https://polygon-amoy-bor-rpc.publicnode.com"
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise HTTPException(status_code=503, detail="Unable to connect to Polygon Amoy RPC.")

    try:
        acct = Account.from_key(deployer_key)
        target = Web3.to_checksum_address(req.wallet_address)
        balance = w3.eth.get_balance(acct.address)
        amount_wei = w3.to_wei(0.02, 'ether')

        gas_price = w3.eth.gas_price
        gas_limit = 21000
        if balance < (amount_wei + gas_price * gas_limit):
            raise HTTPException(status_code=400, detail="Faucet reserve temporarily exhausted.")

        tx = {
            'nonce': w3.eth.get_transaction_count(acct.address),
            'to': target,
            'value': amount_wei,
            'gas': gas_limit,
            'gasPrice': gas_price,
            'chainId': settings.CHAIN_ID or 80002
        }
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        hex_hash = tx_hash.hex()
        if not hex_hash.startswith("0x"):
            hex_hash = f"0x{hex_hash}"

        return {
            "success": True,
            "amount_pol": 0.02,
            "recipient": target,
            "tx_hash": hex_hash,
            "explorer_url": f"https://amoy.polygonscan.com/tx/{hex_hash}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Faucet transfer failed: {str(e)}")
