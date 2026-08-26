import hashlib
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

class TaskIntentAnalyzer:
    """Classifies user objective and identifies required multi-agent domains."""

    @staticmethod
    def analyze(prompt: str) -> Dict[str, Any]:
        prompt_lower = prompt.lower()
        domains = []

        if any(w in prompt_lower for w in ["research", "search", "paper", "find", "analyze", "literature", "trends"]):
            domains.append("research")
        if any(w in prompt_lower for w in ["code", "build", "python", "typescript", "react", "api", "function", "backend", "fullstack"]):
            domains.append("coding")
        if any(w in prompt_lower for w in ["finance", "budget", "cost", "token", "defi", "yield", "crypto", "staking"]):
            domains.append("finance")
        if any(w in prompt_lower for w in ["legal", "contract", "compliance", "terms", "license"]):
            domains.append("legal")
        if any(w in prompt_lower for w in ["deploy", "docker", "k8s", "kubernetes", "terraform", "ci/cd", "infra"]):
            domains.append("devops")
        if any(w in prompt_lower for w in ["sec", "security", "vulnerability", "audit", "pentest", "auth"]):
            domains.append("security")

        if not domains:
            domains = ["research", "coding"]

        return {
            "intent": "autonomous_multi_agent_swarm",
            "detected_domains": domains,
            "complexity_score": min(len(domains) * 20, 100),
            "estimated_token_budget": len(domains) * 2500,
            "required_domains": domains
        }

class TopologicalDAGPlanner:
    """Builds a Directed Acyclic Graph (DAG) of subtask milestones with explicit dependencies."""

    @staticmethod
    def construct_dag(analysis: Dict[str, Any], user_prompt: str) -> List[Dict[str, Any]]:
        domains = analysis.get("detected_domains", ["research", "coding"])
        dag_steps = []

        step_descriptions = {
            "research": ("Market & Technical Research", f"Gather foundational research, verify requirements, and evaluate architecture for: {user_prompt}"),
            "coding": ("System Architecture & Implementation", f"Synthesize robust, type-safe implementation code fulfilling goal: {user_prompt}"),
            "finance": ("Tokenomics & Financial Modeling", f"Model budget allocations, revenue mechanics, and token expenditure for: {user_prompt}"),
            "security": ("Cybersecurity Audit & Static Analysis", f"Conduct vulnerability scanning and security posture validation for: {user_prompt}"),
            "devops": ("Containerization & CI/CD Infrastructure", f"Synthesize deployment manifests, Dockerfile, and pipeline for: {user_prompt}"),
            "legal": ("Regulatory & Compliance Audit", f"Verify terms of service, IP safety, and compliance bounds for: {user_prompt}")
        }

        for idx, domain in enumerate(domains, start=1):
            title, input_prompt = step_descriptions.get(domain, (f"Execute {domain.capitalize()}", f"Execute context for {domain}: {user_prompt}"))
            step_id = f"step_{idx}_{domain}"
            dependencies = [dag_steps[idx - 2]["step_id"]] if idx > 1 else []

            dag_steps.append({
                "step_id": step_id,
                "step_order": idx,
                "domain": domain,
                "title": title,
                "input_prompt": input_prompt,
                "dependencies": dependencies
            })

        return dag_steps

class ProofOfTaskGenerator:
    """Generates cryptographic proof-of-task execution hashes."""

    @staticmethod
    def generate_proof_hash(
        task_id: str,
        user_prompt: str,
        step_outputs: List[str],
        final_output: str,
        timestamp: Optional[datetime] = None
    ) -> str:
        ts = (timestamp or datetime.now(timezone.utc)).isoformat()
        raw_payload = {
            "task_id": task_id,
            "prompt_hash": hashlib.sha256(user_prompt.encode("utf-8")).hexdigest(),
            "steps_count": len(step_outputs),
            "output_hash": hashlib.sha256(final_output.encode("utf-8")).hexdigest(),
            "timestamp": ts
        }
        serialized = json.dumps(raw_payload, sort_keys=True)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return f"0x{digest}"

dag_planner = TopologicalDAGPlanner()
intent_analyzer = TaskIntentAnalyzer()
proof_generator = ProofOfTaskGenerator()
