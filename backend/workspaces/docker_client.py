import os
import logging
from typing import Optional, Tuple
import docker
from docker.errors import DockerException, ImageNotFound

logger = logging.getLogger("agentchain.workspaces.docker")

_docker_client: Optional[docker.DockerClient] = None

def get_docker_host() -> Optional[str]:
    """Resolve the appropriate Docker daemon URL/socket path."""
    # 1. Explicit DOCKER_HOST environment variable
    if os.environ.get("DOCKER_HOST"):
        return os.environ.get("DOCKER_HOST")

    # 2. Known local unix socket paths (Colima on macOS, Docker Desktop, Linux native)
    candidate_sockets = [
        os.path.expanduser("~/.colima/default/docker.sock"),
        os.path.expanduser("~/.colima/docker.sock"),
        os.path.expanduser("~/.docker/run/docker.sock"),
        "/var/run/docker.sock",
    ]

    for sock in candidate_sockets:
        if os.path.exists(sock):
            return f"unix://{sock}"

    return None


def get_docker_client() -> docker.DockerClient:
    """Obtain or initialize the Docker Python SDK client."""
    global _docker_client
    if _docker_client is not None:
        try:
            _docker_client.ping()
            return _docker_client
        except Exception:
            logger.warning("[DockerClient] Existing connection unresponsive. Re-initializing...")
            _docker_client = None

    docker_host = get_docker_host()
    tls_verify = os.environ.get("DOCKER_TLS_VERIFY") in ("1", "true", "True")
    cert_path = os.environ.get("DOCKER_CERT_PATH")

    tls_config = False
    if tls_verify and cert_path:
        tls_config = docker.tls.TLSConfig(
            client_cert=(os.path.join(cert_path, "cert.pem"), os.path.join(cert_path, "key.pem")),
            ca_cert=os.path.join(cert_path, "ca.pem"),
            verify=True
        )

    try:
        if docker_host:
            logger.info(f"[DockerClient] Connecting to Docker daemon at {docker_host}")
            if tls_config:
                client = docker.DockerClient(base_url=docker_host, tls=tls_config)
            else:
                client = docker.DockerClient(base_url=docker_host)
        else:
            logger.info("[DockerClient] Connecting to Docker daemon via environment context...")
            client = docker.from_env()

        client.ping()
        _docker_client = client
        return _docker_client
    except Exception as e:
        logger.error(f"[DockerClient] Failed to connect to Docker daemon: {e}")
        raise RuntimeError(f"Could not connect to Docker daemon. Ensure Docker is running. Error: {e}")


def is_docker_available() -> Tuple[bool, str]:
    """Health check Docker availability and return status description."""
    try:
        client = get_docker_client()
        version_info = client.version()
        return True, f"Docker Engine {version_info.get('Version', 'unknown')} active"
    except Exception as e:
        return False, str(e)


def ensure_base_image(image_name: str = "alpine:latest") -> str:
    """Ensure runtime container image exists locally; pulls if missing."""
    client = get_docker_client()
    try:
        client.images.get(image_name)
        return image_name
    except ImageNotFound:
        logger.info(f"[DockerClient] Pulling base runtime image {image_name}...")
        client.images.pull(image_name)
        return image_name
    except Exception as e:
        logger.warning(f"[DockerClient] Error verifying image {image_name}: {e}")
        return image_name
