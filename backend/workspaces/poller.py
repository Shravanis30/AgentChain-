import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select

from backend.db.session import async_session_factory
from backend.db.models import WorkspaceContainer, WorkspaceLease, utc_now
from backend.workspaces.lifecycle import lifecycle_manager

logger = logging.getLogger("agentchain.workspaces.poller")

class WorkspacePoller:
    """Background worker reconciling container states and enforcing lease duration auto-stops."""

    def __init__(self, interval_seconds: int = 30):
        self.interval_seconds = interval_seconds
        self.is_running = False
        self._task: asyncio.Task = None

    async def start(self):
        """Starts the background polling loop."""
        if self.is_running:
            return
        self.is_running = True
        logger.info(f"[WorkspacePoller] Starting background poller loop (every {self.interval_seconds}s)")
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """Stops the background poller loop."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[WorkspacePoller] Background poller loop stopped.")

    async def _run_loop(self):
        while self.is_running:
            try:
                await self.poll_workspaces()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[WorkspacePoller] Error during poll iteration: {e}")

            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    async def poll_workspaces(self):
        """Check all 'RUNNING' workspaces against real Docker status and paid lease durations."""
        async with async_session_factory() as session:
            stmt = select(WorkspaceContainer).where(WorkspaceContainer.status == "RUNNING")
            res = await session.execute(stmt)
            workspaces = res.scalars().all()

            if not workspaces:
                return

            now = utc_now()

            for ws in workspaces:
                container_id = ws.docker_container_id
                if not container_id:
                    continue

                # 1. Query real Docker status
                inspection = lifecycle_manager.inspect_container(container_id)
                real_status = inspection.get("status", "STOPPED")

                # If container exited or died outside of app control
                if real_status != "RUNNING":
                    logger.info(
                        f"[WorkspacePoller] Workspace {ws.id} container {container_id[:12]} "
                        f"no longer running (real status: {real_status}). Updating DB."
                    )
                    ws.status = real_status
                    await session.commit()
                    continue

                # 2. Check duration limits and auto-stop if expired
                has_expired = False
                reason = ""

                # Check fixed duration days (CUSTOM_FLAT)
                c_at = ws.created_at if getattr(ws.created_at, "tzinfo", None) else ws.created_at.replace(tzinfo=timezone.utc)
                if ws.pricing_mode == "CUSTOM_FLAT" and ws.flat_duration_days:
                    expiry = c_at + timedelta(days=ws.flat_duration_days)
                    if now >= expiry:
                        has_expired = True
                        reason = f"Fixed flat duration of {ws.flat_duration_days} days reached"

                # Check active leases
                lease_stmt = (
                    select(WorkspaceLease)
                    .where(WorkspaceLease.workspace_id == ws.id)
                    .order_by(WorkspaceLease.created_at.desc())
                )
                lease_res = await session.execute(lease_stmt)
                latest_lease = lease_res.scalars().first()

                if latest_lease and latest_lease.status == "ACTIVE":
                    lease_c_at = latest_lease.created_at if getattr(latest_lease.created_at, "tzinfo", None) else latest_lease.created_at.replace(tzinfo=timezone.utc)
                    lease_expiry = lease_c_at + timedelta(hours=latest_lease.duration_hours)
                    if now >= lease_expiry:
                        latest_lease.status = "COMPLETED"
                        has_expired = True
                        reason = f"Lease period ({latest_lease.duration_hours}h) completed"

                if has_expired:
                    logger.info(
                        f"[WorkspacePoller] Auto-stopping expired workspace {ws.id} "
                        f"({container_id[:12]}): {reason}"
                    )
                    lifecycle_manager.stop_container(container_id, remove=True)
                    ws.status = "STOPPED"
                    await session.commit()

            await session.commit()

workspace_poller = WorkspacePoller(interval_seconds=30)
