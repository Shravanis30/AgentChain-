import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from backend.db.models import Base, User
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.orchestrator_service.engine import intent_analyzer, dag_planner, proof_generator
from backend.orchestrator_service.worker import workflow_engine

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as s:
        await bootstrap_roles_and_permissions(s)
        yield s

    await engine.dispose()

def test_intent_analyzer_and_dag_planner():
    prompt = "Build a DeFi yield aggregator smart contract with audit tests and web dashboard"
    analysis = intent_analyzer.analyze(prompt)

    assert analysis["intent"] == "autonomous_multi_agent_swarm"
    assert "coding" in analysis["detected_domains"]
    assert "finance" in analysis["detected_domains"]
    assert "security" in analysis["detected_domains"]

    dag = dag_planner.construct_dag(analysis, prompt)
    assert len(dag) >= 3
    assert dag[0]["step_order"] == 1
    # Second step depends on first
    assert len(dag[1]["dependencies"]) == 1

def test_proof_of_task_generator():
    proof = proof_generator.generate_proof_hash(
        task_id="task_123",
        user_prompt="Analyze market trends",
        step_outputs=["Research findings", "Quantitative report"],
        final_output="Synthesized strategy document"
    )
    assert proof.startswith("0x")
    assert len(proof) == 66  # 0x + 64 hex characters (32 bytes)

@pytest.mark.asyncio
async def test_full_workflow_engine_execution(session: AsyncSession):
    user = User(email="architect@agentchain.ai", full_name="Swarm Architect")
    session.add(user)
    await session.commit()

    prompt = "Audit smart contract security and evaluate token economics"
    task_res = await workflow_engine.create_and_execute_task(
        session=session,
        creator=user,
        title="Smart Contract Security Audit",
        user_prompt=prompt,
        budget_usdc=1.50
    )

    assert task_res["status"] == "COMPLETED"
    assert task_res["proof_of_task_hash"].startswith("0x")
    assert len(task_res["dag_plan"]) >= 2
    assert "final_output" in task_res
    assert task_res["telemetry"]["total_tokens_used"] > 0
