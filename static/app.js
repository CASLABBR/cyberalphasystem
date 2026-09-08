const KEY = "cas-jarvis-ui-v11";
const thread = document.getElementById("thread");
const providerEl = document.getElementById("provider");
const modelEl = document.getElementById("model");
const promptEl = document.getElementById("prompt");
const form = document.getElementById("composer");
const sendBtn = document.getElementById("send");
const healthPill = document.getElementById("health-pill");
const versionPill = document.getElementById("version-pill");
const providerList = document.getElementById("provider-list");
const subtitle = document.getElementById("subtitle");

let catalog = {};
let history = [];

function loadHistory() {
  try { history = JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { history = []; }
}

function saveHistory() {
  localStorage.setItem(KEY, JSON.stringify(history.slice(-40)));
}

function addMsg(role, text, meta) {
  const el = document.createElement("article");
  el.className = `msg ${role}`;
  if (meta) {
    const m = document.createElement("span");
    m.className = "meta";
    m.textContent = meta;
    el.appendChild(m);
  }
  el.append(text);
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

function renderHistory() {
  thread.innerHTML = "";
  if (!history.length) {
    addMsg(
      "system",
      "Jarvis no ar. Sem chave no Render o chat não fala com o modelo — o painel mostra provedor ativo em verde."
    );
    return;
  }
  history.forEach((m) => addMsg(m.role, m.text, m.meta));
}

function fillModels(name) {
  const models = (catalog[name] && catalog[name].models) || [];
  modelEl.innerHTML = models.map((m) => `<option value="${m}">${m}</option>`).join("");
}

async function boot() {
  loadHistory();
  renderHistory();
  try {
    const [health, providers, api] = await Promise.all([
      fetch("/health").then((r) => r.json()),
      fetch("/providers").then((r) => r.json()),
      fetch("/api").then((r) => r.json()).catch(() => ({})),
    ]);
    catalog = providers.providers || {};
    versionPill.textContent = "v" + (health.version || api.version || "1.1.0");
    const active = health.providers || [];
    if (health.providers_active > 0) {
      healthPill.textContent = `${health.providers_active} provedor(es) ativo(s)`;
      healthPill.className = "pill ok";
      subtitle.textContent = "Pronto para conversar.";
    } else {
      healthPill.textContent = "nenhuma chave no servidor";
      healthPill.className = "pill warn";
      subtitle.textContent = "API no ar, sem chave. Preencha o Environment do Render.";
    }
    providerList.innerHTML = "";
    providerEl.innerHTML = "";
    Object.entries(catalog).forEach(([name, info]) => {
      const pill = document.createElement("span");
      pill.className = "pill " + (info.configured ? "ok" : "off");
      pill.textContent = name + (info.configured ? "" : " off");
      providerList.appendChild(pill);
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name + (info.configured ? "" : " (sem chave)");
      providerEl.appendChild(opt);
    });
    const first = active[0] || Object.keys(catalog)[0];
    if (first) {
      providerEl.value = first;
      fillModels(first);
    }
  } catch (err) {
    healthPill.textContent = "falha ao ler /health";
    healthPill.className = "pill bad";
  }
}

providerEl.addEventListener("change", () => fillModels(providerEl.value));

document.getElementById("clear-btn").addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;
  const provider = providerEl.value;
  const model = modelEl.value;
  promptEl.value = "";
  addMsg("user", prompt);
  history.push({ role: "user", text: prompt });
  saveHistory();
  sendBtn.disabled = true;
  const pending = document.createElement("article");
  pending.className = "msg jarvis";
  pending.textContent = "Jarvis pensando…";
  thread.appendChild(pending);

  const packed = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Usuário" : "Jarvis"}: ${m.text}`)
    .join("\n");

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: packed, provider, model }),
    });
    const data = await res.json();
    pending.remove();
    if (!res.ok) {
      const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      addMsg("jarvis", detail, "erro");
      history.push({ role: "jarvis", text: detail, meta: "erro" });
    } else {
      const meta = `${data.provider} · ${data.model} · ${data.response_time_ms} ms`;
      addMsg("jarvis", data.response, meta);
      history.push({ role: "jarvis", text: data.response, meta });
    }
    saveHistory();
  } catch (err) {
    pending.remove();
    addMsg("jarvis", String(err), "rede");
  } finally {
    sendBtn.disabled = false;
    promptEl.focus();
  }
});

promptEl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    form.requestSubmit();
  }
});

boot();
