# Deploy — Cyber Alpha Jarvis

Repo: https://github.com/CASLABBR/cyberalphasystem  
GitHub user: `CASLABBR`  
E-mail / login: `cyberalphasystem@gmail.com`  
Railway: https://railway.com  
Render: conta **Cyber Alpha System**

## 1. Subir o código (na sua máquina)

```bash
git init
git add .
git commit -m "Jarvis Gateway 1.0.1 — pacote limpo"
git branch -M main
git remote add origin https://github.com/CASLABBR/cyberalphasystem.git
git push -u origin main
```

Se o repo remoto já tiver um commit inicial, use `git pull origin main --allow-unrelated-histories` antes do push e remova arquivos placeholder.

Confira **antes** do push: nenhum `.env`, nenhuma chave `sk-` / `gsk_` / `ghp_` no `git diff`.

## 2. Render

1. Entre na conta **Cyber Alpha System** (`cyberalphasystem@gmail.com`).
2. New → Web Service → repo `CASLABBR/cyberalphasystem`.
3. Runtime Python 3.11.
4. Build: `pip install -r requirements.txt`
5. Start: `python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT`
6. Health check: `/health`
7. Environment: cole as chaves só no painel.

## 3. Railway

1. Entre em https://railway.com com `cyberalphasystem@gmail.com`.
2. New Project → Deploy from GitHub → `CASLABBR/cyberalphasystem`.
3. Start command igual ao Render.
4. Env no dashboard.

A URL final é a que o painel mostrar. Não use `seu-app.railway.app`.

## 4. Checklist

- [ ] `GET /` retorna `"service": "Jarvis Gateway API"`
- [ ] `GET /health` com `providers_active` > 0
- [ ] `POST /chat` com prompt curto responde texto
- [ ] Log de build sem chave
