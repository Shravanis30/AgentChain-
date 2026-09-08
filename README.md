# AgentChain 🤖⛓️

> **Production-Grade Decentralized Autonomous AI Workforce Platform & Durable Multi-Agent DAG Orchestration Engine**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/Shravanis30/AgentChain)
[![Python Version](https://img.shields.io/badge/python-3.14%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636.svg)](https://soliditylang.org/)
[![Alembic](https://img.shields.io/badge/Alembic-1.13%2B-red.svg)](https://alembic.sqlalchemy.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

AgentChain is an enterprise-grade platform that connects goal-driven user prompts to autonomous, specialized AI agent swarms. It combines **durable asynchronous DAG workflow orchestration**, **Sign-In with Ethereum (SIWE) cryptographic authentication**, **real LLM provider abstractions with zero-mock enforcement**, and **smart contract escrow settlement (85% Dev / 10% Stakers / 5% DAO)**.

---

## 🌟 Key System Highlights

- ⚡ **Non-Blocking Asynchronous Gateway**: Task submissions (`POST /api/v1/tasks/submit`) return a task ID in `< 50ms` in `QUEUED` state without blocking HTTP request threads.
- 🔁 **Atomic Job Leasing & Worker Resilience**: PostgreSQL-backed job lease queue (`ExecutionJob`) using `FOR UPDATE SKIP LOCKED`. Crashed worker job leases expire automatically and re-lease safely.
- 📐 **Topological DAG Workflow Engine**: Kahn’s algorithm detects circular dependencies (`DAGCycleError`) and validates max node count (20), max depth (10), and max parallelism (5).
- 🔐 **SIWE Cryptographic Authentication**: EIP-4361 Sign-In with Ethereum with Redis-backed single-use 300s TTL nonces, replay protection, and Role-Based Access Control (RBAC).
- 💸 **On-Chain Escrow & Two-Phase Settlement**: Smart contracts lock USDC during execution and automatically distribute proceeds (85% developer payout, 10% stakers, 5% DAO governance) upon cryptographic proof-of-task verification (`0x` 32-byte hash).
- 🏷️ **Agent Studio & Verified Marketplace**: Developer agent creation with semver versioning (`v1.0.0`), static security validator (prompt injection & permission boundaries), admin moderation queue, and verified-purchase reviews.
- 🚫 **Strict Zero-Mock Policy**: No fake LLM responses, dummy token counters, or simulated transaction hashes in production execution paths. Unconfigured API keys fail explicitly with audit logs.

---

## 🏛️ Enterprise System Architecture

```
                                    +-----------------------------------------------+
                                    |     Next.js 14 Client Frontend (/frontend)     |
                                    | - Landing & Verified Agent Marketplace        |
                                    | - Web3 SIWE & Email/Password Authentication   |
                                    | - Developer Dashboard & Agent Studio          |
                                    | - Workspace Runner & GitHub Container Builds  |
                                    | - Admin Console (Disputes, Moderation, Rev)   |
                                    | - On-Chain Contract Publishing & Settlement   |
                                    +-----------------------+-----------------------+
                                                            |
                                                            | REST API / WebSockets
                                                            v
                                    +-----------------------------------------------+
                                    |             FastAPI Gateway Layer             |
                                    | - SIWE Cryptographic Auth & RBAC              |
                                    | - Idempotency Deduplication Engine            |
                                    | - Non-blocking Task Submission                |
                                    +-----------------------+-----------------------+
                                                            |
                                                            v
                                    +-----------------------------------------------+
                                    |          PostgreSQL Transactional DB          |
                                    | - Workflows, Nodes & Edges                    |
                                    | - Execution Jobs (FOR UPDATE SKIP LOCKED)     |
                                    | - Double-Entry Financial Ledger               |
                                    +-----------------------+-----------------------+
                                                            |
                                                            v
                                    +-----------------------------------------------+
                                    |        Background Worker Pool Daemons         |
                                    | - Heartbeats & Job Lease Claims               |
                                    | - Exponential Backoff Retries & DLQ           |
                                    | - Pinned Agent Version Execution              |
                                    +-----------+-----------------------+-----------+
                                                |                       |
                       +------------------------+                       +------------------------+
                       |                                                                         |
                       v                                                                         v
+------------------------------------------+                             +------------------------------------------+
|      Real LLM Provider Abstraction       |                             |      Blockchain & Settlement Layer       |
| - OpenAI (gpt-4o, o1-mini)               |                             | - USDC Escrow Smart Contract             |
| - Anthropic (claude-3-5-sonnet)          |                             | - Two-Phase Settlement Oracle            |
| - Server-Side Token Cost Accounting      |                             | - On-Chain Event Indexer Daemon          |
+------------------------------------------+                             +------------------------------------------+
```

---

## 📦 Feature & Architecture Roadmap

### Phase 1: Database & Core Models
- SQLAlchemy 2.0 async domain models for Users, Agents, Versions, Tasks, Steps, Ledger, Escrows, and Settlements.
- Double-entry financial ledger enforcing strict debit/credit balance integrity.
- Alembic database version control and migration tracking.

### Phase 2: Production Identity, SIWE & RBAC
- EIP-4361 Sign-In with Ethereum with domain, URI, chain ID, and expiration validations.
- Redis-backed 300s TTL nonces with atomic single-use consumption (`GETDEL`).
- Role-Based Access Control (RBAC) with granular permissions (`task:create`, `agent:publish`, `admin:agents`).

### Phase 3: Blockchain, Escrow & On-Chain Settlement
- Hardened Solidity smart contracts (`AgentMarketplace.sol`, `EscrowPayment.sol`).
- Autonomous two-phase Settlement Oracle (`backend/blockchain/oracle.py`).
- Asynchronous block event indexer daemon handling reorgs, RPC retries, and confirmation depth.

### Phase 4: Agent Lifecycle, Studio & Marketplace
- Agent Studio CRUD with semver immutable versioning (`v1.0.0` -> `v1.1.0`).
- Automated static prompt injection and tool permission validator (`backend/agent_engine/validator.py`).
- Admin moderation queue prohibiting owner self-approvals.
- Verified-purchase marketplace reviews (`Task.created_by == user.id` and `Task.status == "COMPLETED"`).

### Phase 5: Durable AI Orchestration & DAG Workflow Engine
- Non-blocking HTTP task submission returning `task_id` in `< 50ms` in `QUEUED` state.
- PostgreSQL-backed job lease queue with atomic locks (`ExecutionJob`) and worker heartbeat tracking (`ExecutionWorker`).
- Topological DAG Builder (`DAGBuilder`) with Kahn's algorithm cycle detection (`DAGCycleError`).
- Production `LLMProvider` abstraction (`OpenAIProvider`, `AnthropicProvider`) with server-side token cost calculation and zero-mock policy.
- WebSocket status streaming (`/api/v1/ws/tasks/{task_id}`).

---

## 🛠️ Tech Stack

- **Frontend Application**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, RainbowKit 2.1, Wagmi 2.12, Viem, TanStack React Query, SIWE
- **Backend Framework**: Python 3.14, FastAPI, Pydantic v2, Uvicorn, WebSockets
- **Database & ORM**: PostgreSQL 16, SQLAlchemy 2.0 (Async), Alembic
- **Caching & Nonce Engine**: Redis 7 (Async redis-py)
- **Smart Contracts**: Solidity 0.8.20, Hardhat, Ethers.js, Web3.py
- **Vector Search & Memory**: Qdrant Vector Engine
- **Observability**: Prometheus client metrics (`/metrics`), Health Gateway (`/health`)

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.11+ (Python 3.14 recommended)
- Node.js 18+ & npm
- PostgreSQL 16 & Redis 7 (or Docker)

---

### Option 1: Local Development Setup

#### Part A: Backend Gateway Setup

##### 1. Clone the Repository
```bash
git clone https://github.com/Shravanis30/AgentChain.git
cd AgentChain
```

##### 2. Create Virtual Environment & Install Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

##### 3. Run Database Migrations
```bash
alembic upgrade head
alembic check
```

##### 4. Backend Environment Configuration
Create a `.env` file in the root directory:
```env
PROJECT_NAME="AgentChain Enterprise"
ENVIRONMENT="development"
DATABASE_URL="sqlite+aiosqlite:///./agentchain.db"
REDIS_URL="redis://localhost:6379/0"
SECRET_KEY="your-super-secret-jwt-key-min-32-chars"
OPENAI_API_KEY="sk-proj-your-openai-api-key"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key"
```

##### 5. Launch the Backend Server
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Backend interfaces:
- **FastAPI OpenAPI Swagger Docs**: `http://localhost:8000/docs`
- **System Metrics (Prometheus)**: `http://localhost:8000/metrics`
- **Health Gateway**: `http://localhost:8000/health`

---

#### Part B: Frontend Next.js Setup

##### 1. Navigate to Frontend Directory
```bash
cd frontend
```

##### 2. Install Node Dependencies
```bash
npm install
```

##### 3. Frontend Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env.local
```

Required frontend environment variables:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of the FastAPI Gateway backend | `http://localhost:8000` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown / WalletConnect Cloud project ID for SIWE & Web3 wallet connection | `3a8170812b534d0ff9d794f19a901d64` |
| `NEXT_PUBLIC_SIWE_DOMAIN` | Domain identifier for EIP-4361 Sign-In with Ethereum signature requests | `localhost:3000` |
| `NEXT_PUBLIC_SIWE_URI` | Origin URI for SIWE verification | `http://localhost:3000` |
| `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS` | Deployed `AgentMarketplace` smart contract address (Polygon Amoy / local Hardhat) | `0x1234567890123456789012345678901234567890` |

##### 4. Launch the Frontend Development Server
```bash
npm run dev
```

The Next.js application will be live at `http://localhost:3000`:
- **Landing & Marketplace**: `http://localhost:3000/marketplace`
- **Authentication**: `http://localhost:3000/login` & `http://localhost:3000/register`
- **Developer Studio & Agent Creation**: `http://localhost:3000/dashboard/agents/new`
- **Workspace Runner & GitHub Builds**: `http://localhost:3000/dashboard/workspaces`
- **Admin Management Console**: `http://localhost:3000/admin`
- **On-Chain Agent Publishing**: `http://localhost:3000/dashboard/agents/[id]/publish`

---

### Option 2: Docker Compose (Full Stack)

Spin up the entire containerized infrastructure (FastAPI, PostgreSQL 16, Redis 7, Qdrant Vector Engine):

```bash
docker compose up --build -d
```
Services:
- **FastAPI Application**: `http://localhost:8000`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`
- **Qdrant Vector DB**: `localhost:6333`

---

## 🧪 Testing & Quality Assurance

AgentChain contains comprehensive automated test suites for Python microservices, frontend production builds, security protections, and Hardhat smart contracts.

### 1. Run Python Pytest Test Suite (76/76 PASS)
```bash
pytest
```
Test Coverage Areas:
- `tests/test_auth_siwe.py`: EIP-4361 message parsing, Redis nonce TTL, replay prevention.
- `tests/test_agents_phase4.py`: Agent lifecycle, semver versioning, IDOR ownership protections.
- `tests/test_marketplace_phase4.py`: Discovery search, filters, verified reviews.
- `tests/test_orchestration_phase5.py`: Asynchronous task submission, idempotency deduplication, task cancellation.
- `tests/test_workflow_phase5.py`: Kahn's algorithm topological sorting, cycle detection, node bounds.
- `tests/test_worker_phase5.py`: Worker heartbeats, atomic job leasing (`SKIP LOCKED`), lease crash recovery.
- `tests/test_llm_provider_phase5.py`: Zero-mock enforcement, provider abstraction, token cost calculation.

### 2. Verify Frontend Production Build & TypeScript Checking
```bash
cd frontend
npm run build
```
Verifies Next.js 14 server/client component boundaries, App Router static generation, and TypeScript type soundness.

### 3. Run Hardhat Smart Contract Tests (5/5 PASS)
```bash
cd contracts
npx hardhat test
```
Verifies USDC escrow locking, 85/10/5 revenue distribution splits, client refund deadlines, and dispute resolution.

### 3. Verify Database Schema Synchronization
```bash
alembic check
```

---

## 🔗 Key API Endpoints

### 🔐 Authentication & SIWE (`/api/v1/auth`)
- `POST /api/v1/auth/siwe/nonce`: Generate cryptographically secure 300s TTL SIWE nonce.
- `POST /api/v1/auth/siwe/verify`: Verify EIP-4361 signature and establish persistent session.
- `POST /api/v1/auth/register`: Email/password registration.
- `POST /api/v1/auth/login`: Email/password authentication.

### 🤖 Agent Studio (`/api/v1/agents`)
- `POST /api/v1/agents`: Create draft agent metadata.
- `POST /api/v1/agents/{id}/versions`: Publish immutable semver version (`v1.0.0`).
- `POST /api/v1/agents/{id}/validate`: Trigger static prompt injection and tool permission validator.
- `POST /api/v1/agents/{id}/publish`: Publish approved agent to marketplace.

### 🛒 Marketplace (`/api/v1/marketplace`)
- `GET /api/v1/marketplace/agents`: Search published agents with category, price, and text filters.
- `POST /api/v1/marketplace/agents/{id}/review`: Submit verified-purchase review.

### ⚡ Durable Orchestration & Tasks (`/api/v1/tasks`)
- `POST /api/v1/tasks/submit`: Submit AI goal task for durable async execution (< 50ms response).
- `POST /api/v1/tasks/{id}/cancel`: Cancel queued/running task and release worker leases.
- `GET /api/v1/tasks/{id}`: Retrieve detailed task steps, proof hashes, and final output deliverables.

### 📡 WebSockets (`/api/v1/ws`)
- `WS /api/v1/ws/tasks/{task_id}`: Real-time durable state update event stream.

---

## 📚 Audit & Architecture Documentation

- [`docs/PRODUCTION_GAP_ANALYSIS.md`](docs/PRODUCTION_GAP_ANALYSIS.md): Repository gap analysis and 19-section engineering specification.
- [`docs/PHASE_2_VERIFICATION.md`](docs/PHASE_2_VERIFICATION.md): SIWE authentication, Redis nonce, and RBAC verification report (40/40 PASS).
- [`docs/PHASE_3_VERIFICATION.md`](docs/PHASE_3_VERIFICATION.md): Smart contract, escrow, and event indexer verification report (20/20 PASS).
- [`docs/PHASE_4_VERIFICATION.md`](docs/PHASE_4_VERIFICATION.md): Agent Studio, validation, and marketplace report (20/20 PASS).
- [`docs/PHASE_5_VERIFICATION.md`](docs/PHASE_5_VERIFICATION.md): Durable AI orchestration & DAG workflow engine audit report (20/20 PASS).
- [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md): Non-blocking asynchronous task execution topology.
- [`docs/WORKERS.md`](docs/WORKERS.md): Background worker heartbeat, atomic job leasing, and crash recovery.
- [`docs/WORKFLOW_ENGINE.md`](docs/WORKFLOW_ENGINE.md): Topological DAG validation and cycle detection rules.
- [`docs/LLM_PROVIDERS.md`](docs/LLM_PROVIDERS.md): LLM provider abstraction & zero-mock policy.
- [`docs/EXECUTION_SECURITY.md`](docs/EXECUTION_SECURITY.md): Security boundary enforcement & prompt injection defense.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
