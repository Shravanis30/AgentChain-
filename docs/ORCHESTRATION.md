# AgentChain: Durable AI Orchestration Specification

## 1. Non-Blocking Asynchronous Task Architecture

AgentChain eliminates synchronous in-process LLM workflow execution.

```
Client POST /api/v1/tasks/submit
              │
              ▼ (< 50ms)
    Task Persisted (QUEUED) ────────► Client Receives task_id Immediately
              │
              ▼
   PostgreSQL Lease Queue
              │
              ▼
    Worker Lease Claim
              │
              ▼
    Durable DAG Execution
              │
              ▼
  Verification & Settlement
```

---

## 2. Task Lifecycle State Machine

- **`CREATED`**: Task intent received and idempotency key checked.
- **`QUEUED`**: Workflow and nodes persisted; root execution jobs enqueued into database queue.
- **`PLANNING`**: Topological DAG validation in progress.
- **`RUNNING`**: Worker claims job lease and executes assigned node.
- **`VERIFYING`**: All nodes complete; verifier checks output deliverables and generates 32-byte proof hash.
- **`SETTLING`**: Settlement Oracle submits on-chain escrow settlement transaction.
- **`COMPLETED`**: Finalized state after on-chain indexer confirms settlement.
- **`CANCELLED` / `FAILED`**: Terminal failure/cancellation state.
