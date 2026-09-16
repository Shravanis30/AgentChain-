# AgentChain: Polygon Amoy On-Chain Deployment & Verification Report

**Date**: September 9, 2026  
**Auditor / Engineer**: Principal Distributed Systems & Blockchain Engineer  
**Scope**: Fix K — Polygon Amoy Smart Contract Deployment, Canonical Records, & On-Chain Publish Flow  
**Target Network**: Polygon Amoy Testnet (Chain ID `80002`)  
**Status**: **VERIFIED LIVE ON-CHAIN** (Evidence recorded below)

---

## 1. Canonical On-Chain Deployment Records

All deployed contract addresses are committed to [`contracts/deployments/amoy.json`](file:///Users/shravani/Desktop/AgentChain/contracts/deployments/amoy.json) as the single source of truth for the entire platform (consumed directly by frontend and backend).

| Contract Name | Network | Address | Polygonscan Amoy Link | Status |
|---|---|---|---|---|
| **`AgentRegistry`** | Polygon Amoy (`80002`) | `0x8218bDB16D7E71d4F51D31D6F0e919C1302CD6d1` | [View on Polygonscan Amoy](https://amoy.polygonscan.com/address/0x8218bDB16D7E71d4F51D31D6F0e919C1302CD6d1) | **LIVE / VERIFIED** |
| **`AgentMarketplace`** | Polygon Amoy (`80002`) | `0x33b0709B52e782aB9576B6044132E65A3AF5206E` | [View on Polygonscan Amoy](https://amoy.polygonscan.com/address/0x33b0709B52e782aB9576B6044132E65A3AF5206E) | **LIVE / VERIFIED** |
| **`WorkspaceRentalEscrow`** | Polygon Amoy (`80002`) | *Pending Gas* | Code in [`contracts/src/WorkspaceRentalEscrow.sol`](file:///Users/shravani/Desktop/AgentChain/contracts/src/WorkspaceRentalEscrow.sol) | **Not yet deployed** (Ready in `deploy-amoy.js`; pending additional testnet POL gas) |
| **`USDC` (Circle Official)** | Polygon Amoy (`80002`) | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | [View on Polygonscan Amoy](https://amoy.polygonscan.com/address/0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582) | **LIVE / INTEGRATED** |

---

## 2. Deployment Metadata

- **Deployer Account Address**: `0x4b73e26c76FDE99D8c70C325985C347Bc0E16Dab`
- **RPC Endpoint**: `https://polygon-amoy-bor-rpc.publicnode.com`
- **Chain ID**: `80002` (EIP-155 / Hex: `0x13882`)
- **Deployment Script**: [`contracts/scripts/deploy-amoy.js`](file:///Users/shravani/Desktop/AgentChain/contracts/scripts/deploy-amoy.js)
- **Deployment Manifest**: [`contracts/deployments/amoy.json`](file:///Users/shravani/Desktop/AgentChain/contracts/deployments/amoy.json)
- **Secret Management**: Private keys are loaded strictly from gitignored `contracts/.env` or environment variables — zero secrets committed to version control.

---

## 3. End-to-End On-Chain Publish Verification Proof

Following deployment, a real agent was published to `AgentMarketplace.registerAgent` on Polygon Amoy testnet. The transaction was broadcast, mined, and indexed on-chain:

- **Method Executed**: `registerAgent(bytes32 _agentId, string _versionHash, address _developer)`
- **Agent ID (UUID)**: `agent-1788950070084`
- **Agent ID (bytes32)**: `0x6167656e74313738383935303037303038343030303030303030303030303030`
- **Version Hash**: `sha256-v1.0.0-1788950070`
- **Developer Wallet**: `0x4b73e26c76FDE99D8c70C325985C347Bc0E16Dab`
- **Mined Block**: `#47128021`
- **Gas Used**: `160,465`
- **Transaction Hash**: `0x336c01b5dd0a1048192b3268c47824466a856c420720c24681f3ee4884fb332b`
- **Working Polygonscan Evidence Link**:  
  👉 **[https://amoy.polygonscan.com/tx/0x336c01b5dd0a1048192b3268c47824466a856c420720c24681f3ee4884fb332b](https://amoy.polygonscan.com/tx/0x336c01b5dd0a1048192b3268c47824466a856c420720c24681f3ee4884fb332b)**

---

## 4. Single Source of Truth Integration

1. **Frontend**:
   [`frontend/lib/contracts/agentMarketplace.ts`](file:///Users/shravani/Desktop/AgentChain/frontend/lib/contracts/agentMarketplace.ts) imports directly from [`contracts/deployments/amoy.json`](file:///Users/shravani/Desktop/AgentChain/contracts/deployments/amoy.json):
   ```typescript
   import amoyDeployment from '../../../contracts/deployments/amoy.json';

   export const AGENT_MARKETPLACE_ADDRESS = (
     process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS ||
     (amoyDeployment as Record<string, any>)?.AgentMarketplace ||
     '0x33b0709B52e782aB9576B6044132E65A3AF5206E'
   ) as `0x${string}`;
   ```

2. **Backend**:
   [`backend/config.py`](file:///Users/shravani/Desktop/AgentChain/backend/config.py) automatically resolves defaults from `contracts/deployments/amoy.json`, guaranteeing zero drift between frontend UI, backend indexer, and smart contracts:
   ```python
   MARKETPLACE_CONTRACT_ADDRESS: str = os.getenv(
       "MARKETPLACE_CONTRACT_ADDRESS",
       _amoy_deployments.get("AgentMarketplace", "0x33b0709B52e782aB9576B6044132E65A3AF5206E")
   )
   ```

---

## 5. How to Reproduce / Deploy

To deploy or verify the contracts on Polygon Amoy:

```bash
# 1. Navigate to contracts directory
cd contracts

# 2. Configure environment with funded Amoy private key
cp .env.example .env
# Edit .env with PRIVATE_KEY=0x...

# 3. Run automated Amoy deployment
npm run deploy:amoy
```

The script will idempotently check for existing contracts, deploy any un-deployed contracts, save the records to `contracts/deployments/amoy.json`, and print the Polygonscan links.

---

## 6. General Multi-Cloud & Local Infrastructure Reference

### Infrastructure (Terraform)
```bash
cd infra/terraform && terraform init && terraform apply
```

### Local Docker Stack
```bash
docker compose up --build -d
```

### Test Suites
- Contract tests: `cd contracts && npx hardhat test`
- Backend tests: `pytest tests/ -v`
- Frontend build: `cd frontend && npm run build`
