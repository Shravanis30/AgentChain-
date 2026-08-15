# AgentChain: Escrow State Machine & Two-Phase Settlement Specification

## 1. Escrow State Machine

```
              ┌───────────┐
              │  CREATED  │
              └─────┬─────┘
                    │ lockTaskEscrow() + Indexer EscrowLocked
                    ▼
              ┌───────────┐
  ┌───────────┤  FUNDED   ├───────────┐
  │           └─────┬─────┘           │
  │                 │ Task Completed  │ raiseDispute()
  │ refundExpired() │                 │
  ▼                 ▼                 ▼
┌───────────┐ ┌──────────────────┐ ┌───────────┐
│ REFUNDED  │ │SETTLEMENT_PENDING│ │ DISPUTED  │
└───────────┘ └─────┬────────────┘ └─────┬─────┘
                    │                    │ resolveDispute()
                    │ Indexer            ▼
                    │ EscrowSettled┌───────────┐
                    └─────────────►│  SETTLED  │
                                   └───────────┘
```

---

## 2. Two-Phase Financial Settlement Model

To eliminate financial discrepancies, revenue credit is strictly divided into two distinct execution phases:

### Phase A: On-Chain Settlement Submission
1. Task execution completes successfully.
2. Oracle generates deterministic 32-byte proof hash:  
   `proof_hash = keccak256(task_id:agent_id:agent_version:result_digest)`
3. Settlement Oracle signs and broadcasts `settleTaskEscrow(taskId, proofHash)` transaction.
4. Escrow status in PostgreSQL transitions to `SETTLEMENT_PENDING`.
5. **No ledger balances are updated in Phase A.**

### Phase B: Confirmed Indexer Event Credit
1. Blockchain Event Indexer observes on-chain `EscrowSettled` event log.
2. Indexer verifies block confirmation depth >= `CONFIRMATION_DEPTH`.
3. Escrow status in PostgreSQL transitions to `SETTLED`.
4. `FinancialLedgerService.record_task_settlement()` executes double-entry revenue credit:
   - **85%** to Agent Developer balance (`DEVELOPER_EARNINGS`)
   - **10%** to Protocol Staking Pool (`STAKING_POOL`)
   - **5%** to DAO Treasury Vault (`DAO_TREASURY`)

---

## 3. Mathematical Precision & Dust Rules
All revenue splits use exact token smallest units (USDC 6 decimals). Fractional remainders are credited to the DAO Treasury vault to guarantee zero dust loss:
```
dev_payout = (gross * 8500) / 10000
staker_payout = (gross * 1000) / 10000
dao_payout = gross - dev_payout - staker_payout
```
