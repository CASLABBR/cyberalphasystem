# HANDOFF — Cyber Alpha System / Jarvis / NEXUS
Data: 2026-09-08
Fundador: conta oficial GitHub CASLABBR / email cyberalphasystem@gmail.com
NÃO usar CyberBerserkBR, alexgeek, alexramos… em identidade do produto.

## O que está NO AR (Render)
URL: https://cyberalphasystem.onrender.com
Health agora: version **2.1.1**, providers_active **0**
Repo: https://github.com/CASLABBR/cyberalphasystem  branch main
Último push que o Render pegou: commit 2fabafd "Jarvis 2.1.1 — hub, sala, ORBI, NEXUS"
Start command Render: `python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT`
Env names: OPENROUTER_API_KEY GROQ_API_KEY GEMINI_API_KEY OPENAI_API_KEY
JARVIS_GATEWAY_KEY opcional. Nunca commitar .env.

## O que está NESTE ZIP (código local mais novo)
Pasta `cyberalphasystem/` = **2.5.0**
- APP_VERSION em src/main.py = 2.5.0
- GET / serve NEXUS (static/family/nexus/index.html + shell.js)
- GET /sala = Jarvis UI (static/index.html + app.js)
- GET /orbi = quiz AZ-900 8 perguntas
- GET /nexus mount StaticFiles family/nexus
- GET /changelog JSON
- POST /chat e /chat/stream com headers X-OpenRouter-Key X-Groq-Key X-Gemini-Key X-OpenAI-Key
- POST /keys/test
- Chaves no browser: localStorage cas-jarvis-keys-v20
- Sem Claude Code, Docker, Drive, git clone nesta URL (não inventar botão)

## Git na máquina do fundador (Windows)
Repo que o Render lê:
`E:\#INTELIGENCIA_ARTIFICIAL\#PROJETO\1.0`
origin = https://github.com/CASLABBR/cyberalphasystem.git
NÃO usar `E:\#INTELIGENCIA_ARTIFICIAL\# TODA A BAGUNÇA AQUI\EngineAlpha-main` (conta velha).
Desktop: `D:\Desktop\cyberalphasystem` muitas vezes SEM .git (só arquivos/zips).

Para publicar 2.5.0: extrair este cyberalphasystem/ por cima de #PROJETO\1.0 (src+static), commit, push origin main. Esperar health version 2.5.0.

## Produtos (não misturar stacks)
- Jarvis = FastAPI gateway multi-LLM + UI
- ORBI Azure = treinador AZ-900 (APK separado; nesta URL só quiz web)
- NEXUS = mesa/UI que embute Jarvis
Mesma empresa Cyber Alpha System.

## Bug conhecido da UI 2.1.1 no ar
Botão "Testar se houver chave" testa SÓ o provedor do dropdown do topo.
Se o topo está openai vazio, mensagem "Nenhuma chave" mesmo com Gemini preenchido.
Workaround: Salvar, escolher gemini/openrouter no topo, testar, enviar.
2.5.0 no NEXUS tem aba Chaves; sala 2.3+ testa por linha (se o static novo for o que subiu).

## O que a outra IA deve fazer
1. Tratar 2.5.0 deste zip como fonte, não o site 2.1.1.
2. Não pedir/colar API keys neste chat.
3. Não inflar versão 120.x. Próximo útil: 2.5.1 só depois do push 2.5.0 estar no health.
4. Não recomeçar do CYBER_ALPHA_SYSTEM-main.zip antigo (tinha chaves vazadas).
5. UI fundador pt-BR. Sem botão sem código.

## Rotas 2.5.0
/  NEXUS mesa
/sala Jarvis
/orbi ORBI quiz
/docs Swagger
/health
/changelog
/providers
POST /chat
POST /chat/stream
POST /keys/test
