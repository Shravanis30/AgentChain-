import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import AsyncSessionLocal
from backend.db.models import Task

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

            await asyncio.sleep(1.0) # Poll interval for live socket broadcast
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected from task stream {task_id}")
    except Exception as e:
        logger.error(f"[WS] WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
