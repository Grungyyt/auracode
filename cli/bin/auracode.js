#!/usr/bin/env node
/* AuraCode — agent terminal connecté au cloud VTH (api.ia.vth-mc.fr).
 * Zéro dépendance, Node 18+. Stockage privé : sessions sur ton VPS.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");

const API = process.env.AURA_API || "https://api.ia.vth-mc.fr";
const HOME = path.join(os.homedir(), ".auracode");
const CONFIG_FILE = path.join(HOME, "config.json");
const SESSIONS_FILE = path.join(HOME, "sessions.json");
// IMPORTANT : garder synchronisé avec cli/package.json (vérifié par scripts/build-exe.js)
const PKG = { version: "0.6.0" };

const ART_LINES = [
  " █████╗ ██╗   ██╗██████╗  █████╗  ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "███████║██║   ██║██████╔╝███████║██║     ██║   ██║██║  ██║█████╗",
  "██╔══██║██║   ██║██╔══██╗██╔══██║██║     ██║   ██║██║  ██║██╔══╝",
  "██║  ██║╚██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝██████╔╝███████╗",
  "╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚═════╝ ╚══════╝",
];
const ART_COLORS = ["pink", "peach", "lemon", "mint", "sky", "lavender", "pink"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Palette pastel ----------
const P = {
  reset: "\x1b[0m",
  pink: "\x1b[38;2;255;179;199m",
  mint: "\x1b[38;2;150;230;190m",
  lavender: "\x1b[38;2;190;190;235m",
  peach: "\x1b[38;2;255;200;150m",
  sky: "\x1b[38;2;160;210;250m",
  lemon: "\x1b[38;2;255;240;170m",
  dim: "\x1b[38;2;170;170;180m",
  bold: "\x1b[1m",
};
const pastel = (color, s) => P[color] + s + P.reset;
function pastelBox(title, lines) {
  const width = 58;
  const bar = P.lavender + "─".repeat(width) + P.reset;
  console.log(bar);
  console.log(P.bold + P.pink + "  " + title + P.reset);
  console.log(bar);
  (lines || []).forEach((l) => console.log("  " + l));
  console.log(bar);
}

// Thèmes de couleur (pastel par défaut, modifiables avec /theme).
const THEMES = {
  pastel: { pink: "\x1b[38;2;255;179;199m", mint: "\x1b[38;2;150;230;190m", lavender: "\x1b[38;2;190;190;235m", peach: "\x1b[38;2;255;200;150m", sky: "\x1b[38;2;160;210;250m", lemon: "\x1b[38;2;255;240;170m", dim: "\x1b[38;2;170;170;180m" },
  sunset: { pink: "\x1b[38;2;255;107;107m", mint: "\x1b[38;2;255;209;102m", lavender: "\x1b[38;2;244;162;97m", peach: "\x1b[38;2;231;111;81m", sky: "\x1b[38;2;233;196;106m", lemon: "\x1b[38;2;244;162;97m", dim: "\x1b[38;2;150;150;150m" },
  ocean: { pink: "\x1b[38;2;72;202;228m", mint: "\x1b[38;2;144;224;239m", lavender: "\x1b[38;2;119;141;169m", peach: "\x1b[38;2;100;223;223m", sky: "\x1b[38;2;0;187;249m", lemon: "\x1b[38;2;128;255;219m", dim: "\x1b[38;2;140;140;140m" },
  mono: { pink: "\x1b[37m", mint: "\x1b[37m", lavender: "\x1b[37m", peach: "\x1b[37m", sky: "\x1b[37m", lemon: "\x1b[37m", dim: "\x1b[90m" },
};

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
const getKey = () => (loadJson(CONFIG_FILE, {}).apiKey || "").trim();

async function intro() {
  const W = process.stdout.columns || 80;
  const show = (text, color) => {
    const pad = " ".repeat(Math.max(0, Math.floor((W - text.length) / 2)));
    console.log(pad + (color ? P[color] + text + P.reset : text));
  };
  console.log("");
  ART_LINES.forEach((ln, i) => show(ln, ART_COLORS[i % ART_COLORS.length]));
  show("L'IA qui pilote ton PC — propulsée par le cloud VTH", "sky");
  console.log("");
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < 2000) {
    const label = `Connexion au cloud VTH ${frames[i++ % frames.length]} `;
    process.stdout.write("\r" + " ".repeat(Math.max(0, Math.floor((W - label.length) / 2))) + pastel("lavender", label));
    await sleep(80);
  }
  const ok = "Connecté au cloud VTH ✓";
  process.stdout.write("\r" + " ".repeat(Math.max(0, Math.floor((W - ok.length) / 2))) + pastel("mint", ok) + "                    \n");
}

async function checkUpdate() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://raw.githubusercontent.com/Grungyyt/auracode/main/cli/package.json", {
      signal: ctrl.signal,
      headers: { "User-Agent": "auracode" },
    });
    clearTimeout(t);
    if (!r.ok) return;
    const latest = (await r.json()).version;
    if (latest && latest !== PKG.version) {
      console.log(`\nNouvelle version ${latest} disponible (tu as ${PKG.version}) : lance \`auracode update\`\n`);
    }
  } catch { /* silencieux */ }
}

// Mise à jour : mode .exe via releases GitHub, mode script via fichiers du repo.
async function selfUpdate() {
  const isExe = process.platform === "win32" && /auracode\.exe$/i.test(process.execPath);
  if (isExe) {
    console.log("Recherche de mise à jour...");
    const r = await fetch("https://api.github.com/Grungyyt/auracode/releases/latest", {
      headers: { "User-Agent": "auracode" },
    });
    if (!r.ok) { console.log("Impossible de contacter GitHub."); return; }
    const rel = await r.json();
    const latest = (rel.tag_name || "").replace(/^v/, "");
    if (!latest || latest === PKG.version) {
      console.log("Déjà à jour (" + PKG.version + ").");
      return;
    }
    const asset = (rel.assets || []).find((a) => /auracode.*\.exe$/i.test(a.name));
    if (!asset) { console.log("Aucun .exe dans la release " + rel.tag_name); return; }
    const exePath = process.execPath;
    const tmp = exePath + ".new";
    console.log("Téléchargement " + latest + "...");
    const dl = await fetch(asset.browser_download_url, { headers: { "User-Agent": "auracode" } });
    fs.writeFileSync(tmp, Buffer.from(await dl.arrayBuffer()));
    const ps = [
      "$p='" + exePath + "'; $n='" + tmp + "'; $i=0;",
      "while ((Test-Path $p) -and ($i -lt 120)) { try { Move-Item -Force $n $p; break } catch { Start-Sleep -Milliseconds 500 }; $i++ }",
      "Start-Process $p;",
    ].join(" ");
    const { spawn } = require("child_process");
    spawn("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps], {
      detached: true, stdio: "ignore",
    }).unref();
    console.log("Mise à jour installée, redémarrage...");
    setTimeout(() => process.exit(0), 600);
    return;
  }
  // Mode script (install.ps1 / npm link) : re-télécharge les fichiers du repo.
  console.log("Mise à jour depuis GitHub...");
  const base = "https://raw.githubusercontent.com/Grungyyt/auracode/main";
  const head = { "User-Agent": "auracode" };
  const rp = await (await fetch(base + "/cli/package.json", { headers: head })).json();
  if (!rp.version || rp.version === PKG.version) {
    console.log("Déjà à jour (" + PKG.version + ").");
    return;
  }
  const js = await (await fetch(base + "/cli/bin/auracode.js", { headers: head })).text();
  if (!js.includes("AuraCode")) throw new Error("Téléchargement invalide.");
  const dir = path.dirname(__filename);
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(rp, null, 2));
  fs.writeFileSync(__filename, js);
  console.log("Mis à jour vers " + rp.version + ". Relance auracode.");
}

async function api(pathname, body, key, method = "POST") {
  const res = await fetch(API + pathname, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function sessionFile() { return loadJson(SESSIONS_FILE, {}); }
function getSessionId() { return sessionFile()[process.cwd()] || null; }
function setSessionId(id) {
  const m = sessionFile(); m[process.cwd()] = id; saveJson(SESSIONS_FILE, m);
}
async function newSession(key, model) {
  const s = await api("/api/sessions", { model }, key);
  setSessionId(s.session_id);
  return s.session_id;
}

// ---------- Outils locaux (le PC) ----------
function inside(p) {
  const abs = path.resolve(process.cwd(), p);
  if (abs !== process.cwd() && !abs.startsWith(process.cwd() + path.sep)) {
    throw new Error("Refusé : hors du dossier projet.");
  }
  return abs;
}
function ask(rl, q) {
  return new Promise((res) => rl.question(q + " [o/N] ", (a) => res(/^o(ui)?$/i.test(a.trim()))));
}
const TOOLS = {
  read_file: {
    desc: "Lit un fichier texte (max 20 Ko). Args: {path}",
    run: async ({ path: p }) => fs.readFileSync(inside(p), "utf8").slice(0, 20000),
  },
  list_dir: {
    desc: "Liste un dossier. Args: {path?} (défaut .)",
    run: async ({ path: p = "." }) => fs.readdirSync(inside(p)).join("\n"),
  },
  write_file: {
    desc: "Écris un fichier (demande confirmation). Args: {path, content}",
    run: async ({ path: p, content }, ui) => {
      const abs = inside(p);
      ui.sys(`--- Aperçu de ${p} (${(content || "").length} caractères) ---`);
      ui.sys(String(content || "").slice(0, 1500));
      ui.sys("--- fin aperçu ---");
      if (!(await ui.confirm("Écrire ce fichier ?"))) return "Annulé par l'utilisateur.";
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content || "");
      return "Fichier écrit : " + p;
    },
  },
  exec: {
    desc: "Exécute une commande shell (demande confirmation). Args: {cmd}",
    run: (args, ui) => new Promise(async (resolve) => {
      ui.sys("$ " + args.cmd);
      if (!(await ui.confirm("Exécuter ?"))) return resolve("Annulé par l'utilisateur.");
      exec(args.cmd, { cwd: process.cwd(), timeout: 60000, maxBuffer: 1024 * 500 }, (err, stdout, stderr) => {
        let out = (stdout || "") + (stderr ? "\n[stderr]\n" + stderr : "");
        if (err && !out) out = "Erreur: " + err.message;
        resolve(out.slice(0, 8000) || "(pas de sortie)");
      });
    }),
  },
  search: {
    desc: "Cherche un texte dans les fichiers. Args: {pattern, path?}",
    run: async ({ pattern, path: p = "." }) => {
      const out = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name === "node_modules" || e.name === ".git") continue;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) { if (out.join("\n").length < 6000) walk(full); }
          else {
            try {
              const c = fs.readFileSync(full, "utf8");
              c.split("\n").forEach((l, i) => {
                if (l.includes(pattern) && out.length < 60) out.push(`${full}:${i + 1}: ${l.trim().slice(0, 160)}`);
              });
            } catch { /* binaire, ignoré */ }
          }
        }
      };
      walk(inside(p));
      return out.join("\n") || "Aucun résultat.";
    },
  },
  open_file: {
    desc: "Ouvre un fichier/dossier avec le programme par défaut (demande confirmation). Args: {path}",
    run: async ({ path: p }, ui) => {
      const abs = inside(p);
      const plat = process.platform;
      const cmd = plat === "win32" ? `start "" "${abs}"` : plat === "darwin" ? `open "${abs}"` : `xdg-open "${abs}"`;
      if (!(await ui.confirm(`Ouvrir ${p} ?`))) return "Annulé par l'utilisateur.";
      await new Promise((resolve, reject) =>
        exec(cmd, { timeout: 15000 }, (e) => (e ? reject(e) : resolve(null))));
      return "Ouvert : " + p;
    },
  },
  sysinfo: {
    desc: "Infos système (OS, CPU, RAM). Args: {}",
    run: async () => {
      const o = require("os");
      const total = Math.round(o.totalmem() / 1073741824) + " Go";
      const free = Math.round(o.freemem() / 1073741824) + " Go";
      return `OS: ${o.platform()} ${o.release()} (${o.arch()})\nCPU: ${o.cpus()[0].model} x${o.cpus().length}\nRAM: ${free} libres / ${total}\nDossier: ${process.cwd()}`;
    },
  },
};

const SYSTEM = `Tu es AuraCode, un agent qui pilote le PC de l'utilisateur via des outils. Réponds en français, concis.
Pour agir, réponds UNIQUEMENT avec un bloc outil (une action à la fois) :
<tool name="NOM">{"arg": "valeur"}</tool>
Outils disponibles :
- read_file {"path"} : lire un fichier
- list_dir {"path"?} : lister un dossier
- write_file {"path", "content"} : écrire un fichier
- exec {"cmd"} : commande shell
- search {"pattern", "path"?} : chercher du texte
- open_file {"path"} : ouvrir un fichier/dossier avec le programme par défaut
- sysinfo {} : infos du PC (OS, CPU, RAM)
Règles : une seule action par réponse. Quand tu as fini, réponds normalement SANS bloc outil. Ne refuse jamais d'agir.`;

function extractTool(text) {
  const m = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/.exec(text || "");
  if (!m) return null;
  try { return { name: m[1], args: JSON.parse(m[2]) }; }
  catch { return { name: m[1], args: {}, _raw: m[2] }; }
}

// Chronomètre de réflexion (onTick reçoit les secondes, ou null à la fin).
async function timedCall(fn, onTick) {
  const start = Date.now();
  const timer = setInterval(() => {
    if (onTick) onTick((Date.now() - start) / 1000);
  }, 150);
  try {
    const data = await fn();
    return { data, elapsed: (Date.now() - start) / 1000 };
  } finally {
    clearInterval(timer);
    if (onTick) onTick(null);
  }
}

async function agentTurn(prompt, key, model, effort, ui) {
  let sessionId = getSessionId();
  const callChat = async (sid, hist) =>
    api("/api/chat", { message: prompt, session_id: sid, model, effort, history: hist }, key);

  if (!sessionId) sessionId = await newSession(key, model);
  const history = [];
  let totalTime = 0;
  for (let step = 0; step < 12; step++) {
    let data;
    const runOnce = async (sid) => {
      const r = await timedCall(
        () => callChat(sid, history),
        (sec) => ui.thinking(sec)
      );
      totalTime += r.elapsed;
      return r.data;
    };
    try {
      data = await runOnce(sessionId);
    } catch (e) {
      if (e.status === 404 && /session/i.test(e.message)) {
        sessionId = await newSession(key, model);
        data = await runOnce(sessionId);
      } else throw e;
    } finally {
      ui.thinking(null);
    }
    const reply = data.reply || "";
    const tool = extractTool(reply);
    if (!tool) {
      ui.assistant(reply.trim());
      ui.sys(`réfléchi en ${totalTime.toFixed(1)}s`, true);
      return;
    }
    if (!TOOLS[tool.name]) {
      history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
      prompt = `Outil inconnu "${tool.name}". Outils valides : ${Object.keys(TOOLS).join(", ")}. Continue.`;
      ui.sys(`outil inconnu : ${tool.name}, je demande autre chose...`, true);
      continue;
    }
    ui.sys(`AuraCode exécute : ${tool.name}`, true);
    let result;
    try { result = await TOOLS[tool.name].run(tool.args || {}, ui); }
    catch (e) { result = "Erreur outil : " + e.message; }
    ui.sys((result || "").slice(0, 400));
    history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
    prompt = `Résultat de ${tool.name} :\n${result}\nContinue ta tâche (une action à la fois, ou réponds sans bloc outil si terminé).`;
  }
  ui.sys(`réfléchi en ${totalTime.toFixed(1)}s — limite de 12 étapes atteinte.`, true);
}

// Menu fléché pastel (choix au clavier)
function choose(prompt, options) {
  const pickNumbered = () => new Promise((resolve) => {
    console.log(pastel("lavender", "◆ " + prompt));
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label}${o.desc ? "  —  " + o.desc : ""}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Numéro : ", (a) => {
      rl.close();
      const n = parseInt(a.trim(), 10);
      resolve(n >= 1 && n <= options.length ? options[n - 1].value : null);
    });
  });
  if (!process.stdin.isTTY) return pickNumbered();
  return new Promise((resolve) => {
    let idx = 0;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    const render = () => {
      console.clear();
      console.log(P.bold + P.lavender + "◆ " + prompt + P.reset + "\n");
      options.forEach((o, i) => {
        const active = i === idx;
        const prefix = active ? pastel("pink", "❯ ") : "  ";
        const name = active ? P.bold + P.lemon + o.label + P.reset : P.dim + o.label + P.reset;
        console.log(prefix + name + (o.desc ? P.dim + "  —  " + o.desc + P.reset : ""));
      });
      console.log("\n" + P.dim + "↑↓ naviguer • Entrée valider • Échap annuler" + P.reset);
    };
    const cleanup = () => {
      process.stdin.removeListener("keypress", onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    };
    const onKey = (str, key) => {
      if (key.name === "up") { idx = (idx - 1 + options.length) % options.length; render(); }
      else if (key.name === "down") { idx = (idx + 1) % options.length; render(); }
      else if (key.name === "return") { cleanup(); console.clear(); resolve(options[idx].value); }
      else if (key.name === "escape" || (key.ctrl && key.name === "c")) { cleanup(); console.clear(); resolve(null); }
    };
    process.stdin.on("keypress", onKey);
    render();
  });
}

// ---------- Écran d'installation ----------
async function cmdSetup() {
  console.clear();
  pastelBox("Bienvenue dans AuraCode — installation", [
    pastel("sky", "Configuration en 3 étapes, couleurs pastel incluses."),
    "",
  ]);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askLine = (q) => new Promise((res) => rl.question(P.sky + "◆ " + q + P.reset + " ", res));

  // 1. Clé API
  let key = getKey();
  if (key) {
    console.log("\n" + pastel("mint", "✓ Clé API déjà enregistrée."));
    const keep = await new Promise((res) =>
      rl.question("La garder ? [O/n] ", (a) => res(!/^n(on)?$/i.test(a.trim()))));
    if (!keep) key = "";
  }
  if (!key) {
    console.log("\n" + pastel("lavender", "◆ Étape 1/3 — Colle ta clé API (ak-vth-... depuis https://auth.vth-mc.fr/profile)"));
    key = (await askLine("Clé :")).trim();
    if (!key) { console.log(pastel("pink", "Clé vide, installation annulée.")); rl.close(); return; }
    const cfg = loadJson(CONFIG_FILE, {});
    cfg.apiKey = key; saveJson(CONFIG_FILE, cfg);
  }

  // 2. Modèle (avec stats visibles)
  console.log("");
  const model = await choose("Étape 2/3 — Choisis ton modèle", [
    { value: "aura-1.1", label: "Aura 1.1", desc: "1.5B • ~30 mots/s • coût x1 • quotidien" },
    { value: "aura-1.2", label: "Aura 1.2", desc: "7B • ~8 mots/s • coût x4 • le plus malin" },
    { value: "aura-1.1-code", label: "Aura 1.1 Code", desc: "3B code • ~20 mots/s • coût x2 • programmation" },
  ]);
  if (!model) { console.log("Annulé."); rl.close(); return; }

  // 3. Effort (avec temps et coût visibles)
  console.log("");
  const effort = (await choose("Étape 3/3 — Niveau de réflexion", [
    { value: "low", label: "Low", desc: "~5-10s • 256 tokens • coût x1 • réponses courtes" },
    { value: "middle", label: "Middle", desc: "~15-30s • 512 tokens • coût x1 • équilibré" },
    { value: "high", label: "High", desc: "~1-2 min • 1024 tokens • coût x1.5 • détaillé" },
    { value: "xhigh", label: "XHigh", desc: "~2-4 min • 1536 tokens • coût x2 • réflexion maximale" },
  ])) || "middle";

  const cfg = loadJson(CONFIG_FILE, {});
  cfg.apiKey = key; cfg.model = model; cfg.effort = effort;
  saveJson(CONFIG_FILE, cfg);
  rl.close();

  console.log("\n" + pastel("sky", "◆ Test de connexion au cloud..."));
  try {
    const me = await api("/api/me", null, key, "GET");
    console.log(pastel("mint", `✓ Connecté ! ${me.sessions || 0} discussion(s) sur ton compte.`));
  } catch (e) {
    console.log(pastel("pink", "✗ Échec : " + e.message + " (vérifie ta clé)"));
    return;
  }
  pastelBox("Installation terminée ✓", [
    `Modèle par défaut : ${pastel("lemon", model)}   Effort : ${pastel("lemon", effort)}`,
    "",
    "Lance " + P.bold + "auracode" + P.reset + " pour discuter avec ton PC.",
  ]);
}

// ---------- Commandes slash (avec autocomplétion) ----------
const COMMANDS = [
  { name: "/new", desc: "Nouvelle conversation" },
  { name: "/model", desc: "Voir / changer de modèle", values: ["aura-1.1", "aura-1.2", "aura-1.1-code"] },
  { name: "/effort", desc: "Voir / changer l'effort", values: ["low", "middle", "high", "xhigh"] },
  { name: "/quota", desc: "Afficher ton quota global" },
  { name: "/image", desc: "Générer une image : /image <texte>" },
  { name: "/copy", desc: "Copier la dernière réponse" },
  { name: "/export", desc: "Sauver la conversation en markdown" },
  { name: "/theme", desc: "Changer de thème de couleur" },
  { name: "/clear", desc: "Effacer l'écran" },
  { name: "/help", desc: "Aide" },
  { name: "/exit", desc: "Quitter" },
];

const timeStr = () => {
  try { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

function wrapText(text, width) {
  const out = [];
  for (const para of String(text).split("\n")) {
    if (para === "") { out.push(""); continue; }
    let line = para;
    while (line.length > width) {
      let cut = line.lastIndexOf(" ", width);
      if (cut <= 0) cut = width;
      out.push(line.slice(0, cut));
      line = line.slice(cut).replace(/^ +/, "");
    }
    out.push(line);
  }
  return out;
}

// ---------- Écran plein terminal ----------
class Screen {
  constructor(state) {
    this.state = state;
    this.W = 80; this.H = 24;
    this.messages = [];
    this.input = "";
    this.cursor = 0;
    this.offset = 0;
    this.scroll = 0;
    this.stuck = true;
    this.completion = null;
    this.confirmState = null;
    this.busy = false;
    this.thinkSec = null;
    this.quotaText = "";
    this.hist = [];
    this.histIdx = -1;
    this.draft = "";
    this.done = null;
    this.onLine = null;
    this.typeTimer = null;
    this.boundKey = null;
    this.boundResize = null;
  }

  start() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    this.boundKey = (s, k) => this.handleKey(s || "", k || {});
    process.stdin.on("keypress", this.boundKey);
    this.boundResize = () => this.render();
    process.stdout.on("resize", this.boundResize);
    process.stdout.write("\x1b[?1049h");
    this.render();
  }

  stop() {
    try {
      if (this.typeTimer) { clearInterval(this.typeTimer); this.typeTimer = null; }
      process.stdout.write("\x1b[?25h");
      if (this.boundKey) process.stdin.removeListener("keypress", this.boundKey);
      if (this.boundResize) process.stdout.removeListener("resize", this.boundResize);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write("\x1b[?1049l");
      process.stdin.pause();
    } catch { /* ignore */ }
  }

  loop() {
    return new Promise((resolve) => { this.done = resolve; });
  }

  quit() {
    const d = this.done;
    this.done = null;
    this.stop();
    if (d) d();
  }

  sys(text, dim) {
    this.messages.push({ role: "system", text: String(text), dim: !!dim });
    if (this.messages.length > 300) this.messages.splice(0, this.messages.length - 300);
    this.render();
  }

  assistant(text) {
    const m = { role: "assistant", text: "", full: String(text), time: timeStr() };
    this.messages.push(m);
    if (this.messages.length > 300) this.messages.splice(0, this.messages.length - 300);
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.typeTimer = setInterval(() => {
      const next = Math.min(m.full.length, m.text.length + 40);
      m.text = m.full.slice(0, next);
      this.render();
      if (next >= m.full.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
      }
    }, 40);
    this.render();
  }

  thinking(sec) {
    this.thinkSec = sec;
    this.render();
  }

  confirm(q) {
    return new Promise((resolve) => {
      this.confirmState = { q: String(q), resolve };
      this.render();
    });
  }

  resolveConfirm(v) {
    const r = this.confirmState && this.confirmState.resolve;
    this.confirmState = null;
    this.render();
    if (r) r(v);
  }

  async refreshQuota() {
    try {
      const sid = getSessionId();
      if (!sid) { this.quotaText = ""; return; }
      const q = await api("/api/quota/" + sid, null, this.state.key, "GET");
      this.quotaText = `Tokens ${q.tokens_remaining}/${q.token_limit}`;
    } catch { this.quotaText = ""; }
  }

  render() {
    this.W = process.stdout.columns || 80;
    this.H = process.stdout.rows || 24;
    const W = this.W, H = this.H;
    const compItems = this.completion ? this.completion.items.slice(0, 6) : [];
    const compH = compItems.length;
    const viewH = Math.max(3, H - 5 - compH);

    const boxW = Math.min(64, Math.max(26, W - 8));
    const innerW = boxW - 4;
    const lines = [];
    const push = (vis, out) => lines.push({ vis, out: out === undefined ? vis : out });
    for (const m of this.messages) {
      if (m.role === "system") {
        for (const wl of wrapText("· " + m.text, Math.max(20, W - 8))) {
          const pad = " ".repeat(Math.max(0, Math.floor((W - wl.length) / 2)));
          push(pad + wl, P.dim + pad + wl + P.reset);
        }
        push("", "");
        continue;
      }
      const mine = m.role === "user";
      const nameColor = mine ? P.sky : P.mint;
      const border = mine ? P.pink : P.mint;
      const wrapped = [];
      for (const wl of wrapText(m.text, innerW)) wrapped.push(wl);
      if (!wrapped.length) wrapped.push("");
      const bw = Math.min(innerW, Math.max(...wrapped.map((l) => l.length)));
      const padEnd = (s) => s + " ".repeat(Math.max(0, bw - s.length));
      const top = "╭" + "─".repeat(bw + 2) + "╮";
      const bot = "╰" + "─".repeat(bw + 2) + "╯";
      const headPlain = `${mine ? "Toi" : "Aura"} • ${m.time || ""}`;
      const headOut = nameColor + P.bold + headPlain + P.reset;
      const rowsV = [headPlain, top, ...wrapped.map((wl) => `│ ${padEnd(wl)} │`), bot, ""];
      const rowsO = [headOut, border + top + P.reset, ...wrapped.map((wl) => border + "│ " + P.reset + padEnd(wl) + border + " │" + P.reset), border + bot + P.reset, ""];
      rowsV.forEach((v, i) => {
        const left = mine ? " ".repeat(Math.max(0, W - v.length - 1)) : " ";
        push(left + v, left + rowsO[i]);
      });
    }
    const total = lines.length;
    const maxScroll = Math.max(0, total - viewH);
    if (this.stuck) this.scroll = 0;
    if (this.scroll > maxScroll) this.scroll = maxScroll;
    const start = Math.max(0, total - viewH - this.scroll);
    const visible = lines.slice(start, start + viewH);
    while (visible.length < viewH) visible.unshift(null);

    let rawL = `◆ AuraCode  ${this.state.model} • ${this.state.effort}`;
    if (rawL.length > W) rawL = rawL.slice(0, W);
    const rawR = this.quotaText;
    const pad = " ".repeat(Math.max(1, W - rawL.length - rawR.length));
    const hTitle = P.bold + P.pink + "◆ AuraCode" + P.reset;
    const hMid = P.lavender + rawL.slice("◆ AuraCode".length) + P.reset;
    const header = hTitle + hMid + pad + P.mint + rawR + P.reset;

    let out = "\x1b[?25l\x1b[H";
    out += header + "\x1b[K\n";
    for (const l of visible) {
      out += (l ? l.out : "") + "\x1b[K\n";
    }
    compItems.forEach((it, i) => {
      const sel = i === this.completion.sel;
      out += (sel ? P.bold + P.pink + "> " + P.lemon + it.display + P.reset : P.dim + "  " + it.display + P.reset) + "\x1b[K\n";
    });

    let cursorCol = -1;
    if (this.confirmState) {
      const q = (`? ${this.confirmState.q} [o/N]`).slice(0, W - 4);
      out += "│ " + P.lemon + q + P.reset + " ".repeat(Math.max(0, W - 4 - q.length)) + " │" + "\x1b[K\n";
    } else {
      const boxTitle = "─ Écris ton message… ";
      out += P.dim + "╭" + boxTitle + "─".repeat(Math.max(0, W - 2 - boxTitle.length)) + "╮" + P.reset + "\x1b[K\n";
      const fieldW = W - 4;
      if (this.cursor < this.offset) this.offset = this.cursor;
      if (this.cursor - this.offset >= fieldW) this.offset = this.cursor - fieldW + 1;
      if (this.offset < 0) this.offset = 0;
      const vis = this.input.slice(this.offset, this.offset + fieldW);
      out += "│ " + P.bold + P.pink + "> " + P.reset + vis + " ".repeat(Math.max(0, fieldW - vis.length)) + " │" + "\x1b[K\n";
      out += P.dim + "╰" + "─".repeat(Math.max(0, W - 2)) + "╯" + P.reset + "\x1b[K\n";
      cursorCol = 4 + (this.cursor - this.offset);
    }

    let sL, sR = "";
    if (this.busy && this.thinkSec !== null && this.thinkSec !== undefined) {
      sL = `Aura réfléchit... ${this.thinkSec.toFixed(0)}s`;
    } else if (this.busy) {
      sL = "Travail en cours...";
    } else {
      sL = "/ = commandes • PgUp/PgDn = défiler • Ctrl+C = quitter";
    }
    if (this.scroll > 0) sR = "PgDn : bas";
    let sLine = sL;
    if (sR) sLine += " ".repeat(Math.max(1, W - sL.length - sR.length)) + sR;
    if (sLine.length > W) sLine = sLine.slice(0, W);
    const thinking = this.busy && this.thinkSec !== null && this.thinkSec !== undefined;
    out += (thinking ? P.lavender : P.dim) + sLine + P.reset;
    process.stdout.write(out);

    if (cursorCol >= 0) {
      const inputRow = 1 + viewH + compH + 2;
      process.stdout.write(`\x1b[${inputRow + 1};${cursorCol + 1}H\x1b[?25h`);
    }
  }

  updateCompletion() {
    const m1 = /^\/([a-z]*)$/.exec(this.input);
    if (m1) {
      const items = COMMANDS
        .filter((c) => c.name.startsWith("/" + m1[1]))
        .map((c) => ({ insert: c.name + " ", display: `${c.name}  —  ${c.desc}` }));
      this.completion = items.length ? { items, sel: 0 } : null;
      return;
    }
    const m2 = /^\/(\w+)\s+(\S*)$/.exec(this.input);
    if (m2) {
      const cmd = COMMANDS.find((c) => c.name === "/" + m2[1]);
      if (cmd && cmd.values) {
        const items = cmd.values
          .filter((v) => v.startsWith(m2[2]))
          .map((v) => ({ insert: `/${m2[1]} ${v}`, display: v }));
        this.completion = items.length ? { items, sel: 0 } : null;
        return;
      }
    }
    this.completion = null;
  }

  acceptCompletion() {
    if (!this.completion || !this.completion.items.length) return false;
    const it = this.completion.items[Math.min(this.completion.sel, this.completion.items.length - 1)];
    this.input = it.insert;
    this.cursor = this.input.length;
    this.updateCompletion();
    this.render();
    return true;
  }

  onEdit() {
    this.updateCompletion();
    this.render();
  }

  histPrev() {
    if (!this.hist.length) return;
    if (this.histIdx === -1) { this.draft = this.input; this.histIdx = this.hist.length - 1; }
    else if (this.histIdx > 0) this.histIdx--;
    this.input = this.hist[this.histIdx];
    this.cursor = this.input.length;
    this.onEdit();
  }

  histNext() {
    if (this.histIdx === -1) return;
    if (this.histIdx >= this.hist.length - 1) { this.histIdx = -1; this.input = this.draft; }
    else { this.histIdx++; this.input = this.hist[this.histIdx]; }
    this.cursor = this.input.length;
    this.onEdit();
  }

  submit() {
    const line = this.input.trim();
    this.completion = null;
    if (!line) { this.render(); return; }
    if (this.hist[this.hist.length - 1] !== line) this.hist.push(line);
    if (this.hist.length > 100) this.hist.shift();
    this.histIdx = -1;
    this.input = "";
    this.cursor = 0;
    this.offset = 0;
    this.stuck = true;
    this.scroll = 0;
    this.render();
    if (this.onLine) this.onLine(line);
  }

  handleKey(str, key) {
    if (key.ctrl && (key.name === "c" || key.name === "d")) { this.quit(); return; }
    if (key.name === "pageup") { this.stuck = false; this.scroll += 5; this.render(); return; }
    if (key.name === "pagedown") { this.stuck = false; this.scroll = Math.max(0, this.scroll - 5); this.render(); return; }
    if (this.busy || this.typeTimer) return;
    if (this.confirmState) {
      const c = (str || "").toLowerCase();
      if (c === "y" || c === "o") this.resolveConfirm(true);
      else if (c === "n" || key.name === "escape" || key.name === "return") this.resolveConfirm(false);
      return;
    }
    switch (key.name) {
      case "return": this.submit(); return;
      case "backspace":
        if (this.cursor > 0) {
          this.input = this.input.slice(0, this.cursor - 1) + this.input.slice(this.cursor);
          this.cursor--;
          this.onEdit();
        }
        return;
      case "delete":
        this.input = this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
        this.onEdit();
        return;
      case "left": if (this.cursor > 0) this.cursor--; this.render(); return;
      case "right": if (this.cursor < this.input.length) this.cursor++; this.render(); return;
      case "home": this.cursor = 0; this.render(); return;
      case "end": this.cursor = this.input.length; this.render(); return;
      case "up":
        if (this.completion) {
          const n = this.completion.items.length;
          this.completion.sel = (this.completion.sel - 1 + n) % n;
          this.render();
          return;
        }
        this.histPrev();
        return;
      case "down":
        if (this.completion) {
          this.completion.sel = (this.completion.sel + 1) % this.completion.items.length;
          this.render();
          return;
        }
        this.histNext();
        return;
      case "tab": this.acceptCompletion(); return;
      case "escape":
        if (this.completion) { this.completion = null; this.render(); }
        else if (this.input) { this.input = ""; this.cursor = 0; this.render(); }
        return;
    }
    if (str && str.length === 1 && !key.ctrl && !key.meta) {
      this.input = this.input.slice(0, this.cursor) + str + this.input.slice(this.cursor);
      this.cursor += str.length;
      this.onEdit();
    }
  }
}

async function runTUI(state) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("Terminal interactif requis pour le mode plein écran.");
    process.exit(1);
  }
  const screen = new Screen(state);

  screen.onLine = async (line) => {
    if (line.startsWith("/")) {
      const [cmd, ...rest] = line.slice(1).split(" ");
      const arg = rest.join(" ").trim();
      const MODELS = ["aura-1.1", "aura-1.2", "aura-1.1-code"];
      const EFFORTS = ["low", "middle", "high", "xhigh"];
      const saveCfg = () => saveJson(CONFIG_FILE, {
        apiKey: state.key, model: state.model, effort: state.effort,
      });
      switch (cmd) {
        case "exit": case "quit": case "q": screen.quit(); return;
        case "help":
          screen.sys("Commandes :");
          COMMANDS.forEach((c) => screen.sys(`  ${c.name} — ${c.desc}`));
          return;
        case "clear": screen.messages = []; screen.render(); return;
        case "new":
          try {
            const id = await newSession(state.key, state.model);
            screen.sys("Nouvelle conversation : " + id);
            await screen.refreshQuota();
            screen.render();
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        case "model":
          if (!arg) { screen.sys("Modèle actuel : " + state.model + " (valides : " + MODELS.join(", ") + ")"); return; }
          if (!MODELS.includes(arg)) { screen.sys("Modèle inconnu. Valides : " + MODELS.join(", ")); return; }
          state.model = arg; saveCfg();
          screen.sys("Modèle : " + arg);
          screen.render();
          return;
        case "effort":
          if (!arg) { screen.sys("Effort actuel : " + state.effort + " (valides : " + EFFORTS.join(", ") + ")"); return; }
          if (!EFFORTS.includes(arg)) { screen.sys("Effort inconnu. Valides : " + EFFORTS.join(", ")); return; }
          state.effort = arg; saveCfg();
          screen.sys("Effort : " + arg);
          screen.render();
          return;
        case "quota": {
          const sid = getSessionId();
          if (!sid) { screen.sys("Aucune conversation active."); return; }
          try {
            const q = await api("/api/quota/" + sid, null, state.key, "GET");
            screen.sys(`Tokens ${q.tokens_remaining}/${q.token_limit}` + (q.locked ? ` — verrouillé ~${q.retry_after_min} min` : ""));
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "image": {
          if (!arg) { screen.sys("Usage : /image <description>"); return; }
          let sid = getSessionId();
          screen.busy = true;
          try {
            if (!sid) sid = await newSession(state.key, state.model);
            screen.sys("Génération de l'image...");
            const d = await api("/api/image", { prompt: arg, session_id: sid }, state.key);
            screen.assistant(`![image](${d.image_url})`);
            await screen.refreshQuota();
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false;
          screen.render();
          return;
        }
        case "copy": {
          const last = [...screen.messages].reverse().find((m) => m.role === "assistant" && m.text.trim());
          if (!last) { screen.sys("Rien à copier."); return; }
          try {
            const { execSync } = require("child_process");
            if (process.platform === "win32") execSync("clip", { input: last.text });
            else if (process.platform === "darwin") execSync("pbcopy", { input: last.text });
            else execSync("xclip -selection clipboard", { input: last.text });
            screen.sys("Réponse copiée.");
          } catch (e) { screen.sys("Copie impossible : " + e.message); }
          return;
        }
        case "export": {
          const fname = arg || "aura-export.md";
          const md = "# Conversation AuraCode\n\n" + screen.messages.map((m) =>
            m.role === "user" ? `**Toi :** ${m.text}` : m.role === "assistant" ? `**Aura :** ${m.text}` : `_${m.text}_`
          ).join("\n\n");
          try {
            const fp = path.resolve(process.cwd(), fname);
            fs.writeFileSync(fp, md);
            screen.sys("Exporté : " + fp);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "theme": {
          const names = Object.keys(THEMES);
          if (!arg) { screen.sys("Thème actuel : " + (state.theme || "pastel") + " (dispos : " + names.join(", ") + ")"); return; }
          if (!THEMES[arg]) { screen.sys("Thème inconnu. Dispos : " + names.join(", ")); return; }
          Object.assign(P, THEMES[arg]);
          state.theme = arg;
          saveJson(CONFIG_FILE, { apiKey: state.key, model: state.model, effort: state.effort, theme: arg });
          screen.sys("Thème : " + arg);
          screen.render();
          return;
        }
        default:
          screen.sys("Commande inconnue, /help pour la liste.");
          return;
      }
    }
    screen.messages.push({ role: "user", text: line, time: timeStr() });
    screen.busy = true;
    screen.render();
    const ui = {
      sys: (t, dim) => screen.sys(t),
      assistant: (t) => screen.assistant(t),
      thinking: (s) => screen.thinking(s),
      confirm: (q) => screen.confirm(q),
    };
    try {
      await agentTurn(line, state.key, state.model, state.effort, ui);
    } catch (e) {
      const d = e.data || {};
      screen.sys(d.quota_exceeded ? (d.error || "Quota épuisé.") : `Erreur (${e.status || "?"}) : ${e.message}`);
    }
    screen.busy = false;
    await screen.refreshQuota();
    screen.render();
  };

  screen.start();
  screen.sys(`Modèle ${state.model} • effort ${state.effort} • dossier ${process.cwd()}`);
  screen.sys("Tape / pour voir les commandes. Les réponses s'affichent ici en direct.");
  screen.busy = true;
  await screen.refreshQuota();
  screen.busy = false;
  screen.render();
  await screen.loop();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) { console.log(PKG.version); return; }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AuraCode v${PKG.version}\n\nUsage:\n  auracode              Démarre l'assistant (intro + chat)\n  auracode setup          Écran d'installation pastel (clé, modèle, effort)\n  auracode login          Colle ta clé ak-vth-... de /profile/dev\n  auracode logout         Oublie la clé\n  auracode new            Nouvelle conversation\n  auracode update         Met à jour le .exe (Windows)\n  auracode --model X      Modèle (aura-1.1, aura-1.2, aura-1.1-code)\n  auracode --effort X     Effort (low, middle, high, xhigh)\n  auracode "question"       Réponse unique sans ouvrir l'interface
  Plein écran : /new /model /effort /quota /image /copy /export /theme /clear /help (/ = suggestions)\n`);
    return;
  }
  let model = "aura-1.1-code", effort = "high";
  try {
    const saved = loadJson(CONFIG_FILE, {});
    if (saved.model) model = saved.model;
    if (saved.effort) effort = saved.effort;
  } catch { /* config absente, défauts */ }
  const mi = args.indexOf("--model");
  if (mi >= 0 && args[mi + 1]) model = args[mi + 1];
  const ei = args.indexOf("--effort");
  if (ei >= 0 && args[ei + 1]) effort = args[ei + 1];

  if (args[0] === "login") {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Colle ta clé API (ak-vth-... depuis /profile/dev) : ", (k) => {
      k = k.trim();
      if (!k) { console.log("Clé vide, annulé."); rl.close(); return; }
      const cfg = loadJson(CONFIG_FILE, {});
      cfg.apiKey = k; saveJson(CONFIG_FILE, cfg);
      console.log("Connecté ✓ (clé enregistrée dans ~/.auracode/config.json)");
      rl.close();
    });
    return;
  }
  if (args[0] === "logout") {
    const cfg = loadJson(CONFIG_FILE, {});
    delete cfg.apiKey; saveJson(CONFIG_FILE, cfg);
    console.log("Déconnecté.");
    return;
  }
  if (args[0] === "setup") {
    await cmdSetup();
    return;
  }
  if (args[0] === "new") {
    const key = getKey();
    if (!key) { console.log("Pas connecté. Lance : auracode login"); return; }
    const id = await newSession(key, model);
    console.log("Nouvelle conversation : " + id);
    return;
  }
  if (args[0] === "update") {
    await selfUpdate();
    return;
  }
  const first = args[0];
  if (first && !["login", "logout", "new", "setup", "update"].includes(first) && !first.startsWith("-")) {
    // Mode one-shot : auracode "ma question" → réponse directe, sans interface.
    const q = args.join(" ");
    let key = getKey();
    if (!key) { console.log("Pas connecté. Lance : auracode login"); return; }
    let sid = getSessionId();
    try {
      if (!sid) sid = await newSession(key, model);
      const d = await api("/api/chat", { message: q, session_id: sid, model, effort }, key);
      console.log("\n" + (d.reply || "").trim() + "\n");
    } catch (e) {
      const er = e.data || {};
      console.log(er.quota_exceeded ? (er.error || "Quota épuisé.") : "Erreur (" + (e.status || "?") + ") : " + e.message);
    }
    return;
  }

  await intro();
  checkUpdate();
  let key = getKey();
  if (!key) {
    console.log(pastel("peach", "Aucune configuration détectée — lancement de l'installation.\n"));
    await cmdSetup();
    key = getKey();
    if (!key) return;
  }
  try {
    if (!getSessionId()) await newSession(key, model);
  } catch (e) {
    console.log("Erreur API (" + (e.status || "?") + ") : " + e.message);
    return;
  }
  // ---------- Mode plein écran ----------
  const state = { key, model, effort, theme: "pastel" };
  try {
    const savedTheme = loadJson(CONFIG_FILE, {}).theme;
    if (savedTheme && THEMES[savedTheme]) {
      Object.assign(P, THEMES[savedTheme]);
      state.theme = savedTheme;
    }
  } catch { /* défaut pastel */ }
  await runTUI(state);
  return;

  /* --- Ancien mode ligne (conservé, inactif) ---
  console.log(`Modèle ${pastel("lemon", model)} • effort ${pastel("lemon", effort)} • dossier ${process.cwd()}`);
  console.log("Écris ta demande (exit pour quitter, /help pour les commandes).\n");

  const MODELS = ["aura-1.1", "aura-1.2", "aura-1.1-code"];
  const EFFORTS = ["low", "middle", "high", "xhigh"];
  const saveCfg = (patch) => {
    const cfg = loadJson(CONFIG_FILE, {});
    Object.assign(cfg, patch);
    saveJson(CONFIG_FILE, cfg);
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askPrompt = () => new Promise((res) => rl.question("> ", res));
  for (;;) {
    const line = (await askPrompt()).trim();
    if (!line) continue;
    if (/^(exit|quit|q)$/i.test(line)) break;
    if (line === "/help") {
      console.log(`
Commandes :
  /new              Nouvelle conversation
  /model [X]        Voir/Changer de modèle (aura-1.1, aura-1.2, aura-1.1-code)
  /effort [X]       Voir/Changer l'effort (low, middle, high, xhigh)
  /quota            Afficher ton quota global
  /image <texte>    Générer une image
  exit              Quitter
`);
      continue;
    }
    if (line === "/new") {
      try { console.log("Nouvelle conversation : " + await newSession(key, model)); }
      catch (e) { console.log("Erreur : " + e.message); }
      continue;
    }
    if (line === "/model" || line.startsWith("/model ")) {
      const arg = line.slice(6).trim();
      if (!arg) {
        const m = await choose("Choisis ton modèle", [
          { value: "aura-1.1", label: "Aura 1.1", desc: "1.5B • ~30 mots/s • coût x1" },
          { value: "aura-1.2", label: "Aura 1.2", desc: "7B • ~8 mots/s • coût x4" },
          { value: "aura-1.1-code", label: "Aura 1.1 Code", desc: "3B code • ~20 mots/s • coût x2" },
        ]);
        if (m) { model = m; saveCfg({ model: m }); console.log("Modèle : " + pastel("lemon", model)); }
        continue;
      }
      if (!MODELS.includes(arg)) { console.log("Modèle inconnu. Valides : " + MODELS.join(", ")); continue; }
      model = arg; saveCfg({ model: arg });
      console.log("Modèle : " + pastel("lemon", model));
      continue;
    }
    if (line === "/effort" || line.startsWith("/effort ")) {
      const arg = line.slice(7).trim();
      if (!arg) {
        const m = await choose("Niveau de réflexion", [
          { value: "low", label: "Low", desc: "~5-10s • 256 tokens • coût x1" },
          { value: "middle", label: "Middle", desc: "~15-30s • 512 tokens • coût x1" },
          { value: "high", label: "High", desc: "~1-2 min • 1024 tokens • coût x1.5" },
          { value: "xhigh", label: "XHigh", desc: "~2-4 min • 1536 tokens • coût x2" },
        ]);
        if (m) { effort = m; saveCfg({ effort: m }); console.log("Effort : " + pastel("lemon", effort)); }
        continue;
      }
      if (!EFFORTS.includes(arg)) { console.log("Effort inconnu. Valides : " + EFFORTS.join(", ")); continue; }
      effort = arg; saveCfg({ effort: arg });
      console.log("Effort : " + pastel("lemon", effort));
      continue;
    }
    if (line === "/quota") {
      const sid = getSessionId();
      if (!sid) { console.log("Aucune conversation active."); continue; }
      try {
        const q = await api("/api/quota/" + sid, null, key, "GET");
        console.log(`Tokens ${q.tokens_remaining}/${q.token_limit}` + (q.locked ? ` — verrouillé ~${q.retry_after_min} min` : ""));
      } catch (e) { console.log("Erreur : " + e.message); }
      continue;
    }
    if (line === "/image" || line.startsWith("/image ")) {
      let prompt = line.slice(6).trim();
      if (!prompt) prompt = (await new Promise((res) => rl.question("Décris l'image : ", res))).trim();
      if (!prompt) continue;
      let sid = getSessionId();
      try {
        if (!sid) sid = await newSession(key, model);
        const d = await api("/api/image", { prompt, session_id: sid }, key);
        console.log("Image : " + d.image_url);
      } catch (e) { console.log("Erreur : " + e.message); }
      continue;
    }
    try { await agentTurn(line, key, model, effort, rl); }
    catch (e) {
      const d = e.data || {};
      if (d.quota_exceeded) console.log("\n" + (d.error || "Quota épuisé.") + "\n");
      else console.log("\nErreur (" + (e.status || "?") + ") : " + e.message + "\n");
    }
  }
  rl.close();
  */
}

main().catch((e) => { console.error("Erreur fatale :", e.message); process.exit(1); });
