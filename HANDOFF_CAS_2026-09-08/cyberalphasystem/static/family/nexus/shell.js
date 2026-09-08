const KEYS = "cas-jarvis-keys-v20";
const BOX = "cas-nexus-os-v24";

const MODULES = [
  { id: "jarvis", mark: "●", label: "Jarvis", hint: "IA da casa. Sala embutida." },
  { id: "orbi", mark: "◐", label: "ORBI Azure", hint: "Quiz AZ-900 + XP neste navegador." },
  { id: "api", mark: "●", label: "API / Swagger", hint: "OpenAPI desta instância." },
  { id: "saude", mark: "●", label: "Saúde", hint: "GET /health real." },
  { id: "chaves", mark: "●", label: "Chaves", hint: "Cofre do navegador. Mesmo da sala." },
  { id: "studio", mark: "●", label: "Studio", hint: "Preview HTML local." },
  { id: "inbox", mark: "●", label: "Inbox", hint: "Arquivos só neste browser." },
  { id: "jobs", mark: "●", label: "Jobs", hint: "Fila local. Não é shell." },
  { id: "notas", mark: "●", label: "Notas", hint: "Bloco local da mesa." },
  { id: "changelog", mark: "●", label: "Changelog", hint: "GET /changelog." },
  { id: "mapa", mark: "●", label: "Mapa", hint: "O que tem código e o que não tem." },
];

function bag() { try { return JSON.parse(localStorage.getItem(BOX) || "{}"); } catch { return {}; } }
function put(p) { localStorage.setItem(BOX, JSON.stringify({ ...bag(), ...p })); }
function keys() { try { return JSON.parse(localStorage.getItem(KEYS) || "{}"); } catch { return {}; } }

const menu = document.getElementById("menu");
const stage = document.getElementById("stage");
const title = document.getElementById("mod-title");
const hint = document.getElementById("mod-hint");

MODULES.forEach((m) => {
  const b = document.createElement("button");
  b.type = "button";
  b.innerHTML = `${m.mark} ${m.label}<small>${m.hint}</small>`;
  b.onclick = () => openMod(m.id);
  menu.appendChild(b);
});

function mark(id) {
  [...menu.children].forEach((b, i) => b.classList.toggle("on", MODULES[i].id === id));
}

function openMod(id) {
  const m = MODULES.find((x) => x.id === id);
  mark(id);
  title.textContent = m.label;
  hint.textContent = m.hint;
  put({ last: id });
  if (id === "jarvis") {
    stage.innerHTML = `<iframe title="Jarvis" src="/sala"></iframe>`;
    return;
  }
  if (id === "orbi") {
    stage.innerHTML = `<iframe title="ORBI" src="/orbi"></iframe>`;
    return;
  }
  if (id === "api") {
    stage.innerHTML = `<iframe title="docs" src="/docs"></iframe>`;
    return;
  }
  if (id === "saude") {
    stage.innerHTML = `<div class="panel"><pre id="h">carregando…</pre><button type="button" id="rh">Atualizar</button></div>`;
    const load = async () => {
      const r = await fetch("/health").then((x) => x.json()).catch((e) => ({ error: String(e) }));
      document.getElementById("h").textContent = JSON.stringify(r, null, 2);
    };
    document.getElementById("rh").onclick = load;
    load();
    return;
  }
  if (id === "chaves") {
    const k = keys();
    stage.innerHTML = `<div class="panel">
      <p>Não vai para o GitHub. Salvar aqui vale na sala Jarvis.</p>
      <label>OpenRouter <input id="k-or" type="password" placeholder="sk-or-…"></label>
      <label>Groq <input id="k-gq" type="password" placeholder="gsk_…"></label>
      <label>Gemini <input id="k-ge" type="password" placeholder="AIza…"></label>
      <label>OpenAI <input id="k-oa" type="password" placeholder="sk-…"></label>
      <p id="ks"></p>
      <button type="button" id="ksave">Salvar</button>
    </div>`;
    document.getElementById("k-or").value = k.openrouter || "";
    document.getElementById("k-gq").value = k.groq || "";
    document.getElementById("k-ge").value = k.gemini || "";
    document.getElementById("k-oa").value = k.openai || "";
    document.getElementById("ksave").onclick = () => {
      const next = {
        openrouter: document.getElementById("k-or").value.trim(),
        groq: document.getElementById("k-gq").value.trim(),
        gemini: document.getElementById("k-ge").value.trim(),
        openai: document.getElementById("k-oa").value.trim(),
      };
      localStorage.setItem(KEYS, JSON.stringify(next));
      document.getElementById("ks").textContent = "Salvo neste navegador.";
      paintKeys();
    };
    return;
  }
  if (id === "studio") {
    const html = bag().html || "<h1>Studio NEXUS</h1><p>HTML local.</p>";
    stage.innerHTML = `<div class="panel">
      <textarea id="html" rows="10"></textarea>
      <button type="button" id="run">Preview</button>
      <button type="button" id="snap">Checkpoint</button>
      <iframe id="prev" sandbox="allow-scripts" style="height:40vh"></iframe>
    </div>`;
    const area = document.getElementById("html");
    area.value = html;
    const run = () => { document.getElementById("prev").srcdoc = area.value; };
    document.getElementById("run").onclick = run;
    document.getElementById("snap").onclick = () => put({ html: area.value });
    run();
    return;
  }
  if (id === "inbox") {
    const files = bag().files || [];
    stage.innerHTML = `<div class="panel"><input id="f" type="file" multiple><div class="list" id="list"></div></div>`;
    const draw = () => {
      document.getElementById("list").innerHTML = files.map((f, i) =>
        `<div class="item">${f.name} · ${f.size} b <button type="button" data-i="${i}">tirar</button></div>`
      ).join("") || "<p>Vazio.</p>";
      document.querySelectorAll("#list button").forEach((b) => {
        b.onclick = () => { files.splice(+b.dataset.i, 1); put({ files }); draw(); };
      });
    };
    document.getElementById("f").onchange = (ev) => {
      [...ev.target.files].forEach((f) => files.push({ name: f.name, size: f.size }));
      put({ files });
      draw();
    };
    draw();
    return;
  }
  if (id === "jobs") {
    const jobs = bag().jobs || [];
    stage.innerHTML = `<div class="panel">
      <input id="j" placeholder="Novo job"><button type="button" id="add">Adicionar</button>
      <div class="list" id="list"></div>
    </div>`;
    const draw = () => {
      document.getElementById("list").innerHTML = jobs.map((j, i) =>
        `<div class="item">${j.done ? "ok" : "aberto"} — ${j.text}
         <button type="button" data-i="${i}">${j.done ? "apagar" : "concluir"}</button></div>`
      ).join("") || "<p>Fila vazia.</p>";
      document.querySelectorAll("#list button").forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i;
          if (jobs[i].done) jobs.splice(i, 1); else jobs[i].done = true;
          put({ jobs }); draw();
        };
      });
    };
    document.getElementById("add").onclick = () => {
      const text = document.getElementById("j").value.trim();
      if (!text) return;
      jobs.unshift({ text, done: false });
      document.getElementById("j").value = "";
      put({ jobs }); draw();
    };
    draw();
    return;
  }
  if (id === "notas") {
    stage.innerHTML = `<div class="panel"><textarea id="notes" rows="16" placeholder="Notas da mesa"></textarea>
      <button type="button" id="saven">Salvar nota</button><span id="ns"></span></div>`;
    document.getElementById("notes").value = bag().notes || "";
    document.getElementById("saven").onclick = () => {
      put({ notes: document.getElementById("notes").value });
      document.getElementById("ns").textContent = " salvo";
    };
    return;
  }
  if (id === "changelog") {
    stage.innerHTML = `<div class="panel"><pre id="cl">…</pre></div>`;
    fetch("/changelog").then(r=>r.json()).then(d=>{
      document.getElementById("cl").textContent = JSON.stringify(d, null, 2);
    }).catch(e=>{ document.getElementById("cl").textContent = String(e); });
    return;
  }
  if (id === "mapa") {
    stage.innerHTML = `<div class="panel">
      <p>● código real &nbsp; ◐ incompleto &nbsp; ○ sem motor — não tem botão aqui</p>
      <ul>
        <li>● Jarvis — FastAPI /sala /chat</li>
        <li>◐ ORBI — um quiz, não o APK inteiro</li>
        <li>● API, health, chaves locais</li>
        <li>● Studio / inbox / jobs no browser</li>
        <li>○ Claude Code, Docker, Drive, git clone, LibreChat — fora desta mesa</li>
      </ul>
    </div>`;
  }
}

function paintKeys() {
  const k = keys();
  const n = ["openrouter", "groq", "gemini", "openai"].filter((x) => k[x]).length;
  const el = document.getElementById("pill-keys");
  el.textContent = n ? n + " chave(s) neste browser" : "sem chave neste browser";
  el.className = "pill " + (n ? "ok" : "warn");
}

fetch("/health").then((r) => r.json()).then((h) => {
  document.getElementById("pill-ver").textContent = "v" + (h.version || "?");
}).catch(() => {});
paintKeys();
openMod(bag().last || "jarvis");
