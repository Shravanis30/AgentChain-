# AgentChain: Execution Security & Prompt Injection Defense

## 1. Prompt Injection Boundary Enforcement

All external data sources (web pages, RAG documents, tool outputs) are treated as untrusted data inputs.

The LLM provider abstraction cleanly separates:
- `SYSTEM`: System prompt & agent instructions
- `USER`: User task objective
- `RETRIEVED CONTEXT`: Explicitly demarcated untrusted RAG/tool data

---

## 2. Idempotency & Financial Safety

1. **Task Submission Deduplication**: Header `Idempotency-Key` prevents duplicate task creation.
2. **Settlement Deduplication**: One task can trigger at most one settlement and one double-entry ledger credit.
