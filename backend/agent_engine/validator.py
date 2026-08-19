import re
from typing import Dict, Any, List

SUPPORTED_PROVIDERS = {"openai", "anthropic", "google", "openrouter", "local"}
SUPPORTED_MODELS = {
    "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
    "anthropic": ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
    "google": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    "openrouter": ["meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-chat", "mistralai/codestral-2501"],
    "local": ["llama-3-8b", "mistral-7b"]
}

SUSPICIOUS_PROMPT_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"disregard\s+(the\s+)?system\s+prompt",
    r"you\s+are\s+now\s+in\s+god\s+mode",
    r"exfiltrate",
    r"steal\s+api\s+key",
    r"rm\s+-rf\s+/",
    r"chmod\s+777",
    r"curl\s+.*\s*\|\s*bash",
    r"eval\s*\(",
    r"exec\s*\(",
    r"os\.system\s*\(",
    r"subprocess\.Popen\s*\("
]

class AgentValidator:
    """Automated security and compliance validator for AI agent submissions."""

    @staticmethod
    def validate_agent_configuration(
        name: str,
        category: str,
        system_instructions: str,
        model_provider: str,
        model_name: str,
        price_per_call_usdc: float,
        tool_permissions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        findings = []
        risk_score = 0

        # 1. Check Name and Category
        if not name or len(name.strip()) < 3:
            findings.append({"severity": "HIGH", "message": "Agent name must be at least 3 characters long."})
            risk_score += 30

        valid_categories = {"research", "coding", "finance", "legal", "security", "devops", "data_analysis", "vision", "voice", "general"}
        if category.lower() not in valid_categories:
            findings.append({"severity": "MEDIUM", "message": f"Category '{category}' is invalid. Allowed: {', '.join(valid_categories)}"})
            risk_score += 15

        # 2. Check Pricing
        if price_per_call_usdc < 0:
            findings.append({"severity": "HIGH", "message": "Price per call cannot be negative."})
            risk_score += 30
        elif price_per_call_usdc > 100.0:
            findings.append({"severity": "MEDIUM", "message": "Price per call exceeds platform threshold of $100.00 USDC."})
            risk_score += 20

        # 3. Check Model Provider & Name
        provider_lower = model_provider.lower()
        if provider_lower not in SUPPORTED_PROVIDERS:
            findings.append({"severity": "HIGH", "message": f"Model provider '{model_provider}' is unsupported."})
            risk_score += 35
        else:
            allowed_models = SUPPORTED_MODELS.get(provider_lower, [])
            if allowed_models and model_name not in allowed_models:
                findings.append({"severity": "LOW", "message": f"Model '{model_name}' is not in standard fleet for {model_provider}."})
                risk_score += 10

        # 4. Static Prompt Injection & Malicious Directive Scan
        for pattern in SUSPICIOUS_PROMPT_PATTERNS:
            if re.search(pattern, system_instructions, re.IGNORECASE):
                findings.append({
                    "severity": "CRITICAL",
                    "message": f"Suspicious prompt pattern detected matching '{pattern}'."
                })
                risk_score += 50

        # 5. Tool Permission Risk Checks
        for tp in tool_permissions:
            tool_name = tp.get("tool_name", "")
            shell = tp.get("shell_enabled", False)
            network = tp.get("network_enabled", False)
            fs_write = tp.get("filesystem_write", False)

            if shell:
                findings.append({
                    "severity": "CRITICAL",
                    "message": f"Tool '{tool_name}' requests raw shell execution permissions. Shell execution requires administrative manual audit."
                })
                risk_score += 60

            if network and fs_write:
                findings.append({
                    "severity": "HIGH",
                    "message": f"Tool '{tool_name}' requests both outbound network and filesystem write permissions (high exfiltration risk)."
                })
                risk_score += 30

        passed = risk_score < 50
        return {
            "passed": passed,
            "risk_score": min(risk_score, 100),
            "findings": findings,
            "checks_performed": {
                "static_prompt_scan": True,
                "tool_permissions_check": True,
                "provider_model_validation": True,
                "pricing_policy_check": True
            }
        }

agent_validator = AgentValidator()
