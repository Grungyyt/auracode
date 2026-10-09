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
const PKG = { version: "0.2.0" };

const ART = `
 █████╗ ██╗   ██╗██████╗  █████╗  ██████╗ ██████╗ ██████╗ ███████╗
██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
███████║██║   ██║██████╔╝███████║██║     ██║   ██║██║  ██║█████╗
██╔══██║██║   ██║██╔══██╗██╔══██║██║     ██║   ██║██║  ██║██╔══╝
██║  ██║╚██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝██████╔╝███████╗
╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚═════╝ ╚══════╝
  L'IA qui pilote ton PC — propulsée par le cloud VTH
`;

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
  console.log(ART);
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < 2000) {
    process.stdout.write("\rConnexion au cloud VTH " + frames[i++ % frames.length] + " ");
    await sleep(80);
  }
  process.stdout.write("\rConnecté au cloud VTH ✓                    \n");
}

async function checkUpdate() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://api.github.com/Grungyyt/auracode/releases/latest", {
      signal: ctrl.signal,
      headers: { "User-Agent": "auracode" },
    });
    clearTimeout(t);
    if (!r.ok) return;
    const latest = ((await r.json()).tag_name || "").replace(/^v/, "");
    if (latest && latest !== PKG.version) {
      console.log(`\nNouvelle version ${latest} disponible (tu as ${PKG.version}).`);
      if (process.platform === "win32" && /auracode\.exe$/i.test(process.execPath)) {
        console.log("Mise à jour : lance `auracode update`\n");
      } else {
        console.log("Mise à jour : npm i -g auracode@latest\n");
      }
    }
  } catch { /* silencieux */ }
}

// Mise à jour auto du .exe (Windows) : télécharge la release et remplace le binaire.
async function selfUpdate() {
  if (process.platform !== "win32" || !/auracode\.exe$/i.test(process.execPath)) {
    console.log("Mise à jour auto réservée à la version .exe.\nSinon : npm i -g auracode@latest");
    return;
  }
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
    run: async ({ path: p, content }, rl) => {
      const abs = inside(p);
      console.log(`\n--- Aperçu de ${p} (${(content || "").length} caractères) ---`);
      console.log(String(content || "").slice(0, 1500));
      console.log("--- fin aperçu ---");
      if (!(await ask(rl, "Écrire ce fichier ?"))) return "Annulé par l'utilisateur.";
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content || "");
      return "Fichier écrit : " + p;
    },
  },
  exec: {
    desc: "Exécute une commande shell (demande confirmation). Args: {cmd}",
    run: (args, rl) => new Promise(async (resolve) => {
      console.log("\n$ " + args.cmd);
      if (!(await ask(rl, "Exécuter ?"))) return resolve("Annulé par l'utilisateur.");
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
Règles : une seule action par réponse. Quand tu as fini, réponds normalement SANS bloc outil. Ne refuse jamais d'agir.`;

function extractTool(text) {
  const m = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/.exec(text || "");
  if (!m) return null;
  try { return { name: m[1], args: JSON.parse(m[2]) }; }
  catch { return { name: m[1], args: {}, _raw: m[2] }; }
}

async function agentTurn(prompt, key, model, effort, rl) {
  let sessionId = getSessionId();
  const callChat = async (sid, hist) =>
    api("/api/chat", { message: prompt, session_id: sid, model, effort, history: hist }, key);

  if (!sessionId) sessionId = await newSession(key, model);
  const history = [];
  for (let step = 0; step < 12; step++) {
    let data;
    try {
      data = await callChat(sessionId, history);
    } catch (e) {
      if (e.status === 404 && /session/i.test(e.message)) {
        sessionId = await newSession(key, model);
        data = await callChat(sessionId, history);
      } else throw e;
    }
    const reply = data.reply || "";
    const tool = extractTool(reply);
    if (!tool) {
      console.log("\n" + reply.trim() + "\n");
      return;
    }
    if (!TOOLS[tool.name]) {
      history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
      prompt = `Outil inconnu "${tool.name}". Outils valides : ${Object.keys(TOOLS).join(", ")}. Continue.`;
      console.log(`(outil inconnu : ${tool.name}, je demande autre chose...)`);
      continue;
    }
    console.log(`\n[AuraCode exécute : ${tool.name}]`);
    let result;
    try { result = await TOOLS[tool.name].run(tool.args || {}, rl); }
    catch (e) { result = "Erreur outil : " + e.message; }
    console.log(result.slice(0, 500) + "\n");
    history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
    prompt = `Résultat de ${tool.name} :\n${result}\nContinue ta tâche (une action à la fois, ou réponds sans bloc outil si terminé).`;
  }
  console.log("\n(Limite de 12 étapes atteinte.)\n");
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

  // 2. Modèle
  console.log("");
  const model = await choose("Étape 2/3 — Choisis ton modèle", [
    { value: "aura-1.1", label: "Aura 1.1", desc: "rapide, idéal au quotidien" },
    { value: "aura-1.2", label: "Aura 1.2", desc: "premium, le plus malin (coût x4)" },
    { value: "aura-1.1-code", label: "Aura 1.1 Code", desc: "spécialiste programmation" },
  ]);
  if (!model) { console.log("Annulé."); rl.close(); return; }

  // 3. Effort
  console.log("");
  const effort = (await choose("Étape 3/3 — Niveau de réflexion", [
    { value: "low", label: "Low", desc: "réponses courtes et rapides" },
    { value: "middle", label: "Middle", desc: "équilibré (recommandé)" },
    { value: "high", label: "High", desc: "détaillé" },
    { value: "xhigh", label: "XHigh", desc: "réflexion maximale" },
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

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) { console.log(PKG.version); return; }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AuraCode v${PKG.version}\n\nUsage:\n  auracode              Démarre l'assistant (intro + chat)\n  auracode setup          Écran d'installation pastel (clé, modèle, effort)\n  auracode login          Colle ta clé ak-vth-... de /profile/dev\n  auracode logout         Oublie la clé\n  auracode new            Nouvelle conversation\n  auracode update         Met à jour le .exe (Windows)\n  auracode --model X      Modèle (aura-1.1, aura-1.2, aura-1.1-code)\n  auracode --effort X     Effort (low, middle, high, xhigh)\n`);
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
  console.log(`Modèle ${model} • effort ${effort} • dossier ${process.cwd()}`);
  console.log("Écris ta demande (exit pour quitter, /new = nouvelle conversation).\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askPrompt = () => new Promise((res) => rl.question("> ", res));
  for (;;) {
    const line = (await askPrompt()).trim();
    if (!line) continue;
    if (/^(exit|quit|q)$/i.test(line)) break;
    if (line === "/new") {
      try { console.log("Nouvelle conversation : " + await newSession(key, model)); }
      catch (e) { console.log("Erreur : " + e.message); }
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
}

main().catch((e) => { console.error("Erreur fatale :", e.message); process.exit(1); });
