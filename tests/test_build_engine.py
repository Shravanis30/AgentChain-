import pytest
import asyncio
from backend.build_engine.secret_scanner import SecretScanner, secret_scanner
from backend.build_engine.github_client import github_client
from backend.build_engine.queue import build_queue
from backend.build_engine.worker import build_worker

@pytest.mark.asyncio
async def test_secret_scanner_detection():
    """Test that secret scanner flags unencrypted AWS & OpenAI API keys."""
    dirty_content = """
    OPENAI_KEY = "sk-proj-1234567890abcdef1234567890abcdef"
    AWS_ID = "AKIAIOSFODNN7EXAMPLE"
    """
    findings = SecretScanner.scan_content("config.py", dirty_content)
    assert len(findings) == 2
    types = {f["secret_type"] for f in findings}
    assert "OpenAI API Key" in types
    assert "AWS Access Key ID" in types

@pytest.mark.asyncio
async def test_secret_scanner_clean_pass():
    """Test that clean code passes secret scanning without false positives."""
    clean_code = "print('Hello AgentChain Workforce')"
    findings = SecretScanner.scan_content("main.py", clean_code)
    assert len(findings) == 0

@pytest.mark.asyncio
async def test_github_client_file_fetching():
    """Test repository file tree fetching with per-installation token."""
    files = await github_client.fetch_repository_files("test-org/solidity-guard-sentinel", installation_id="test-inst-123")
    assert "Dockerfile" in files
    assert "main.py" in files

@pytest.mark.asyncio
async def test_build_worker_revoked_installation_failure():
    """Test build engine raises clear exception when installation is revoked."""
    from backend.github.installation_client import GitHubInstallationRevokedError
    with pytest.raises(GitHubInstallationRevokedError) as exc_info:
        await github_client.fetch_repository_files("test-org/solidity-guard", installation_id="revoked-inst-999")
    assert "reconnect" in str(exc_info.value)

@pytest.mark.asyncio
async def test_secret_scanner_tree_blocking():
    """Test repository tree scanner blocking diffs with committed keys."""
    files = {
        "main.py": "print('running')",
        "keys.env": "ANTHROPIC_KEY=sk-ant-api03-12345678901234567890123456789012"
    }
    has_secrets, findings = SecretScanner.scan_repository_tree(files)
    assert has_secrets is True
    assert len(findings) == 1
    assert findings[0]["secret_type"] == "Anthropic API Key"
