const KEY = "cas-nexus-tools-v1";
const tabs = [
  { id: "comando", label: "Comando" },
  { id: "jarvis", label: "Jarvis" },
  { id: "studio", label: "Studio" },
  { id: "inbox", label: "Inbox" },
  { id: "jobs", label: "Jobs" },
  { id: "monitor", label: "Monitor" },
  { id: "custo", label: "Custo" },
  { id: "chaves", label: "Chaves" },
];

function store() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function save(p) { localStorage.setItem(KEY, JSON.stringify({ ...store(), ...p })); }

const nav = document.getElementById("tabs");
const pane = document.getElementById("pane");
tabs.forEach((t) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = t.label;
  b.onclick = () => show(t.id);
  nav.appendChild(b);
});

function mark(id) {
  [...nav.children].forEach((b, i) => b.classList.toggle("on", tabs[i].id === id));
}

function show(id) {
  mark(id);
  if (id === "comando") {
    pane.innerHTML = `<p>Atalhos que existem neste site.</p>
      <div class="row">
        <a class="pill" href="/sala">Jarvis sala</a>
        <a class="pill" href="/orbi">ORBI</a>
        <a class="pill" href="/docs">API</a>
        <a class="pill" href="/health">Health</a>
      </div>
      <input id="cmd" placeholder="sala, orbi, docs, health">
      <button type="button" id="go">Ir</button>`;
    document.getElementById("go").onclick = () => {
      const v = (document.getElementById("cmd").value || "").toLowerCase();
      const map = { sala: "/sala", jarvis: "/sala", orbi: "/orbi", docs: "/docs", health: "/health", casa: "/" };
      const hit = Object.keys(map).find((k) => v.includes(k));
      if (hit) location.href = map[hit];
    };
    return;
  }
  if (id === "jarvis") {
    pane.innerHTML = `<p>Jarvis embutido na mesa NEXUS. Chaves em Ajustes da sala ou na aba Chaves.</p>
      <iframe class="jarvis-frame" title="Jarvis" src="/sala"></iframe>`;
    return;

  }
  if (id === "studio") {
    const html = store().html || "<h1>Studio NEXUS</h1><p>Edite e veja o preview.</p>";
    pane.innerHTML = `<p>Sandbox HTML local. Checkpoint neste navegador.</p>
      <textarea id="html" rows="8"></textarea>
      <div class="row">
        <button type="button" id="run">Preview</button>
        <button type="button" id="snap">Salvar checkpoint</button>
      </div>
      <iframe id="prev" sandbox="allow-scripts"></iframe>`;
    const area = document.getElementById("html");
    area.value = html;
    const run = () => { document.getElementById("prev").srcdoc = area.value; };
    document.getElementById("run").onclick = run;
    document.getElementById("snap").onclick = () => { save({ html: area.value }); };
    run();
    return;
  }
  if (id === "inbox") {
    const files = store().files || [];
    pane.innerHTML = `<p>Inbox local: arquivo entra neste navegador, não vai para nuvem.</p>
      <input id="f" type="file" multiple>
      <div class="list" id="list"></div>`;
    const draw = () => {
      document.getElementById("list").innerHTML = files.map((f, i) =>
        `<div class="item">${f.name} · ${f.size} b <button type="button" data-i="${i}">tirar</button></div>`
      ).join("") || "<p>Vazio.</p>";
      document.querySelectorAll("#list button").forEach((b) => {
        b.onclick = () => { files.splice(+b.dataset.i, 1); save({ files }); draw(); };
      });
    };
    document.getElementById("f").onchange = (ev) => {
      [...ev.target.files].forEach((f) => files.push({ name: f.name, size: f.size, at: Date.now() }));
      save({ files });
      draw();
    };
    draw();
    return;
  }
  if (id === "jobs") {
    const jobs = store().jobs || [];
    pane.innerHTML = `<p>Fila local. Job aqui é nota, não shell remoto.</p>
      <input id="j" placeholder="Novo job">
      <button type="button" id="add">Adicionar</button>
      <div class="list" id="list"></div>`;
    const draw = () => {
      document.getElementById("list").innerHTML = jobs.map((j, i) =>
        `<div class="item">${j.done ? "ok" : "aberto"} — ${j.text} <button type="button" data-i="${i}">${j.done ? "apagar" : "concluir"}</button></div>`
      ).join("") || "<p>Fila vazia.</p>";
      document.querySelectorAll("#list button").forEach((b) => {
        b.onclick = () => {
          const i = +b.dataset.i;
          if (jobs[i].done) jobs.splice(i, 1);
          else jobs[i].done = true;
          save({ jobs });
          draw();
        };
      });
    };
    document.getElementById("add").onclick = () => {
      const text = document.getElementById("j").value.trim();
      if (!text) return;
      jobs.unshift({ text, done: false, at: Date.now() });
      document.getElementById("j").value = "";
      save({ jobs });
      draw();
    };
    draw();
    return;
  }
  if (id === "monitor") {
    pane.innerHTML = `<p>Health do Jarvis + memória do browser.</p><pre id="m"></pre><button type="button" id="ref">Atualizar</button>`;
    const load = async () => {
      const h = await fetch("/health").then((r) => r.json()).catch((e) => ({ error: String(e) }));
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB JS" : "memória indisponível";
      document.getElementById("m").textContent = JSON.stringify(h, null, 2) + "\n" + mem;
    };
    document.getElementById("ref").onclick = load;
    load();
    return;
  }
  if (id === "custo") {
    pane.innerHTML = `<p>Estimativa local (não é fatura do provedor).</p>
      <label>Tokens<input id="tok" type="number" value="2000"></label>
      <label>USD / 1k tokens<input id="rate" type="number" step="0.0001" value="0.002"></label>
      <p id="out"></p>
      <button type="button" id="calc">Calcular</button>`;
    document.getElementById("calc").onclick = () => {
      const tok = +document.getElementById("tok").value || 0;
      const rate = +document.getElementById("rate").value || 0;
      document.getElementById("out").textContent = "≈ USD " + ((tok / 1000) * rate).toFixed(4);
    };
    return;
  }
  if (id === "chaves") {
    const k = JSON.parse(localStorage.getItem("cas-jarvis-keys-v20") || "{}");
    pane.innerHTML = `<p>Mesmo cofre da sala Jarvis. Só neste navegador.</p>
      <label>OpenRouter<input id="k-or" type="password" placeholder="sk-or-…"></label>
      <label>Groq<input id="k-gq" type="password" placeholder="gsk_…"></label>
      <label>Gemini<input id="k-ge" type="password" placeholder="AIza…"></label>
      <label>OpenAI<input id="k-oa" type="password" placeholder="sk-…"></label>
      <p id="ks"></p>
      <button type="button" id="ksave">Salvar</button>`;
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
      localStorage.setItem("cas-jarvis-keys-v20", JSON.stringify(next));
      document.getElementById("ks").textContent = "Salvo. Chat da sala e do NEXUS usam estas chaves.";
    };
  }
}

fetch("/health").then((r) => r.json()).then((h) => {
  document.getElementById("nx-health").textContent = "Jarvis " + (h.version || "?");
}).catch(() => {});
show("jarvis");
