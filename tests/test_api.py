from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "agentchain_http_requests_total" in response.text

def test_nonce_challenge_endpoint():
    response = client.get("/api/v1/auth/nonce")
    assert response.status_code == 200
    data = response.json()
    assert "nonce" in data
    assert len(data["nonce"]) == 32
