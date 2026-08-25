import hashlib
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.db.models import (
    Task, TaskStep, TaskArtifact, Agent, AgentVersion,
    User, AuditLog, utc_now
)
from backend.orchestrator_service.engine import intent_analyzer, dag_planner, proof_generator
from backend.agent_engine.agents import agent_runtime
from backend.financial.ledger import ledger_service
from backend.memory_service.rag import rag_service

logger = logging.getLogger("agentchain.orchestrator")

class SwarmWorkflowEngine:
    """Durable state machine and execution coordinator for multi-agent swarm tasks."""

    @staticmethod
    async def create_and_execute_task(
        session: AsyncSession,
        creator: User,
        title: str,
        user_prompt: str,
        budget_usdc: float = 1.0,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes end-to-end multi-agent workflow:
        CREATED -> PLANNING -> EXECUTING -> VERIFYING -> SETTLING -> COMPLETED
        """
        # 1. Initialize Task Record
        task = Task(
            title=title,
            user_prompt=user_prompt,
            created_by=creator.id,
            project_id=project_id,
            budget_usdc=budget_usdc,
            status="PLANNING"
        )
        session.add(task)
        await session.flush()

        audit = AuditLog(
            actor_id=creator.id,
            action="TASK_CREATED",
            resource_type="task",
            resource_id=task.id,
            details={"title": title, "budget_usdc": budget_usdc}
        )
        session.add(audit)
        await session.flush()

        # 2. Intent Analysis & DAG Generation
        analysis = intent_analyzer.analyze(user_prompt)
        dag_plan = dag_planner.construct_dag(analysis, user_prompt)

        # Persist DAG steps in DB
        db_steps = []
        for s in dag_plan:
            ts = TaskStep(
                task_id=task.id,
                step_order=s["step_order"],
                title=s["title"],
                domain=s["domain"],
                input_prompt=s["input_prompt"],
                dependencies={"deps": s["dependencies"]},
                status="PENDING"
            )
            session.add(ts)
            db_steps.append(ts)

        await session.flush()

        # 3. Transition to EXECUTING
        task.status = "EXECUTING"
        await session.flush()

        step_outputs = []
        subtask_results = []
        total_tokens_used = 0
        total_latency_ms = 0

        for step in db_steps:
            step.status = "EXECUTING"
            await session.flush()

            # Find or resolve specialized agent for domain
            agent_version = await SwarmWorkflowEngine._resolve_agent_version_for_domain(session, step.domain, creator.id)

            # Retrieve RAG context if applicable
            rag_matches = await rag_service.search_knowledge_context(session, query=step.input_prompt, top_k=2)
            rag_context_str = "\n---\n".join([m["text"] for m in rag_matches]) if rag_matches else None

            # Execute agent version
            exec_res = await agent_runtime.execute_agent_version(
                session=session,
                agent_version_id=agent_version.id,
                task_id=task.id,
                step_id=step.id,
                input_prompt=step.input_prompt,
                rag_context=rag_context_str
            )

            step.status = "COMPLETED"
            step.output_result = exec_res["output_text"]
            step.assigned_agent_id = exec_res["agent_id"]
            step.tokens_used = exec_res["tokens_used"]
            step.latency_ms = exec_res["latency_ms"]
            await session.flush()

            step_outputs.append(exec_res["output_text"])
            subtask_results.append(exec_res)
            total_tokens_used += exec_res["tokens_used"]
            total_latency_ms += exec_res["latency_ms"]

        # 4. Transition to VERIFYING & Synthesis
        task.status = "VERIFYING"
        await session.flush()

        # Synthesize Deliverables
        synthesis_sections = []
        for sr in subtask_results:
            synthesis_sections.append(
                f"## 🤖 {sr['agent_name']} ({sr['category'].upper()})\n\n{sr['output_text']}"
            )
        final_synthesized = "\n\n---\n\n".join(synthesis_sections)

        # Create Task Artifact
        artifact_hash = hashlib.sha256(final_synthesized.encode("utf-8")).hexdigest()
        artifact = TaskArtifact(
            task_id=task.id,
            artifact_name=f"{title.replace(' ', '_')}_Deliverables.md",
            artifact_type="document",
            content=final_synthesized,
            sha256_hash=artifact_hash
        )
        session.add(artifact)

        # 5. Generate Cryptographic Proof of Task
        proof_hash = proof_generator.generate_proof_hash(
            task_id=task.id,
            user_prompt=user_prompt,
            step_outputs=step_outputs,
            final_output=final_synthesized
        )
        task.proof_of_task_hash = proof_hash
        task.final_output = final_synthesized

        # 6. Settle Financial Ledger (85% Dev / 10% Stakers / 5% DAO)
        task.status = "SETTLING"
        await session.flush()

        # Find primary agent developer for payout
        primary_agent_id = subtask_results[0]["agent_id"]
        primary_agent = (await session.execute(select(Agent).where(Agent.id == primary_agent_id))).scalar_one()

        await ledger_service.record_task_settlement(
            session=session,
            task_id=task.id,
            developer_id=primary_agent.owner_id,
            gross_amount_usdc=budget_usdc,
            proof_hash=proof_hash
        )

        # 7. Finalize Task
        task.status = "COMPLETED"
        task.completed_at = utc_now()

        audit_done = AuditLog(
            actor_id=creator.id,
            action="TASK_COMPLETED",
            resource_type="task",
            resource_id=task.id,
            details={"proof_of_task_hash": proof_hash, "total_tokens": total_tokens_used}
        )
        session.add(audit_done)
        await session.commit()

        return {
            "task_id": task.id,
            "title": task.title,
            "status": "COMPLETED",
            "proof_of_task_hash": proof_hash,
            "analysis": analysis,
            "dag_plan": [
                {
                    "step_id": s.id,
                    "step_order": s.step_order,
                    "domain": s.domain,
                    "title": s.title,
                    "status": s.status
                }
                for s in db_steps
            ],
            "subtask_results": subtask_results,
            "final_output": final_synthesized,
            "telemetry": {
                "total_tokens_used": total_tokens_used,
                "total_latency_ms": total_latency_ms,
                "total_cost_usdc": sum(sr.get("cost_usd", 0) for sr in subtask_results)
            }
        }

    @staticmethod
    async def _resolve_agent_version_for_domain(session: AsyncSession, domain: str, fallback_owner_id: str) -> AgentVersion:
        """Finds published agent version for domain or provisions an active system specialist."""
        stmt = select(Agent).where(Agent.category == domain, Agent.status.in_(["PUBLISHED", "APPROVED"]))
        res = await session.execute(stmt)
        agent = res.scalar_one_or_none()

        if not agent:
            # Create system agent for domain
            agent = Agent(
                owner_id=fallback_owner_id,
                name=f"AgentChain {domain.capitalize()} Agent",
                slug=f"system-{domain}-agent",
                description=f"Specialized autonomous AI agent for {domain}.",
                category=domain,
                status="PUBLISHED",
                price_per_call_usdc=0.001
            )
            session.add(agent)
            await session.flush()

            version = AgentVersion(
                agent_id=agent.id,
                version="v1.0.0",
                system_instructions=f"You are a production specialist in {domain}. Deliver rigorous, safe, structured output.",
                model_provider="openai",
                model_name="gpt-4o",
                temperature=0.3,
                max_tokens=4096
            )
            session.add(version)
            await session.flush()
            return version

        return agent.versions[0]

workflow_engine = SwarmWorkflowEngine()
