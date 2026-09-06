import logging
import time
from typing import Dict, Any, Optional
from docker.errors import NotFound, APIError

from backend.workspaces.docker_client import get_docker_client, ensure_base_image

logger = logging.getLogger("agentchain.workspaces.lifecycle")

# Hard resource limits per tier (H1 & H3)
TIER_RESOURCE_LIMITS: Dict[str, Dict[str, Any]] = {
    "SMALL": {
        "cpus": 1.0,
        "nano_cpus": 1_000_000_000,
        "mem_limit": "512m",
        "mem_mb": 512,
        "specs": "1 vCPU • 512 MB RAM",
    },
    "MEDIUM": {
        "cpus": 2.0,
        "nano_cpus": 2_000_000_000,
        "mem_limit": "1024m",
        "mem_mb": 1024,
        "specs": "2 vCPU • 1024 MB RAM",
    },
    "LARGE": {
        "cpus": 2.0,
        "nano_cpus": 2_000_000_000,
        "mem_limit": "1536m",
        "mem_mb": 1536,
        "specs": "2 vCPU • 1536 MB RAM",
    },
}

class WorkspaceLifecycleManager:
    """Manages creation, status polling, and teardown of single-host Docker workspace containers."""

    def __init__(self):
        self.default_base_image = "alpine:latest"

    def provision_container(
        self,
        workspace_id: str,
        agent_id: str,
        resource_tier: str = "MEDIUM",
        pricing_mode: str = "PER_HOUR",
        rate_usdc: float = 15.00,
        image_tag: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Provisions and runs a sandboxed Docker container for an agent."""
        client = get_docker_client()
        tier_upper = resource_tier.upper()
        limits = TIER_RESOURCE_LIMITS.get(tier_upper, TIER_RESOURCE_LIMITS["MEDIUM"])

        container_name = f"agentchain-ws-{workspace_id[:12]}"

        # Remove existing container with the same name if dangling
        try:
            existing = client.containers.get(container_name)
            logger.warning(f"[Lifecycle] Cleaning up existing container {container_name}")
            try:
                existing.stop(timeout=2)
            except Exception:
                pass
            existing.remove(force=True)
        except NotFound:
            pass
        except Exception as e:
            logger.warning(f"[Lifecycle] Note during cleanup check: {e}")

        # Determine container image: use agent's build image or fallback to alpine base
        runtime_image = self.default_base_image
        if image_tag:
            try:
                client.images.get(image_tag)
                runtime_image = image_tag
            except Exception:
                logger.info(f"[Lifecycle] Image {image_tag} not found locally, falling back to base image.")
                runtime_image = ensure_base_image(self.default_base_image)
        else:
            runtime_image = ensure_base_image(self.default_base_image)

        # Agent execution command: starts runtime keepalive loop
        runtime_cmd = [
            "/bin/sh",
            "-c",
            f"echo '[AgentChain Runtime] Container initialized for Agent {agent_id} (Workspace {workspace_id})'; "
            f"echo '[AgentChain Runtime] Allocated {limits['specs']}'; "
            f"trap 'exit 0' SIGTERM SIGINT; "
            f"while true; do sleep 2; done",
        ]

        # Environment configuration
        environment = {
            "AGENTCHAIN_WORKSPACE_ID": workspace_id,
            "AGENTCHAIN_AGENT_ID": agent_id,
            "AGENTCHAIN_TIER": tier_upper,
            "AGENTCHAIN_PRICING_MODE": pricing_mode,
            "AGENTCHAIN_RATE_USDC": str(rate_usdc),
        }

        # Labels for tracking
        labels = {
            "agentchain.workspace": "true",
            "agentchain.workspace_id": workspace_id,
            "agentchain.agent_id": agent_id,
            "agentchain.resource_tier": tier_upper,
        }

        logger.info(
            f"[Lifecycle] Launching container '{container_name}' (Image: {runtime_image}, "
            f"CPUs: {limits['cpus']}, Memory: {limits['mem_limit']}, unprivileged, restricted network)"
        )

        try:
            container = client.containers.run(
                image=runtime_image,
                command=runtime_cmd,
                name=container_name,
                detach=True,
                environment=environment,
                labels=labels,
                # H3 Security & Isolation Constraints:
                privileged=False,
                security_opt=["no-new-privileges:true"],
                network_mode="bridge",
                mem_limit=limits["mem_limit"],
                nano_cpus=limits["nano_cpus"],
                restart_policy={"Name": "no"},
            )

            # Wait briefly for status to reflect
            container.reload()
            status = container.status.upper()
            if status == "RUNNING":
                status = "RUNNING"

            return {
                "container_id": container.id,
                "container_short_id": container.short_id,
                "container_name": container_name,
                "status": status,
                "image": runtime_image,
                "resource_tier": tier_upper,
                "ram_usage_mb": limits["mem_mb"],
                "created_at": time.time(),
            }

        except Exception as e:
            logger.error(f"[Lifecycle] Failed to start container for workspace {workspace_id}: {e}")
            raise RuntimeError(f"Docker container launch failed: {e}")

    def inspect_container(self, container_id: str) -> Dict[str, Any]:
        """Poll the container's real status via the Docker SDK (running/exited/error)."""
        if not container_id:
            return {"status": "STOPPED", "running": False, "uptime_seconds": 0, "cpu_usage_percent": 0.0}

        client = get_docker_client()
        try:
            container = client.containers.get(container_id)
            state = container.attrs.get("State", {})
            raw_status = container.status.lower()

            is_running = state.get("Running", False)
            exit_code = state.get("ExitCode", 0)

            if is_running:
                mapped_status = "RUNNING"
            elif exit_code == 0:
                mapped_status = "STOPPED"
            else:
                mapped_status = "ERROR"

            return {
                "status": mapped_status,
                "raw_status": raw_status,
                "running": is_running,
                "exit_code": exit_code,
                "started_at": state.get("StartedAt"),
                "finished_at": state.get("FinishedAt"),
                "container_id": container.id,
            }

        except NotFound:
            return {"status": "STOPPED", "running": False, "exit_code": 0, "not_found": True}
        except Exception as e:
            logger.warning(f"[Lifecycle] Error inspecting container {container_id}: {e}")
            return {"status": "ERROR", "running": False, "error": str(e)}

    def stop_container(self, container_id: str, remove: bool = True) -> bool:
        """Gracefully stop and optionally remove a workspace container."""
        if not container_id:
            return True

        client = get_docker_client()
        try:
            container = client.containers.get(container_id)
            logger.info(f"[Lifecycle] Stopping container {container_id[:12]}...")
            try:
                container.stop(timeout=5)
            except Exception as e:
                logger.warning(f"[Lifecycle] Force stopping container {container_id[:12]}: {e}")
                container.kill()

            if remove:
                try:
                    container.remove(force=True)
                    logger.info(f"[Lifecycle] Container {container_id[:12]} removed.")
                except Exception as e:
                    logger.warning(f"[Lifecycle] Could not remove container {container_id[:12]}: {e}")

            return True

        except NotFound:
            logger.info(f"[Lifecycle] Container {container_id[:12]} already terminated/not found.")
            return True
        except Exception as e:
            logger.error(f"[Lifecycle] Failed to stop container {container_id}: {e}")
            return False

    def get_container_logs(self, container_id: str, tail: int = 100) -> str:
        """Fetch stdout and stderr output logs from container."""
        if not container_id:
            return ""

        client = get_docker_client()
        try:
            container = client.containers.get(container_id)
            raw_logs = container.logs(tail=tail, stdout=True, stderr=True)
            return raw_logs.decode("utf-8", errors="replace")
        except NotFound:
            return "[Container no longer exists]"
        except Exception as e:
            return f"[Error fetching logs: {e}]"


lifecycle_manager = WorkspaceLifecycleManager()
