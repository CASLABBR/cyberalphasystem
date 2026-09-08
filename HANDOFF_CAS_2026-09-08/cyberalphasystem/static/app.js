const KEYS = "cas-jarvis-keys-v20";
const LIB = "cas-jarvis-lib-v20";
const PREF = "cas-jarvis-pref-v20";

const AGENTS = {
  geral: {
    label: "Jarvis Geral",
    system: "Você é o Jarvis da Cyber Alpha System. Responda em português do Brasil, direto e útil.",
  },
  jinks: {
    label: "JINKS Orquestrador",
    system: "Você é JINKS, orquestrador da Cyber Alpha. Organize passos, escolha ferramenta mental, não invente API.",
  },
  revisor: {
    label: "Revisor",
    system: "Você revisa texto em pt-BR. Corrija clareza e corte gordura. Não elogie à toa.",
  },
  tecnico: {
    label: "Técnico",
    system: "Você é o Jarvis técnico. Respostas curtas, comandos exatos, sem enrolação.",
  },
};

const FOLDERS = ["Raiz", "Trabalho", "Estudo", "Agentes", "Arquivo"];

const thread = document.getElementById("thread");
const providerEl = document.getElementById("provider");
const modelEl = document.getElementById("model");
const agentEl = document.getElementById("agent");
const folderEl = document.getElementById("folder");
const promptEl = document.getElementById("prompt");
const form = document.getElementById("composer");
const sendBtn = document.getElementById("send");
const stopBtn = document.getElementById("stop");
const healthPill = document.getElementById("health-pill");
const versionPill = document.getElementById("version-pill");
const providerList = document.getElementById("provider-list");
const subtitle = document.getElementById("subtitle");
const convList = document.getElementById("conv-list");
const convTitle = document.getElementById("conv-title");
const settings = document.getElementById("settings");
const keyStatus = document.getElementById("key-status");

let catalog = {};
let serverActive = [];
let lib = { current: null, items: [] };
let abortCtl = null;

function loadJSON(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k) || "null") || fallback; }
  catch { return fallback; }
}
function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function keys() { return loadJSON(KEYS, { openrouter: "", groq: "", gemini: "", openai: "" }); }
function prefs() { return loadJSON(PREF, { temperature: 0.7, agent: "geral" }); }
function localOn(name) { return Boolean((keys()[name] || "").trim()); }
function ready(name) { return serverActive.includes(name) || localOn(name); }

function headerMap() {
  const k = keys();
  const h = { "Content-Type": "application/json" };
  if (k.openrouter) h["X-OpenRouter-Key"] = k.openrouter;
  if (k.groq) h["X-Groq-Key"] = k.groq;
  if (k.gemini) h["X-Gemini-Key"] = k.gemini;
  if (k.openai) h["X-OpenAI-Key"] = k.openai;
  return h;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function md(text) {
  const parts = String(text || "").split(/```/);
  return parts.map((chunk, i) => {
    if (i % 2 === 1) return "<pre><code>" + escapeHtml(chunk.replace(/^\w+\n/, "")) + "</code></pre>";
    return escapeHtml(chunk).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
  }).join("");
}

function addMsg(role, text, meta, asHtml) {
  const el = document.createElement("article");
  el.className = "msg " + role;
  if (meta) {
    const m = document.createElement("span");
    m.className = "meta";
    m.textContent = meta;
    el.appendChild(m);
  }
  const body = document.createElement("div");
  if (asHtml) body.innerHTML = md(text);
  else body.textContent = text;
  el.appendChild(body);
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

function current() { return lib.items.find((c) => c.id === lib.current); }

function ensureConv() {
  if (current()) return current();
  const item = {
    id: "c" + Date.now(),
    title: "Nova conversa",
    folder: folderEl.value || "Raiz",
    agent: agentEl.value || "geral",
    messages: [],
    updated: Date.now(),
  };
  lib.items.unshift(item);
  lib.current = item.id;
  saveJSON(LIB, lib);
  return item;
}

function renderConvs() {
  const folder = folderEl.value || "Raiz";
  const q = ((document.getElementById("search") || {}).value || "").toLowerCase();
  convList.innerHTML = "";
  const items = lib.items
    .slice()
    .sort((a, b) => (b.pin || 0) - (a.pin || 0) || (b.updated || 0) - (a.updated || 0))
    .filter((c) => (c.folder || "Raiz") === folder)
    .filter((c) => !q || (c.title || "").toLowerCase().includes(q) || (c.messages || []).some((m) => (m.content || "").toLowerCase().includes(q)));
  items.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "conv-item" + (c.id === lib.current ? " on" : "") + (c.pin ? " pin" : "");
    b.textContent = c.title || "Sem título";
    b.onclick = () => {
      lib.current = c.id;
      saveJSON(LIB, lib);
      if (c.agent) agentEl.value = c.agent;
      paintThread();
      renderConvs();
    };
    convList.appendChild(b);
  });
}

function paintThread() {
  thread.innerHTML = "";
  const c = current();
  convTitle.textContent = (c && c.title) || "Sala do Jarvis";
  if (!c || !c.messages.length) {
    addMsg("system", "Jarvis 2.0 sem chave: crie conversas, mude a pasta, troque o agente, exporte. Quando houver chave em Ajustes ou no Render, o Enviar chama o modelo.");
    return;
  }
  c.messages.forEach((m) => {
    const role = m.role === "user" ? "user" : m.role === "system" ? "system" : "jarvis";
    addMsg(role, m.content, m.meta, role === "jarvis");
  });
}

function fillModels(name) {
  const models = (catalog[name] && catalog[name].models) || [];
  modelEl.innerHTML = models.map((m) => `<option value="${m}">${m}</option>`).join("");
}

function fillSelects() {
  agentEl.innerHTML = Object.entries(AGENTS).map(([id, a]) => `<option value="${id}">${a.label}</option>`).join("");
  folderEl.innerHTML = FOLDERS.map((f) => `<option value="${f}">${f}</option>`).join("");
  agentEl.value = prefs().agent || "geral";
}

async function boot() {
  fillSelects();
  lib = loadJSON(LIB, { current: null, items: [] });
  if (!lib.items) lib = { current: null, items: [] };
  ensureConv();
  const cur = current();
  if (cur && cur.folder) folderEl.value = cur.folder;
  if (cur && cur.agent) agentEl.value = cur.agent;
  renderConvs();
  paintThread();
  const k = keys();
  document.getElementById("key-openrouter").value = k.openrouter || "";
  document.getElementById("key-groq").value = k.groq || "";
  document.getElementById("key-gemini").value = k.gemini || "";
  document.getElementById("key-openai").value = k.openai || "";
  document.getElementById("temp").value = prefs().temperature || 0.7;
  try {
    const [health, providers] = await Promise.all([
      fetch("/health").then((r) => r.json()),
      fetch("/providers").then((r) => r.json()),
    ]);
    catalog = providers.providers || {};
    serverActive = health.providers || [];
    versionPill.textContent = "v" + (health.version || "2.0.0");
    const names = Object.keys(catalog);
    const any = names.some(ready);
    healthPill.textContent = any ? "modelo disponível" : "2.0 sem chave";
    healthPill.className = "pill " + (any ? "ok" : "warn");
    subtitle.textContent = any ? "Pode falar com o modelo." : "Biblioteca e agentes ativos. Modelo off até existir chave.";
    providerList.innerHTML = "";
    providerEl.innerHTML = "";
    names.forEach((name) => {
      const pill = document.createElement("span");
      pill.className = "pill " + (ready(name) ? "ok" : "off");
      pill.textContent = name + (ready(name) ? "" : " off");
      providerList.appendChild(pill);
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name + (ready(name) ? "" : " (off)");
      providerEl.appendChild(opt);
    });
    const first = names.find(ready) || names[0];
    if (first) { providerEl.value = first; fillModels(first); }
  } catch {
    healthPill.textContent = "API local/offline";
    healthPill.className = "pill warn";
    subtitle.textContent = "Sem /health. A biblioteca local ainda funciona.";
  }
}

function saveSettings() {
  saveJSON(KEYS, {
    openrouter: document.getElementById("key-openrouter").value.trim(),
    groq: document.getElementById("key-groq").value.trim(),
    gemini: document.getElementById("key-gemini").value.trim(),
    openai: document.getElementById("key-openai").value.trim(),
  });
  saveJSON(PREF, { temperature: Number(document.getElementById("temp").value || 0.7), agent: agentEl.value });
  const filled = Object.entries(keys()).filter(([, v]) => v).map(([k]) => k);
  keyStatus.textContent = filled.length
    ? "Salvo neste navegador: " + filled.join(", ")
    : "Nenhuma chave salva. A sala segue sem modelo.";
  boot();
}

document.getElementById("open-settings").onclick = () => settings.classList.remove("hidden");
document.getElementById("close-settings").onclick = () => settings.classList.add("hidden");
document.getElementById("save-settings").onclick = saveSettings;
document.getElementById("new-chat").onclick = () => {
  lib.current = null;
  ensureConv();
  renderConvs();
  paintThread();
};
folderEl.onchange = () => {
  const c = current();
  if (c) { c.folder = folderEl.value; saveJSON(LIB, lib); }
  renderConvs();
};
agentEl.onchange = () => {
  const c = current();
  if (c) { c.agent = agentEl.value; saveJSON(LIB, lib); }
  saveJSON(PREF, { ...prefs(), agent: agentEl.value });
};
providerEl.addEventListener("change", () => fillModels(providerEl.value));

document.getElementById("export-md").onclick = () => {
  const c = current();
  if (!c) return;
  const lines = ["# " + (c.title || "conversa"), "", "Agente: " + (AGENTS[c.agent] || {}).label, "Pasta: " + (c.folder || "Raiz"), ""];
  (c.messages || []).forEach((m) => {
    lines.push("## " + m.role);
    lines.push(m.content);
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (c.title || "jarvis") + ".md";
  a.click();
};

document.querySelectorAll(".key-row").forEach((row) => {
  const input = row.querySelector("input");
  const tog = row.querySelector(".tog");
  const tst = row.querySelector(".tst");
  if (tog) {
    tog.onclick = () => {
      input.type = input.type === "password" ? "text" : "password";
      tog.textContent = input.type === "password" ? "ver" : "ocultar";
    };
  }
  if (tst) {
    tst.onclick = async () => {
      saveSettings();
      const provider = row.getAttribute("data-prov");
      const api_key = (input.value || "").trim();
      if (!api_key) {
        keyStatus.textContent = provider + ": campo vazio.";
        return;
      }
      keyStatus.textContent = "Testando " + provider + "…";
      const res = await fetch("/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key }),
      });
      const data = await res.json().catch(() => ({}));
      keyStatus.textContent = data.ok
        ? provider + ": chave aceita."
        : provider + " recusou: " + (data.detail || data.status || res.status);
    };
  }
});
const clearBtn = document.getElementById("clear-keys");
if (clearBtn) {
  clearBtn.onclick = () => {
    ["key-openrouter", "key-groq", "key-gemini", "key-openai"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    saveSettings();
    keyStatus.textContent = "Chaves apagadas deste navegador.";
  };
}

function parseSSEChunk(buf, onDelta) {
  const parts = buf.split("\n");
  let rest = parts.pop();
  for (const line of parts) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const data = t.slice(5).trim();
    if (data === "[DONE]") return "";
    try {
      const json = JSON.parse(data);
      if (json.error) onDelta(null, json.error);
      const piece = json.choices && json.choices[0] && (json.choices[0].delta || json.choices[0].message);
      const text = piece && piece.content;
      if (text) onDelta(text);
    } catch { /* keep-alive */ }
  }
  return rest || "";
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const text = promptEl.value.trim();
  if (!text) return;
  const provider = providerEl.value;
  const model = modelEl.value;
  const conv = ensureConv();
  if (conv.messages.length === 0) conv.title = text.slice(0, 42);
  conv.folder = folderEl.value || conv.folder;
  conv.agent = agentEl.value || conv.agent;
  conv.messages.push({ role: "user", content: text });
  promptEl.value = "";
  addMsg("user", text);
  saveJSON(LIB, lib);
  renderConvs();

  if (!ready(provider)) {
    const note = "Registrado na biblioteca. Sem chave de " + (provider || "provedor") + " — o agente não respondeu. Cole a chave depois em Ajustes; o histórico já está salvo.";
    addMsg("system", note);
    conv.messages.push({ role: "assistant", content: note, meta: "offline" });
    saveJSON(LIB, lib);
    return;
  }

  const pending = addMsg("jarvis", "", provider + " · ao vivo");
  const bodyEl = pending.querySelector("div");
  sendBtn.disabled = true;
  stopBtn.classList.remove("hidden");
  abortCtl = new AbortController();
  let acc = "";
  const payload = {
    provider,
    model,
    temperature: Number(prefs().temperature || 0.7),
    messages: [
      { role: "system", content: (AGENTS[conv.agent] || AGENTS.geral).system },
      ...conv.messages.filter((m) => m.role !== "assistant" || m.meta !== "offline").map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ],
  };
  try {
    const res = await fetch("/chat/stream", {
      method: "POST",
      headers: headerMap(),
      body: JSON.stringify(payload),
      signal: abortCtl.signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err));
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      buf = parseSSEChunk(buf, (delta, error) => {
        if (error) throw new Error(error);
        acc += delta || "";
        bodyEl.innerHTML = md(acc);
        thread.scrollTop = thread.scrollHeight;
      });
    }
    conv.messages.push({ role: "assistant", content: acc, meta: provider + " · " + model });
    saveJSON(LIB, lib);
  } catch (err) {
    bodyEl.textContent = err.name === "AbortError" ? (acc + "\n[parado]") : String(err.message || err);
  } finally {
    sendBtn.disabled = false;
    stopBtn.classList.add("hidden");
    abortCtl = null;
  }
});

stopBtn.onclick = () => { if (abortCtl) abortCtl.abort(); };
promptEl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    form.requestSubmit();
  }
});


const searchEl = document.getElementById("search");
if (searchEl) searchEl.addEventListener("input", renderConvs);
document.getElementById("menu").onclick = () => document.getElementById("rail").classList.toggle("open");
document.getElementById("rename-chat").onclick = () => {
  const c = current();
  if (!c) return;
  const name = prompt("Nome da conversa", c.title || "");
  if (!name) return;
  c.title = name.trim();
  saveJSON(LIB, lib);
  renderConvs();
  paintThread();
};
document.getElementById("del-chat").onclick = () => {
  const c = current();
  if (!c) return;
  if (!confirm("Apagar esta conversa?")) return;
  lib.items = lib.items.filter((x) => x.id !== c.id);
  lib.current = (lib.items[0] || {}).id || null;
  saveJSON(LIB, lib);
  if (!current()) ensureConv();
  renderConvs();
  paintThread();
};
document.getElementById("pin-chat").onclick = () => {
  const c = current();
  if (!c) return;
  c.pin = !c.pin;
  saveJSON(LIB, lib);
  renderConvs();
};
document.getElementById("export-json").onclick = () => {
  const blob = new Blob([JSON.stringify(lib, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "jarvis-biblioteca.json";
  a.click();
};


document.getElementById("dup-chat").onclick = () => {
  const c = current();
  if (!c) return;
  const copy = JSON.parse(JSON.stringify(c));
  copy.id = "c" + Date.now();
  copy.title = (c.title || "conversa") + " (cópia)";
  copy.pin = false;
  lib.items.unshift(copy);
  lib.current = copy.id;
  saveJSON(LIB, lib);
  renderConvs();
  paintThread();
};
document.getElementById("copy-last").onclick = async () => {
  const c = current();
  if (!c) return;
  const last = [...(c.messages || [])].reverse().find((m) => m.role === "assistant");
  if (!last) return;
  try { await navigator.clipboard.writeText(last.content); }
  catch { prompt("Copie:", last.content); }
};
document.getElementById("import-json").onclick = () => document.getElementById("import-file").click();
document.getElementById("import-file").onchange = (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.items) throw new Error("json sem items");
      lib = data;
      saveJSON(LIB, lib);
      if (!current()) ensureConv();
      renderConvs();
      paintThread();
    } catch (e) { alert("JSON inválido"); }
  };
  reader.readAsText(f);
};

boot();
