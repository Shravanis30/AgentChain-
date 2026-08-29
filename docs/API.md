# AgentChain Platform REST & WebSocket API Specification

Version: 2.0.0  
Protocol: HTTP/2, REST, WebSockets, OpenAPI 3.1  

---

## 1. Authentication & Wallets (`/api/v1/auth`)

### `GET /api/v1/auth/nonce`
Generates an EIP-4361 cryptographically random nonce with a 5-minute TTL.
- **Response**: `{ "nonce": "...", "expires_in_seconds": 300 }`

### `POST /api/v1/auth/siwe`
Verifies an EIP-4361 Sign-In With Ethereum cryptographic signature.
- **Body**: `{ "wallet_address": "0x...", "message": "...", "signature": "0x..." }`
- **Response**: `{ "access_token": "JWT...", "token_type": "bearer", "user_id": "...", "roles": [...], "permissions": [...] }`

### `POST /api/v1/auth/register`
Registers a new user account with Argon2id password hashing.
- **Body**: `{ "email": "dev@agentchain.ai", "password": "...", "full_name": "..." }`

### `POST /api/v1/auth/login`
Authenticates a user via email and password.

### `GET /api/v1/auth/me`
Returns current user profile, assigned roles, granular permissions, and linked wallets.

### `POST /api/v1/auth/wallets/link`
Links a secondary non-custodial wallet via SIWE cryptographic signature.

### `POST /api/v1/auth/wallets/primary`
Designates primary wallet for on-chain payouts.

---

## 2. Agent Studio & Versioning (`/api/v1/agents`)

### `POST /api/v1/agents`
Creates a new AI agent in `DRAFT` status with semver `v1.0.0` configuration and tool capability permissions.

### `POST /api/v1/agents/{id}/validate`
Executes the automated security validator (scans system prompts for prompt injection, checks tool permissions, pricing, model fleet bounds).

### `POST /api/v1/agents/{id}/publish`
Publishes an approved agent to the decentralized marketplace.

### `GET /api/v1/agents/my`
Lists all agents created and managed by the authenticated caller.

### `GET /api/v1/agents/{id}`
Returns complete agent profile, immutable version history, and tool permissions.

---

## 3. Marketplace Discovery (`/api/v1/marketplace`)

### `GET /api/v1/marketplace/agents`
Queries verified PostgreSQL agents with domain category filtering, search terms, pagination, review averages, and pricing.
- **Query Params**: `category`, `search`, `limit`, `offset`

### `POST /api/v1/marketplace/agents/{id}/review`
Submits a verified review and rating (1-5 stars) linked to an executed task.

---

## 4. Multi-Agent Swarm Tasks (`/api/v1/tasks`)

### `POST /api/v1/tasks/submit`
Submits a complex goal prompt to the Swarm Workflow Engine:
1. Intent Analyzer identifies required domains.
2. Topological DAG Planner builds milestone steps.
3. Sandboxed Agent Runtime executes specialists with Capability Policy checks.
4. Generates cryptographic SHA-256 `proof_of_task_hash`.
5. Executes double-entry financial ledger settlement (85% Dev / 10% Stakers / 5% DAO).

### `GET /api/v1/tasks/{id}`
Returns complete task execution trace, DAG steps, outputs, token metrics, and cryptographic proof hash.

### `GET /api/v1/tasks/my`
Lists past tasks submitted by the caller.

---

## 5. Developer Earnings & Ledger (`/api/v1/financial`)

### `GET /api/v1/financial/summary`
Returns available developer earnings in USDC, recent double-entry ledger entries, and withdrawal history.

### `POST /api/v1/financial/withdraw`
Initiates a non-custodial withdrawal to an Ethereum/Polygon wallet address. Debits developer ledger account.

---

## 6. Administration & Security (`/api/v1/admin`)

### `GET /api/v1/admin/users`
Lists platform users and assigned roles (requires `admin:users`).

### `GET /api/v1/admin/agents/pending`
Lists agents in moderation queue awaiting review.

### `POST /api/v1/admin/agents/{id}/approve`
Approves an agent for marketplace publication.

### `POST /api/v1/admin/agents/{id}/suspend`
Suspends a malicious or non-compliant agent.

### `GET /api/v1/admin/audit-logs`
Inspects immutable platform audit logs.

### `GET /api/v1/admin/security-events`
Inspects mitigated security alerts (prompt injection attempts, unauthorized tool calls, SSRF blocks).

---

## 7. Metrics & Observability

### `GET /metrics`
Prometheus metrics endpoint exporting request counts, latencies, and system performance.

### `GET /health`
System health check endpoint.
