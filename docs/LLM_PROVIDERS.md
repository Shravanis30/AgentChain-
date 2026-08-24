# AgentChain: LLM Provider Abstraction & Zero-Mock Policy

## 1. Zero-Mock LLM Policy

AgentChain strictly forbids mock LLM text generation or fake token counters in production paths.

If a provider API key (`OPENAI_API_KEY`, etc.) is missing or unconfigured:
- Execution raises `UnconfiguredProviderError`.
- Job transitions to `FAILED` with explicit error logging.
- **No dummy responses are fabricated.**

---

## 2. Server-Side Token Cost Accounting

Cost accounting is calculated using exact token rates:
- **`gpt-4o`**: $0.0025 / 1k prompt, $0.0100 / 1k completion tokens
- **`claude-3-5-sonnet`**: $0.0030 / 1k prompt, $0.0150 / 1k completion tokens
