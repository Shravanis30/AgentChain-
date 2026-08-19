import time
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.models import (
    Agent, AgentVersion, AgentToolPermission,
    Execution, ExecutionEvent, SecurityEvent
)
from backend.agent_engine.policy import policy_engine, PolicyViolationException
from backend.agent_engine.router import llm_router

class AgentRuntime:
    """Sandboxed execution engine for specialized autonomous AI agents."""

    @staticmethod
    async def execute_agent_version(
        session: AsyncSession,
        agent_version_id: str,
        task_id: str,
        step_id: Optional[str],
        input_prompt: str,
        rag_context: Optional[str] = None,
        tool_invocations: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        start_time = time.time()

        # Load agent version and its parent agent & permissions
        stmt = select(AgentVersion).where(AgentVersion.id == agent_version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()

        if not version:
            raise ValueError(f"AgentVersion {agent_version_id} not found.")

        agent = version.agent
        permissions = agent.tool_permissions

        # 1. Execute & Validate any requested tools through Policy Engine
        tool_results = []
        if tool_invocations:
            for tool_call in tool_invocations:
                t_name = tool_call.get("tool_name", "")
                t_args = tool_call.get("arguments", {})
                try:
                    policy_engine.evaluate_tool_call(t_name, t_args, permissions)
                    tool_results.append({
                        "tool": t_name,
                        "status": "ALLOWED",
                        "result": f"Executed tool {t_name} securely."
                    })
                except PolicyViolationException as pve:
                    # Record Security Event
                    sec_event = SecurityEvent(
                        event_type="UNAUTHORIZED_TOOL_CALL",
                        severity="HIGH",
                        raw_payload={"tool": t_name, "args": t_args, "error": str(pve)},
                        mitigated=True
                    )
                    session.add(sec_event)
                    await session.flush()
                    tool_results.append({
                        "tool": t_name,
                        "status": "DENIED",
                        "error": str(pve)
                    })

        # 2. Dispatch LLM Completion
        llm_res = await llm_router.generate_completion(
            model_provider=version.model_provider,
            model_name=version.model_name,
            system_prompt=version.system_instructions,
            user_prompt=input_prompt,
            temperature=float(version.temperature),
            max_tokens=version.max_tokens,
            rag_context=rag_context
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # 3. Persist Execution Record in DB
        execution = Execution(
            task_id=task_id,
            step_id=step_id,
            agent_version_id=version.id,
            model_provider=version.model_provider,
            model_name=version.model_name,
            prompt_tokens=llm_res["prompt_tokens"],
            completion_tokens=llm_res["completion_tokens"],
            total_tokens=llm_res["total_tokens"],
            estimated_cost_usd=llm_res["estimated_cost_usd"],
            duration_ms=duration_ms,
            status="SUCCESS"
        )
        session.add(execution)
        await session.flush()

        # 4. Persist Telemetry Events
        ev1 = ExecutionEvent(
            execution_id=execution.id,
            event_type="LLM_INFERENCE_COMPLETED",
            event_payload={
                "provider": version.model_provider,
                "model": version.model_name,
                "tokens": llm_res["total_tokens"],
                "duration_ms": duration_ms
            }
        )
        session.add(ev1)

        if tool_results:
            ev2 = ExecutionEvent(
                execution_id=execution.id,
                event_type="TOOLS_EVALUATED",
                event_payload={"tools": tool_results}
            )
            session.add(ev2)

        await session.commit()

        return {
            "execution_id": execution.id,
            "agent_id": agent.id,
            "agent_name": agent.name,
            "category": agent.category,
            "version": version.version,
            "output_text": llm_res["output_text"],
            "tool_results": tool_results,
            "tokens_used": llm_res["total_tokens"],
            "latency_ms": duration_ms,
            "cost_usd": llm_res["estimated_cost_usd"]
        }

agent_runtime = AgentRuntime()
