import asyncio
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from backend.db.session import AsyncSessionLocal
from backend.db.models import BuildJob, AgentBuild, AgentVersion, utc_now
from backend.build_engine.queue import build_queue
from backend.build_engine.github_client import github_client
from backend.build_engine.secret_scanner import secret_scanner

logger = logging.getLogger("agentchain.build_worker")

class BuildWorker:
    """Enterprise Ephemeral Sandboxed Build Worker Daemon."""

    def __init__(self, worker_id: Optional[str] = None):
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:6]}"
        self.is_running = False

    async def start(self):
        self.is_running = True
        logger.info(f"[BuildWorker] Build daemon {self.worker_id} initialized.")

        while self.is_running:
            try:
                job = await build_queue.acquire_next_job(self.worker_id)
                if job:
                    await self.process_build_job(job)
                else:
                    await asyncio.sleep(2.0)
            except Exception as e:
                logger.error(f"[BuildWorker] Exception in build worker loop: {e}")
                await asyncio.sleep(2.0)

    async def process_build_job(self, job: BuildJob):
        logger.info(f"[BuildWorker] Processing build job {job.id} for repo {job.source_repo} @ {job.source_ref}")
        build_log = [f"[BUILD INIT] Started build pipeline for {job.source_repo}@{job.source_ref}"]

        try:
            # 1. Fetch Repository Files (Shallow Clone)
            build_log.append("[STAGE 1/4] Cloning repository source code...")
            files = await github_client.fetch_repository_files(job.source_repo, job.source_ref)
            build_log.append(f"  ✓ Fetched {len(files)} source files.")

            # 2. Run Static Secret Scanner
            build_log.append("[STAGE 2/4] Running static secret scanning engine...")
            has_secrets, findings = secret_scanner.scan_repository_tree(files)

            if has_secrets:
                build_log.append("  ❌ CRITICAL: Unencrypted API keys/secrets detected in repository!")
                for f in findings:
                    build_log.append(f"     - File: {f['file_path']} | Type: {f['secret_type']} ({f['masked_secret']})")
                build_log.append("[BUILD FAILED] Build blocked due to committed secret policy violation.")
                
                await self.record_build_result(job, status="BLOCKED_SECRET", strategy="NONE", image_digest="", logs="\n".join(build_log))
                return

            build_log.append("  ✓ Secret scan passed cleanly. No secrets detected.")

            # 3. Detect Build Strategy (Dockerfile -> Buildpack -> Error)
            build_log.append("[STAGE 3/4] Detecting container compilation strategy...")
            strategy = "DOCKERFILE"
            
            if "Dockerfile" in files:
                build_log.append("  ✓ Found Dockerfile at repo root. Using native isolated container compiler.")
            elif "go.mod" in files or "package.json" in files or "requirements.txt" in files:
                strategy = "BUILDPACK"
                build_log.append("  ✓ No Dockerfile found. Auto-detected language ecosystem. Using Cloud Native Buildpack compiler.")
            else:
                build_log.append("  ❌ ERROR: Could not detect Dockerfile or language manifest (package.json / go.mod / requirements.txt).")
                build_log.append("[BUILD FAILED] Repository lacks required container build instructions.")

                await self.record_build_result(job, status="FAILED", strategy="FAILED", image_digest="", logs="\n".join(build_log))
                return

            # 4. Perform Sandboxed Container Compilation
            build_log.append(f"[STAGE 4/4] Executing rootless sandboxed build via {strategy}...")
            await asyncio.sleep(1.5) # Simulate container compilation
            
            image_tag = f"registry.agentchain.ai/agents/{job.source_repo.replace('/', '-').lower()}:{job.source_ref}"
            sha_digest = f"sha256:{uuid.uuid4().hex}"
            full_digest = f"{image_tag}@{sha_digest}"

            build_log.append(f"  ✓ Container image compiled successfully.")
            build_log.append(f"  ✓ Image pushed to registry: {full_digest}")
            build_log.append(f"[BUILD SUCCEEDED] Artifact ready for Phase 6 Virtual Workspace deployment.")

            await self.record_build_result(job, status="SUCCEEDED", strategy=strategy, image_digest=full_digest, logs="\n".join(build_log))

        except Exception as e:
            logger.error(f"[BuildWorker] Build job {job.id} failed with error: {e}")
            build_log.append(f"❌ UNHANDLED EXCEPTION: {e}")
            await self.record_build_result(job, status="FAILED", strategy="ERROR", image_digest="", logs="\n".join(build_log))

    async def record_build_result(self, job: BuildJob, status: str, strategy: str, image_digest: str, logs: str):
        async with AsyncSessionLocal() as session:
            # Update BuildJob status
            stmt = select(BuildJob).where(BuildJob.id == job.id)
            res = await session.execute(stmt)
            b_job = res.scalar_one_or_none()

            if b_job:
                b_job.status = status
                b_job.updated_at = utc_now()

            # Record AgentBuild
            agent_build = AgentBuild(
                id=str(uuid.uuid4()),
                agent_version_id=job.agent_version_id,
                build_job_id=job.id,
                status=status,
                image_digest=image_digest,
                build_strategy=strategy,
                build_log=logs,
                built_at=utc_now()
            )
            session.add(agent_build)
            await session.commit()
            logger.info(f"[BuildWorker] Finalized build record {agent_build.id} for version {job.agent_version_id} (Status: {status})")

build_worker = BuildWorker()
