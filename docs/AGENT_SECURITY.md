# AgentChain: Agent Security & Tool Permission Boundaries

## 1. Tool Permission Policies

Agents must explicitly declare tool capabilities (`AgentToolPermission` model):
- `network_enabled` & `allowed_domains`: Controls outbound HTTP/network access.
- `filesystem_read` & `filesystem_write`: Controls local directory access.
- `shell_enabled`: Controls raw shell process execution (flagged as `CRITICAL` risk by validator).

---

## 2. Security Validator Pipeline

The `AgentValidator` ([`backend/agent_engine/validator.py`](file:///Users/shravani/Desktop/AgentChain/backend/agent_engine/validator.py)) inspects agent configurations prior to submission:
- **Static Prompt Injection Scan**: Detects suspicious prompt patterns (e.g. `ignore previous instructions`, `exfiltrate`, `os.system`).
- **Provider & Model Compliance**: Verifies models against supported provider lists (`openai`, `anthropic`, `google`, `openrouter`).
- **Tool Permission Risk Analysis**: Flags unsafe combinations (e.g., simultaneous shell execution or network + filesystem write permissions).
- **Validation Persistence**: Audit logs and `AgentValidation` records persist risk scores and findings to PostgreSQL.
