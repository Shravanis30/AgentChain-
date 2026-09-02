import asyncio
import logging
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import AsyncSessionLocal
from backend.db.models import Task, WorkspaceContainer
from backend.services.workspace_service import workspace_service

logger = logging.getLogger("agentchain.websockets")

router = APIRouter(prefix="/api/v1/ws", tags=["Real-Time Event Streaming"])

@router.websocket("/tasks/{task_id}")
async def task_status_websocket(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint broadcasting real-time task status updates generated from durable database state.
    """
    await websocket.accept()
    logger.info(f"[WS] Client connected to task stream {task_id}")

    last_status = None

    try:
        while True:
            async with AsyncSessionLocal() as session:
                stmt = select(Task).where(Task.id == task_id)
                res = await session.execute(stmt)
                task = res.scalar_one_or_none()

                if not task:
                    await websocket.send_json({"event": "ERROR", "message": "Task not found."})
                    break

                if task.status != last_status:
                    last_status = task.status
                    await websocket.send_json({
                        "event": "TASK_STATUS_UPDATE",
                        "task_id": task.id,
                        "status": task.status,
                        "proof_of_task_hash": task.proof_of_task_hash,
                        "final_output": task.final_output
                    })

                if task.status in ["COMPLETED", "FAILED", "CANCELLED"]:
                    logger.info(f"[WS] Task {task_id} reached terminal status '{task.status}'. Closing socket.")
                    break

            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected from task stream {task_id}")
    except Exception as e:
        logger.error(f"[WS] WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/workspaces/{workspace_id}")
async def workspace_telemetry_websocket(websocket: WebSocket, workspace_id: str):
    """
    WebSocket endpoint streaming live container CPU/RAM telemetry and uptime status for virtual workspaces.
    """
    await websocket.accept()
    logger.info(f"[WS] Client connected to workspace telemetry stream {workspace_id}")

    try:
        while True:
            telemetry = workspace_service.get_telemetry(workspace_id)
            await websocket.send_json({
                "event": "WORKSPACE_TELEMETRY",
                "workspace_id": workspace_id,
                "status": telemetry.get("status", "RUNNING"),
                "cpu_percent": telemetry.get("cpu_usage_percent", 14.5),
                "ram_mb": telemetry.get("ram_usage_mb", 2048),
                "uptime_seconds": telemetry.get("uptime_seconds", 3600)
            })
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected from workspace stream {workspace_id}")
    except Exception as e:
        logger.error(f"[WS] Workspace WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/builds/{version_id}")
async def build_log_websocket(websocket: WebSocket, version_id: str):
    """
    WebSocket endpoint streaming live container build logs line-by-line to the terminal viewer.
    """
    await websocket.accept()
    logger.info(f"[WS] Client connected to build log stream for version {version_id}")

    try:
        from backend.db.models import AgentBuild
        last_log = ""

        while True:
            async with AsyncSessionLocal() as session:
                stmt = select(AgentBuild).where(AgentBuild.agent_version_id == version_id).order_by(AgentBuild.built_at.desc())
                res = await session.execute(stmt)
                build = res.scalar_one_or_none()

                if build and build.build_log != last_log:
                    last_log = build.build_log
                    await websocket.send_json({
                        "event": "BUILD_LOG_UPDATE",
                        "version_id": version_id,
                        "status": build.status,
                        "image_digest": build.image_digest,
                        "build_strategy": build.build_strategy,
                        "build_log": build.build_log
                    })

                if build and build.status in ["SUCCEEDED", "FAILED", "BLOCKED_SECRET"]:
                    logger.info(f"[WS] Build for version {version_id} reached terminal state '{build.status}'. Closing socket.")
                    break

            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected from build stream {version_id}")
    except Exception as e:
        logger.error(f"[WS] Build WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
