from datetime import datetime
from pathlib import Path
from typing import Literal
import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx

load_dotenv()

APP_VERSION = "2.1.1"
ROOT_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT_DIR / "static"

app = FastAPI(
    title="Jarvis Gateway API",
    description="Gateway multi-LLM — Cyber Alpha System",
    version=APP_VERSION,
)

_raw_origins = os.getenv("CORS_ORIGINS", "*").strip()
allow_origins = ["*"] if _raw_origins in ("", "*") else [
    o.strip() for o in _raw_origins.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    prompt: str = Field("", min_length=0)
    messages: list[ChatMessage] = Field(default_factory=list)
    provider: str = "openrouter"
    model: str = "minimax/minimax-m2.5:free"
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: int = Field(2000, ge=1, le=8192)


class ChatResponse(BaseModel):
    response: str
    provider: str
    model: str
    tokens_used: int
    response_time_ms: int
    timestamp: str


class KeyTestRequest(BaseModel):
    provider: str
    api_key: str = Field(..., min_length=4)


PROVIDERS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "key_env": "OPENROUTER_API_KEY",
        "header": "x-openrouter-key",
        "models": [
            "minimax/minimax-m2.5:free",
            "google/gemma-2-9b-it:free",
            "meta-llama/llama-3-8b-instruct:free",
        ],
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "header": "x-groq-key",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    },
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "key_env": "GEMINI_API_KEY",
        "header": "x-gemini-key",
        "models": ["gemini-2.0-flash", "gemini-1.5-flash"],
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "key_env": "OPENAI_API_KEY",
        "header": "x-openai-key",
        "models": ["gpt-4o-mini", "gpt-4.1-mini"],
    },
}


def _env_key(name: str) -> str:
    return os.getenv(PROVIDERS[name]["key_env"], "").strip()


def _header_key(name: str, raw_headers) -> str:
    alias = PROVIDERS[name]["header"]
    val = raw_headers.get(alias) or raw_headers.get(alias.title())
    return (val or "").strip()


def _resolve_key(name: str, raw_headers) -> str:
    return _header_key(name, raw_headers) or _env_key(name)


def _require_gateway_key(x_jarvis_key: str | None) -> None:
    expected = os.getenv("JARVIS_GATEWAY_KEY", "").strip()
    if not expected:
        return
    if not x_jarvis_key or x_jarvis_key != expected:
        raise HTTPException(status_code=401, detail="Missing or invalid X-Jarvis-Key")


def _status_payload() -> dict:
    return {
        "service": "Jarvis Gateway API",
        "product": "Cyber Alpha Jarvis",
        "version": APP_VERSION,
        "status": "online",
        "providers": list(PROVIDERS.keys()),
        "documentation": "/docs",
        "ui": "/",
        "stream": "/chat/stream",
        "mode": "keys-optional-ui",
    }


def _build_messages(request: ChatRequest) -> list[dict]:
    if request.messages:
        return [{"role": m.role, "content": m.content} for m in request.messages]
    prompt = (request.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt or messages required")
    return [{"role": "user", "content": prompt}]


def _auth_headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


@app.get("/", response_class=HTMLResponse)
async def family_home():
    home = STATIC_DIR / "home.html"
    if home.is_file():
        return FileResponse(home)
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    return HTMLResponse("<p>UI ausente. Use /docs</p>", status_code=200)


@app.get("/sala", response_class=HTMLResponse)
async def ui_sala():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        return HTMLResponse("<p>Sala ausente. Use /docs</p>", status_code=200)
    return FileResponse(index)


@app.get("/api")
async def read_root():
    return _status_payload()


@app.get("/health")
async def health_check():
    active = [name for name in PROVIDERS if _env_key(name)]
    return {
        "status": "healthy",
        "providers_active": len(active),
        "providers": active,
        "gateway_auth": bool(os.getenv("JARVIS_GATEWAY_KEY", "").strip()),
        "version": APP_VERSION,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/providers")
async def list_providers():
    return {
        "providers": {
            name: {
                "models": cfg["models"],
                "configured": bool(_env_key(name)),
            }
            for name, cfg in PROVIDERS.items()
        }
    }


@app.post("/keys/test")
async def keys_test(body: KeyTestRequest):
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Provider not supported")
    cfg = PROVIDERS[body.provider]
    key = body.api_key.strip()
    if key in ("", "from-server-unused"):
        key = _env_key(body.provider)
    if not key:
        raise HTTPException(status_code=400, detail="No key to test")
    payload = {
        "model": cfg["models"][0],
        "messages": [{"role": "user", "content": "Responda apenas: ok"}],
        "max_tokens": 8,
        "temperature": 0,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                cfg["url"],
                headers=_auth_headers(key),
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Provider timeout")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Provider transport error: {exc}")
    if response.status_code != 200:
        return {
            "ok": False,
            "status": response.status_code,
            "detail": response.text[:300],
        }
    return {"ok": True, "status": 200, "provider": body.provider}


async def _complete(request: ChatRequest, api_key: str) -> ChatResponse:
    start_time = datetime.now()
    payload = {
        "model": request.model,
        "messages": _build_messages(request),
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                PROVIDERS[request.provider]["url"],
                headers=_auth_headers(api_key),
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Provider timeout")
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Provider transport error: {exc}")
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Provider error {response.status_code}: {response.text[:500]}",
        )
    data = response.json()
    try:
        resposta = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="Unexpected provider payload")
    tokens = data.get("usage", {}).get("total_tokens", 0)
    elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    return ChatResponse(
        response=resposta or "",
        provider=request.provider,
        model=request.model,
        tokens_used=int(tokens or 0),
        response_time_ms=elapsed_ms,
        timestamp=datetime.now().isoformat(),
    )


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    x_jarvis_key: str | None = Header(default=None, alias="X-Jarvis-Key"),
    x_openrouter_key: str | None = Header(default=None, alias="X-OpenRouter-Key"),
    x_groq_key: str | None = Header(default=None, alias="X-Groq-Key"),
    x_gemini_key: str | None = Header(default=None, alias="X-Gemini-Key"),
    x_openai_key: str | None = Header(default=None, alias="X-OpenAI-Key"),
):
    _require_gateway_key(x_jarvis_key)
    if request.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Provider not supported")
    incoming = {
        "x-openrouter-key": x_openrouter_key or "",
        "x-groq-key": x_groq_key or "",
        "x-gemini-key": x_gemini_key or "",
        "x-openai-key": x_openai_key or "",
    }
    api_key = incoming[PROVIDERS[request.provider]["header"]] or _env_key(request.provider)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Sem chave. Abra Ajustes ou defina a env no Render.",
        )
    return await _complete(request, api_key)


@app.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    x_jarvis_key: str | None = Header(default=None, alias="X-Jarvis-Key"),
    x_openrouter_key: str | None = Header(default=None, alias="X-OpenRouter-Key"),
    x_groq_key: str | None = Header(default=None, alias="X-Groq-Key"),
    x_gemini_key: str | None = Header(default=None, alias="X-Gemini-Key"),
    x_openai_key: str | None = Header(default=None, alias="X-OpenAI-Key"),
):
    _require_gateway_key(x_jarvis_key)
    if request.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Provider not supported")
    incoming = {
        "x-openrouter-key": x_openrouter_key or "",
        "x-groq-key": x_groq_key or "",
        "x-gemini-key": x_gemini_key or "",
        "x-openai-key": x_openai_key or "",
    }
    api_key = incoming[PROVIDERS[request.provider]["header"]] or _env_key(request.provider)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Sem chave. Abra Ajustes ou defina a env no Render.",
        )

    payload = {
        "model": request.model,
        "messages": _build_messages(request),
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": True,
    }

    async def events():
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                async with client.stream(
                    "POST",
                    PROVIDERS[request.provider]["url"],
                    headers=_auth_headers(api_key),
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        body = (await response.aread()).decode("utf-8", "replace")[:400]
                        yield f"data: {json.dumps({'error': body, 'status': response.status_code})}\n\n"
                        return
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        yield f"{line}\n" if line.startswith("data:") else f"data: {line}\n\n"
        except httpx.HTTPError as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")



_orbi = STATIC_DIR / "family" / "orbi"
_nexus = STATIC_DIR / "family" / "nexus"
if _orbi.is_dir():
    app.mount("/orbi", StaticFiles(directory=_orbi, html=True), name="orbi")
if _nexus.is_dir():
    app.mount("/nexus", StaticFiles(directory=_nexus, html=True), name="nexus")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
    )
