# Cyber Alpha Jarvis

Gateway HTTP multi-LLM da **Cyber Alpha System**.

- Empresa: Cyber Alpha System
- Produto: Jarvis Gateway API
- Orquestrador: JINKS
- GitHub: [CASLABBR/cyberalphasystem](https://github.com/CASLABBR/cyberalphasystem)
- Contato: cyberalphasystem@gmail.com
- Railway: https://railway.com
- Render: conta Cyber Alpha System

Isto **não** é o app Android ORBI Azure.

## O que faz

Encaminha `POST /chat` para OpenRouter, Groq, Gemini ou OpenAI. Sem banco, sem login Microsoft, sem UI.

| Método | Rota | Auth |
|---|---|---|
| GET | `/` | pública |
| GET | `/health` | pública |
| GET | `/providers` | pública |
| GET | `/docs` | pública |
| POST | `/chat` | header `X-Jarvis-Key` **só se** `JARVIS_GATEWAY_KEY` estiver setada |

## Subir local

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edite .env com pelo menos uma chave de provider
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Prova: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) e [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"ping","provider":"openrouter"}'
```

## Deploy

Ver `DEPLOY.md`. Start command:

```text
python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

Chaves só no painel do Render/Railway. Nunca neste repositório.

## O que não entra neste repo

`.env`, `config.json` com senha, `__pycache__`, atalhos `.lnk`, `pip freeze` da máquina inteira, token GitHub.
