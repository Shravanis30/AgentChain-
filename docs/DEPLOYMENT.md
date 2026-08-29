# AgentChain Production Deployment Guide

---

## 1. Multi-Cloud AWS & Azure Infrastructure (Terraform)

Deploy infrastructure components using Terraform:

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

Provisioned Resources:
- **AWS EKS Kubernetes 1.30 Cluster** (Multi-AZ auto-scaling node pools)
- **AWS Aurora PostgreSQL 16** (Multi-AZ Relational Database with double-entry ledger persistence)
- **AWS ElastiCache Redis 7 Cluster** (Distributed cache & nonce challenge store)
- **AWS S3 Encrypted Artifact Bucket** (AES-256 encrypted storage for synthesized deliverables)
- **Security Groups & VPC** (Strict subnet isolation between DB, Redis, and EKS pods)

---

## 2. Local Docker Compose Stack

Run the complete multi-service stack locally:

```bash
docker compose up --build -d
```

Services:
- **Backend API Gateway & Web Client**: `http://localhost:8000`
- **PostgreSQL 16**: `localhost:5432`
- **Redis 7**: `localhost:6379`
- **Qdrant Vector Engine**: `localhost:6333`

---

## 3. Database Migrations (Alembic)

Apply database schema migrations:

```bash
# Upgrade database to latest revision
alembic upgrade head
```

---

## 4. Smart Contract Deployment (Polygon Amoy / Ethereum)

Compile, test, and deploy Solidity smart contracts:

```bash
cd contracts
npm install
npx hardhat test
npx hardhat run scripts/deploy.js --network polygonAmoy
```

Contracts Deployed:
- `AgentRegistry.sol`: Sovereign ERC-725/DID agent identity and metadata registry.
- `AgentMarketplace.sol`: Access-controlled escrow settlement contract with 85/10/5 BPS revenue splits, client refund timeouts, and dispute resolution.

---

## 5. Running Test Suites

Run backend tests:
```bash
pytest tests/ -v
```

Run smart contract tests:
```bash
cd contracts && npx hardhat test
```
