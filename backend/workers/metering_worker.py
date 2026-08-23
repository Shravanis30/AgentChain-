import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from backend.db.session import AsyncSessionLocal
from backend.db.models import WorkspaceContainer, WorkspaceUsageRecord, utc_now

logger = logging.getLogger("agentchain.metering_worker")

class MeteringWorker:
    """Enterprise Metering Worker process calculating running workspace lease usage."""

    def __init__(self, interval_seconds: int = 10):
        self.interval_seconds = interval_seconds
        self.is_running = False
        self.total_ticks = 0

    async def run(self):
        self.is_running = True
        logger.info(f"[MeteringWorker] Started workspace metering worker (interval: {self.interval_seconds}s)")

        while self.is_running:
            try:
                await self.tick()
            except Exception as e:
                logger.error(f"[MeteringWorker] Exception during metering tick: {e}")

            await asyncio.sleep(self.interval_seconds)

    async def tick(self):
        self.total_ticks += 1
        now = utc_now()
        start_ts = now - timedelta(seconds=self.interval_seconds)

        async with AsyncSessionLocal() as session:
            stmt = select(WorkspaceContainer).where(WorkspaceContainer.status == "RUNNING")
            res = await session.execute(stmt)
            workspaces = res.scalars().all()

            for ws in workspaces:
                ws.uptime_seconds += self.interval_seconds

                # Rate calculation based on mode
                hourly_rate = float(ws.rate_usdc)
                billed_amount = (hourly_rate / 3600.0) * self.interval_seconds
                platform_fee = billed_amount * 0.02 # 2% platform commission

                usage_rec = WorkspaceUsageRecord(
                    workspace_id=ws.id,
                    owner_id=ws.owner_id,
                    billing_period_start=start_ts,
                    billing_period_end=now,
                    elapsed_seconds=self.interval_seconds,
                    pricing_mode=ws.pricing_mode,
                    billed_amount_usdc=round(billed_amount, 6),
                    platform_fee_usdc=round(platform_fee, 6),
                )
                session.add(usage_rec)

            await session.commit()
            logger.debug(f"[MeteringWorker] Processed metering tick for {len(workspaces)} active workspaces.")

    def stop(self):
        self.is_running = False
        logger.info("[MeteringWorker] Metering worker stopped.")

metering_worker = MeteringWorker()
