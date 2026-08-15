# AgentChain: Real Blockchain Integration Architecture

## 1. Overview & Network Topology

AgentChain integrates on-chain smart contracts deployed on EVM-compatible networks (Polygon Amoy Testnet Chain ID `80002` / Polygon Mainnet Chain ID `137`) with off-chain agent workforce execution services.

```
┌─────────────────────────┐          ┌──────────────────────────┐
│  Client Web3 Wallet     │          │  AgentMarketplace.sol    │
│  (MetaMask / Viem)      ├─────────►│  - lockTaskEscrow()      │
└─────────────────────────┘          └────────────┬─────────────┘
                                                  │ Emits EscrowLocked
                                                  ▼
┌─────────────────────────┐          ┌──────────────────────────┐
│  PostgreSQL Ledger & DB │◄─────────┤  Blockchain Event Indexer│
│  - Escrow (FUNDED)      │          │  (Confirmation Depth: 2) │
└──────────┬──────────────┘          └──────────────────────────┘
           │
           ▼
┌─────────────────────────┐          ┌──────────────────────────┐
│  Task Execution Engine  ├─────────►│  Settlement Oracle       │
│  - Proof-of-Task Hash   │          │  - settleTaskEscrow()    │
└─────────────────────────┘          └──────────────────────────┘
```

---

## 2. Configuration & Fail-Fast Guards

All network and contract parameters are strictly declared in [`backend/config.py`](file:///Users/shravani/Desktop/AgentChain/backend/config.py):

- `CHAIN_ID`: EVM Chain ID (`80002` default).
- `POLYGON_RPC_URL`: JSON-RPC Endpoint.
- `MARKETPLACE_CONTRACT_ADDRESS`: Deployed `AgentMarketplace.sol` address.
- `REGISTRY_CONTRACT_ADDRESS`: Deployed `AgentRegistry.sol` address.
- `SETTLEMENT_ORACLE_PRIVATE_KEY`: Oracle transaction signer private key.
- `CONFIRMATION_DEPTH`: Required block confirmation depth before off-chain ledger credit (`2` testnet, `12` mainnet).
- `REORG_LIMIT`: Maximum reorganization history window (`20` blocks).

---

## 3. Web3 Provider & Transaction Service

1. **`BlockchainProviderService`** ([`backend/blockchain/provider.py`](file:///Users/shravani/Desktop/AgentChain/backend/blockchain/provider.py)):
   - Manages asynchronous HTTP connection pool to EVM JSON-RPC provider.
   - Enforces chain ID verification upon initialization.
   - Retries RPC calls with exponential backoff on network timeouts or HTTP 429 rate limits.

2. **`BlockchainTransactionService`** ([`backend/blockchain/transaction_service.py`](file:///Users/shravani/Desktop/AgentChain/backend/blockchain/transaction_service.py)):
   - Calculates EIP-1559 dynamic gas parameters (`maxFeePerGas`, `maxPriorityFeePerGas`).
   - Manages transaction nonces to prevent transaction collisions or replacement errors.
   - Broadcasts signed transactions and polls for receipts with explicit timeout bounds.
