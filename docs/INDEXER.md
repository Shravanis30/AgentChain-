# AgentChain: Blockchain Event Indexer Architecture

## 1. Event Indexer Specification

The `BlockchainIndexerService` ([`backend/blockchain/indexer.py`](file:///Users/shravani/Desktop/AgentChain/backend/blockchain/indexer.py)) is an asynchronous background service responsible for monitoring on-chain smart contract events and projecting confirmed state changes into the PostgreSQL database.

---

## 2. Event Log Mapping

| On-Chain Solidity Event | Monitored Topic Hash | Database Action & Projections |
|---|---|---|
| `EscrowLocked(bytes32,address,address,uint256,uint256)` | `0x6a10...` | Transitions Escrow to `FUNDED`; records `deposit_tx_hash` and `deposit_block_number`. |
| `EscrowSettled(bytes32,address,bytes32,uint256,uint256,uint256)` | `0xa621...` | Transitions Escrow to `SETTLED`; records `settlement_tx_hash`; executes double-entry 85/10/5 ledger credit. |
| `EscrowRefunded(bytes32,address,uint256,string)` | `0x19f2...` | Transitions Escrow to `REFUNDED`; records `refund_tx_hash` and `refund_block_number`. |
| `DisputeRaised(bytes32,address,string)` | `0x7d49...` | Transitions Escrow to `DISPUTED`. |
| `DisputeResolved(bytes32,uint8,uint256)` | `0x3c2e...` | Transitions Escrow to `REFUNDED` or `SETTLED`. |

---

## 3. Resilience & Security Mechanisms

### 3.1 Confirmation Depth Tracking
- Events in blocks higher than `latest_block - CONFIRMATION_DEPTH` remain unconfirmed.
- Indexer queries `get_logs` only up to `safe_block = latest_block - CONFIRMATION_DEPTH`.

### 3.2 Chain Reorganization Protection
- Caches block hashes for the last `REORG_LIMIT` blocks.
- If block hash at height `N-1` changes between polling cycles, indexer detects reorg, logs an alert, and rolls back `IndexerState.last_processed_block` by `REORG_LIMIT` blocks to re-scan canonical chain logs.

### 3.3 Event Replay & Duplicate Protection
- Event logs are processed idempotently based on `(chain_id, block_number, transaction_hash, log_index)`.
- Re-delivering an already-processed event log produces zero state change or double-ledger entry.

### 3.4 RPC Fault Tolerance
- Retries failed RPC calls using exponential backoff (`2^attempt` seconds up to 60s max).
- Automatically resumes from `IndexerState.last_processed_block` stored in PostgreSQL after process restarts or RPC outages.
