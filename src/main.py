from datetime import datetime
from pathlib import Path
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import httpx

load_dotenv()

APP_VERSION = "1.1.0"
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


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
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


PROVIDERS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "key_env": "OPENROUTER_API_KEY",
        "models": [
            "minimax/minimax-m2.5:free",
            "google/gemma-2-9b-it:free",
            "meta-llama/llama-3-8b-instruct:free",
        ],
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    },
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "key_env": "GEMINI_API_KEY",
        "models": ["gemini-2.0-flash", "gemini-1.5-flash"],
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "key_env": "OPENAI_API_KEY",
        "models": ["gpt-4o-mini", "gpt-4.1-mini"],
    },
}


def _provider_key(name: str) -> str:
    return os.getenv(PROVIDERS[name]["key_env"], "").strip()


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
    }


@app.get("/", response_class=HTMLResponse)
async def ui_root():
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        return HTMLResponse("<p>UI ausente. Use /docs</p>", status_code=200)
    return FileResponse(index)


@app.get("/api")
async def read_root():
    return _status_payload()


@app.get("/health")
async def health_check():
    active = [name for name in PROVIDERS if _provider_key(name)]
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
                "configured": bool(_provider_key(name)),
            }
            for name, cfg in PROVIDERS.items()
        }
    }


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    x_jarvis_key: str | None = Header(default=None, alias="X-Jarvis-Key"),
):
    _require_gateway_key(x_jarvis_key)
    start_time = datetime.now()

    if request.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Provider not supported")

    api_key = _provider_key(request.provider)
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=f"API key not configured for provider {request.provider}",
        )

    payload = {
        "model": request.model,
        "messages": [{"role": "user", "content": request.prompt}],
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                PROVIDERS[request.provider]["url"],
                headers=headers,
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
    )
