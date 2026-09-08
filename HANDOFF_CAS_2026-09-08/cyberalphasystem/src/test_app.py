from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_root_is_ui():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    assert "Jarvis" in r.text


def test_api_status():
    r = client.get("/api")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "Jarvis Gateway API"
    assert "openrouter" in body["providers"]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_providers():
    r = client.get("/providers")
    assert r.status_code == 200
    assert "openrouter" in r.json()["providers"]


def test_chat_without_key_returns_provider_error_not_crash():
    r = client.post("/chat", json={"prompt": "ping"})
    assert r.status_code in (500, 401)
    assert "detail" in r.json()


def test_keys_test_rejects_unknown_provider():
    r = client.post("/keys/test", json={"provider": "naoexiste", "api_key": "abcd"})
    assert r.status_code == 400
