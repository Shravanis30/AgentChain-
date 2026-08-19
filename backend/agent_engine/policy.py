import re
import urllib.parse
from typing import Dict, Any, List, Optional
from backend.db.models import AgentToolPermission

class PolicyViolationException(Exception):
    """Raised when an agent tool call violates configured security policies."""
    pass

class CapabilityPolicyEngine:
    """Enforces fine-grained capability sandboxing on agent tool invocations."""

    @staticmethod
    def evaluate_tool_call(
        tool_name: str,
        tool_arguments: Dict[str, Any],
        permissions: List[AgentToolPermission]
    ) -> Dict[str, Any]:
        """
        Validates tool call parameters against agent tool permissions:
        1. Checks if tool is permitted.
        2. Enforces SSRF whitelist on URLs.
        3. Enforces path traversal sandboxing on file operations.
        4. Rejects shell execution unless explicitly granted.
        """
        # Find permission definition
        perm = next((p for p in permissions if p.tool_name == tool_name), None)
        if not perm:
            raise PolicyViolationException(
                f"Policy Violation: Agent is not granted permission to execute tool '{tool_name}'."
            )

        # 1. Network / URL Checks
        if "url" in tool_arguments or "endpoint" in tool_arguments:
            if not perm.network_enabled:
                raise PolicyViolationException(
                    f"Policy Violation: Tool '{tool_name}' attempted network request, but network access is disabled."
                )
            target_url = tool_arguments.get("url") or tool_arguments.get("endpoint")
            parsed = urllib.parse.urlparse(target_url)

            # SSRF Protection: Deny localhost, private IPs, metadata endpoints
            host = parsed.hostname or ""
            if host in ["localhost", "127.0.0.1", "::1", "169.254.169.254", "metadata.google.internal"]:
                raise PolicyViolationException(
                    f"Security Alert (SSRF): Blocked access to restricted network target '{host}'."
                )

            # Allowed domains whitelist if configured
            if perm.allowed_domains and len(perm.allowed_domains) > 0:
                if not any(host.endswith(d) for d in perm.allowed_domains):
                    raise PolicyViolationException(
                        f"Policy Violation: Host '{host}' is not in configured domain whitelist."
                    )

        # 2. Filesystem Checks
        if "filepath" in tool_arguments or "path" in tool_arguments:
            filepath = tool_arguments.get("filepath") or tool_arguments.get("path", "")
            if ".." in filepath or filepath.startswith("/etc") or filepath.startswith("/var") or filepath.startswith("/root"):
                raise PolicyViolationException(
                    f"Security Alert (Path Traversal): Blocked unsafe path '{filepath}'."
                )

            is_write = tool_arguments.get("mode", "r") in ["w", "a", "wb", "write"] or "write" in tool_name
            if is_write and not perm.filesystem_write:
                raise PolicyViolationException(
                    f"Policy Violation: Tool '{tool_name}' attempted filesystem write, but write permission is disabled."
                )
            if not is_write and not perm.filesystem_read:
                raise PolicyViolationException(
                    f"Policy Violation: Tool '{tool_name}' attempted filesystem read, but read permission is disabled."
                )

        # 3. Shell Execution Checks
        if "command" in tool_arguments or "shell" in tool_name:
            if not perm.shell_enabled:
                raise PolicyViolationException(
                    f"Policy Violation: Shell command execution requested but shell permission is strictly disabled."
                )

        return {"allowed": True, "tool_name": tool_name}

policy_engine = CapabilityPolicyEngine()
