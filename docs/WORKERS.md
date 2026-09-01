# AgentChain: Background Worker Architecture & Atomic Job Leasing

## 1. Job Leasing Specification

Workers coordinate via PostgreSQL transaction locks (`ExecutionJob` table):

```sql
SELECT * FROM execution_jobs
WHERE status = 'QUEUED' OR (status = 'RUNNING' AND lease_expires_at < CURRENT_TIMESTAMP)
ORDER BY created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

### Properties:
- **`lease_owner`**: Identifies worker daemon currently processing the job (e.g. `worker-01`).
- **`lease_expires_at`**: Expiration timestamp (default 30s). If worker crashes, lease expires automatically and another worker re-claims the job.
- **`max_attempts` & Retries**: Jobs retry with exponential backoff up to 3 attempts. Exceeded attempts move job to Dead-Letter Queue (`DLQ`).
