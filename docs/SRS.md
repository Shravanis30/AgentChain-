# Software Requirements Specification (SRS)
## AgentChain: Decentralized Autonomous AI Workforce Platform & Multi-Agent DAG Orchestration Engine

**Document Version**: 1.0.0  
**Date**: September 2026  
**Status**: Approved / Active  
**Author**: AgentChain Engineering Team  

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document details the functional, non-functional, interface, and architectural requirements for **AgentChain**. AgentChain is an enterprise-grade platform connecting goal-driven user prompts to autonomous, specialized AI agent swarms using durable asynchronous Directed Acyclic Graph (DAG) workflow orchestration, Sign-In with Ethereum (SIWE) cryptographic authentication, and Polygon Amoy smart contract escrow settlement.

### 1.2 Document Conventions
- **MUST / SHALL**: Mandatory requirement.
- **SHOULD**: Recommended requirement.
- **MAY**: Optional requirement.
- Currency definitions:
  - **USDC**: The canonical on-chain settlement token (ERC-20 token, 6 decimal precision).
  - **INR (₹)**: Indian Rupee display conversion format for UI accessibility.

### 1.3 Intended Audience
This document is intended for:
- Academic evaluators, advisors, and project reviewers.
- Smart contract and blockchain auditors.
- Frontend, backend, and infrastructure software engineers.

### 1.4 Scope of the System
AgentChain provides:
1. An asynchronous FastAPI task gateway (`< 50ms` response time).
2. A PostgreSQL-backed durable worker queue using `FOR UPDATE SKIP LOCKED`.
3. A topological DAG orchestration engine executing multi-agent workflows.
4. An on-chain smart contract registry and two-phase escrow settlement system deployed to Polygon Amoy.
5. A live currency display layer presenting figures in Indian Rupees (INR) while preserving on-chain USDC settlement.

---

## 2. Overall Description

### 2.1 Product Perspective
AgentChain bridges decentralized blockchain finance (DeFi) with centralized and decentralized autonomous AI model inference. It operates as a self-contained multi-tier system:
- **Client Tier**: Next.js 14 Web Portal, Agent Studio, and Admin Console.
- **API & Gateway Tier**: FastAPI, EIP-4361 SIWE authentication, Redis nonce store, rate limiting.
- **Orchestration & Compute Tier**: Asynchronous worker pool, Kahn's algorithm DAG validator, Docker workspace runtimes.
- **Blockchain Tier**: Polygon Amoy EVM smart contracts (`AgentRegistry.sol`, `AgentMarketplace.sol`, `USDC`), Settlement Oracle, and event indexer.

### 2.2 Product Functions
- **Task Submission & Decomposition**: Deconstructs user objectives into parallelizable DAG sub-tasks.
- **Agent Marketplace**: Browsing, reviewing, and hiring community-developed AI agents.
- **Escrow Locking**: Pre-funding task cost into `AgentMarketplace.sol` via USDC ERC-20 approval.
- **Two-Phase Settlement**: Upon cryptographic proof-of-task completion, automatically distributes funds (85% developer payout, 10% staking pool, 5% DAO treasury).
- **Workspace Sandboxes**: On-demand Docker container environments with resource isolation and automated reaper cleanup.

### 2.3 User Classes and Characteristics
- **End-User / Client**: Submits tasks, funds escrows, reviews agent outputs.
- **Agent Developer**: Publishes agents to the on-chain registry, sets pricing, receives 85% revenue split.
- **Platform Administrator / DAO**: Moderates disputes, manages agent approvals, oversees platform protocol parameters.

### 2.4 Operating Environment
- **Blockchain**: Polygon Amoy Testnet (Chain ID `80002`) / Polygon Mainnet (Chain ID `137`).
- **Backend Runtime**: Python 3.14+, FastAPI, SQLAlchemy 2.0 Async, Alembic.
- **Frontend Runtime**: Node.js 20+, Next.js 14 (App Router), Tailwind CSS, Viem / Wagmi.
- **Databases**: PostgreSQL 16+, Redis 7+, Qdrant Vector Store.

### 2.5 Design and Implementation Constraints
1. **Monetary values are settled on-chain in USDC; INR figures displayed in the UI are a converted estimate, not a separate settlement currency.**
2. All on-chain escrow operations (`lockTaskEscrow`, `settleTaskEscrow`, `refundExpiredEscrow`) MUST interact strictly with the official USDC contract address using 6-decimal integer units.
3. Client wallets MUST execute an ERC-20 `approve()` transaction before triggering `lockTaskEscrow()`.
4. Zero-Mock Policy: Production inference pipelines SHALL NOT simulate LLM outputs, token usage, or transaction hashes.
5. All DAG executions MUST enforce a maximum node count of 20, maximum depth of 10, and maximum parallelism of 5.
6. Cryptographic authentication MUST strictly conform to EIP-4361 (SIWE) with single-use nonces expiring in 300 seconds.

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- **INR Display & Formatting**: All pricing figures across the Marketplace, Agent Profile, Deploy Workspace, Rental Checkout, Wallet Earnings, and Invoices SHALL display primary amounts in Indian Rupees (`₹`) using Indian numbering formatting (e.g., `₹1,23,456`), alongside secondary canonical USDC equivalents (e.g., `≈ $15.00 USDC`).
- **Currency Tooltip & Disclaimer**: Every pricing component SHALL render an informative disclaimer: *"Estimated INR value at current exchange rate. Settlement occurs on-chain in USDC."*
- **Wallet Connection**: RainbowKit / Viem connection modal supporting MetaMask and browser Web3 wallets.

### 3.2 Software Interfaces
- **Exchange Rate API**: Integration with CoinGecko Simple Price API (`usd-coin`/`inr`) with a 20-minute server-side in-memory cache and automatic fallback to prevent UI disruptions.
- **Blockchain RPC**: EVM JSON-RPC provider (Bor RPC on Polygon Amoy).
- **LLM Providers**: Multi-provider adapters for OpenAI (GPT-4o), Anthropic (Claude 3.5), Google (Gemini 1.5 Pro), and Groq.

---

## 4. System Features & Detailed Requirements

### 4.1 On-Chain Escrow & Split Settlement
- **REQ-ESC-01**: The system shall lock task funds in `AgentMarketplace.sol` upon task submission.
- **REQ-ESC-02**: The system shall require client ERC-20 USDC allowance approval prior to locking.
- **REQ-ESC-03**: Upon task completion verification, the oracle shall trigger `settleTaskEscrow()` with a deterministic 32-byte `keccak256` proof hash.
- **REQ-ESC-04**: Smart contract settlement shall enforce the immutable 85% Developer / 10% Stakers / 5% DAO fee split.

### 4.2 Display-Layer Currency Conversion
- **REQ-CUR-01**: The backend shall provide `GET /api/v1/exchange-rate` returning the cached USD/INR exchange rate and timestamp.
- **REQ-CUR-02**: In the event of upstream API rate limits or network failures, the exchange service shall return the most recent valid cached rate without returning an HTTP 500 error.
- **REQ-CUR-03**: User input for workspace pricing entered in INR shall be converted client-side to canonical USDC before payload submission.

---

## 5. Non-Functional Requirements

### 5.1 Security
- Web3 authentication tokens must be cryptographically signed by the user's private key.
- Escrow deposits cannot be released without matching oracle proof signatures or authorized dispute resolution.

### 5.2 Performance & Scalability
- Task submission API endpoint response time: `< 50ms`.
- Exchange rate cached endpoint response time: `< 10ms`.
- Client DAG rendering: `< 100ms` for 20-node graphs.

### 5.3 Reliability & Fault Tolerance
- In-flight worker leases automatically expire after 300s of heartbeat loss and are re-leased by healthy workers.
- Blockchain transaction submissions include automatic nonce tracking and dynamic EIP-1559 gas fee estimation.
