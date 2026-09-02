import re
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger("agentchain.secret_scanner")

# Regex Patterns for Common High-Risk Secrets
SECRET_PATTERNS: List[Tuple[str, str]] = [
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"sk-(?!ant-)[a-zA-Z0-9_\-]{32,}", "OpenAI API Key"),
    (r"sk-ant-[a-zA-Z0-9_\-]{32,}", "Anthropic API Key"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"gho_[a-zA-Z0-9]{36}", "GitHub OAuth Access Token"),
    (r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----", "Private Cryptographic Key"),
    (r"xox[baprs]-[0-9a-zA-Z]{10,48}", "Slack Token"),
    (r"sq0atp-[0-9A-Za-z\-_]{22}", "Square Access Token"),
]

class SecretScanner:
    """Enterprise Static Secret Scanner for repository code and diff analysis."""

    @staticmethod
    def scan_content(file_path: str, content: str) -> List[Dict[str, Any]]:
        """Scans string content for hardcoded secrets, returning match details."""
        detected_findings = []

        for pattern, secret_type in SECRET_PATTERNS:
            matches = re.finditer(pattern, content)
            for match in matches:
                matched_text = match.group(0)
                masked = matched_text[:4] + "..." + matched_text[-4:] if len(matched_text) > 8 else "****"
                detected_findings.append({
                    "file_path": file_path,
                    "secret_type": secret_type,
                    "masked_secret": masked,
                    "start_idx": match.start(),
                    "end_idx": match.end()
                })

        return detected_findings

    @staticmethod
    def scan_repository_tree(files_dict: Dict[str, str]) -> Tuple[bool, List[Dict[str, Any]]]:
        """Scans an entire dictionary of file_path -> content pairs.

        Returns:
            (has_secrets: bool, list_of_findings: List[Dict])
        """
        all_findings = []
        for file_path, content in files_dict.items():
            # Skip binary or lock files
            if any(file_path.endswith(ext) for ext in [".png", ".jpg", ".gz", ".zip", ".lock"]):
                continue

            findings = SecretScanner.scan_content(file_path, content)
            if findings:
                all_findings.extend(findings)

        has_secrets = len(all_findings) > 0
        if has_secrets:
            logger.warning(f"[SecretScanner] Detected {len(all_findings)} unencrypted secrets in build diff!")

        return has_secrets, all_findings

secret_scanner = SecretScanner()
