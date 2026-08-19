# AgentChain: Agent Lifecycle State Machine

## 1. Lifecycle State Machine Topology

```
                  ┌───────────┐
                  │   DRAFT   │
                  └─────┬─────┘
                        │ POST /agents/{id}/validate
                        ▼
                ┌───────────────┐
      ┌─────────┤   VALIDATING  ├─────────┐
      │         └───────┬───────┘         │
      │ Failure         │ Pass            │
      ▼                 ▼                 ▼
┌───────────┐   ┌───────────────┐   ┌───────────┐
│VALIDATION_│   │   VALIDATED   │   │ REJECTED  │
│  FAILED   │   └───────┬───────┘   └───────────┘
└───────────┘           │ POST /submit    ▲
                        ▼                 │ Admin Reject
                ┌───────────────┐         │
                │PENDING_REVIEW ├─────────┘
                └───────┬───────┘
                        │ Admin Approve
                        ▼
                ┌───────────────┐
                │   APPROVED    │
                └───────┬───────┘
                        │ POST /publish
                        ▼
                ┌───────────────┐
                │   PUBLISHED   │◄────────┐
                └───┬───────┬───┘         │
                    │       │             │ Resume
                    │ Pause │ Suspend     │
                    ▼       ▼             │
              ┌─────────┐ ┌───────────┐   │
              │ PAUSED  │ │ SUSPENDED ├───┘
              └─────────┘ └───────────┘
```

---

## 2. State Transition Policies

1. **`DRAFT` -> `VALIDATING` -> `VALIDATED` / `VALIDATION_FAILED`**:
   - Triggered via `POST /api/v1/agents/{id}/validate`. Runs static security validator. Validation results are persisted in `agent_validations`.
2. **`VALIDATED` -> `PENDING_REVIEW`**:
   - Triggered via `POST /api/v1/agents/{id}/submit`. Fails if agent is not in `VALIDATED` state.
3. **`PENDING_REVIEW` -> `APPROVED` / `REJECTED`**:
   - Admin moderation via `POST /api/v1/admin/agents/{id}/approve` or `/reject`. Enforces `admin:agents` permission and **denies owner self-approval**.
4. **`APPROVED` -> `PUBLISHED`**:
   - Owner publishes approved agent to marketplace via `POST /api/v1/agents/{id}/publish`. Sets `published_at` timestamp.
5. **`PUBLISHED` <-> `PAUSED`**:
   - Owner can temporarily pause or resume marketplace listing.
6. **`SUSPENDED`**:
   - Admin suspension via `POST /api/v1/admin/agents/{id}/suspend`. Instantly removes agent from marketplace.
