#!/usr/bin/env node
/* AuraCode — agent terminal connecté au cloud VTH (api.ia.vth-mc.fr).
 * Zéro dépendance, Node 18+. Stockage privé : sessions sur ton VPS.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { exec, execSync } = require("child_process");
const crypto = require("crypto");

const API = process.env.AURA_API || "https://api.ia.vth-mc.fr";
const HOME = path.join(os.homedir(), ".auracode");
const CONFIG_FILE = path.join(HOME, "config.json");
const SESSIONS_FILE = path.join(HOME, "sessions.json");
const HIST_FILE = path.join(HOME, "history.json");

// ---------- Auth VTH (OAuth service AuraCode) ----------
// La CLÉ PRIVÉE ne vit QUE sur le VPS (jamais dans ce fichier public).
// Le CLI obtient access/refresh via le VPS (/api/auth/exchange).
const VTH_FILE = path.join(HOME, "vth.json"); // historique : plus jamais écrit (mémoire seule)
const AURA_PUBLIC_ID = process.env.AURA_PUBLIC_ID || "N8FjCur0OABUofZBIwBibnEMTN9RrA4F";
const AURA_AUTH_BASE = (process.env.AURA_AUTH_BASE || "https://auth.vth-mc.fr").replace(/\/$/, "");
const AURA_LOGIN_PORT = parseInt(process.env.AURA_LOGIN_PORT || "3000", 10) || 3000;
let memVthStore = null;
const loadVth = () => memVthStore || {};
const saveVth = (o) => { memVthStore = o; };
const clearVth = () => { memVthStore = null; };
let memApiKey = null;
let vthCurrent = null; // access token en cours (évite les doubles refresh)
const isVthToken = (k) => typeof k === "string" && k.startsWith("vth-acc.");
// State CSRF 32 chars (doc VTH : lettres, chiffres, - et _).
const newState32 = () => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const b = crypto.randomBytes(32);
  let s = "";
  for (let i = 0; i < b.length && s.length < 32; i++) s += A[b[i] % 64];
  if (s.length < 32) throw new Error("state trop court");
  return s;
};
const vthAuthorizeUrl = (state) =>
  `${AURA_AUTH_BASE}/authorize?public_token=${encodeURIComponent(AURA_PUBLIC_ID)}&state=${encodeURIComponent(state)}`;
function openBrowser(url) {
  try {
    const plat = process.platform;
    const cmd = plat === "win32" ? `start "" "${url}"` : plat === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, { timeout: 10000 }, () => {});
  } catch { /* ignore */ }
}
// Résout un access token : mémoire -> fichier -> refresh via VPS.
async function vthAccess() {
  if (vthCurrent) return vthCurrent;
  const v = loadVth();
  if (v && v.access_token) { vthCurrent = v.access_token; return vthCurrent; }
  if (v && v.refresh_token) return refreshVth();
  return null;
}
let refreshP = null;
async function refreshVth() {
  if (refreshP) return refreshP;
  refreshP = (async () => {
    try {
      const v = loadVth();
      if (!v || !v.refresh_token) return null;
      const r = await fetch(API + "/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: v.refresh_token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.access_token) { clearVth(); vthCurrent = null; return null; }
      saveVth({ access_token: j.access_token, refresh_token: j.refresh_token || v.refresh_token, obtained_at: Date.now() });
      vthCurrent = j.access_token;
      return vthCurrent;
    } catch { return null; }
    finally { refreshP = null; }
  })();
  return refreshP;
}
// IMPORTANT : garder synchronisé avec cli/package.json (vérifié par scripts/build-exe.js)
const PKG = { version: "0.8.11" };

const ART_LINES = [
  " █████╗ ██╗   ██╗██████╗  █████╗  ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔══██╗██║   ██║██╔══██╗██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "███████║██║   ██║██████╔╝███████║██║     ██║   ██║██║  ██║█████╗",
  "██╔══██║██║   ██║██╔══██╗██╔══██║██║     ██║   ██║██║  ██║██╔══╝",
  "██║  ██║╚██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝██████╔╝███████╗",
  "╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝╚═════╝ ╚══════╝",
];
const ART_COLORS = ["pink", "peach", "butter", "mint", "aqua", "sky", "lavender", "lilac", "coral", "pink"];

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
  lilac: "\x1b[38;2;216;180;254m",
  aqua: "\x1b[38;2;165;243;252m",
  butter: "\x1b[38;2;253;230;138m",
  coral: "\x1b[38;2;253;164;175m",
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
  pastel: { pink: "\x1b[38;2;255;179;199m", mint: "\x1b[38;2;150;230;190m", lavender: "\x1b[38;2;190;190;235m", peach: "\x1b[38;2;255;200;150m", sky: "\x1b[38;2;160;210;250m", lemon: "\x1b[38;2;255;240;170m", dim: "\x1b[38;2;170;170;180m", lilac: "\x1b[38;2;216;180;254m", aqua: "\x1b[38;2;165;243;252m", butter: "\x1b[38;2;253;230;138m", coral: "\x1b[38;2;253;164;175m" },
  sunset: { pink: "\x1b[38;2;255;107;107m", mint: "\x1b[38;2;255;209;102m", lavender: "\x1b[38;2;244;162;97m", peach: "\x1b[38;2;231;111;81m", sky: "\x1b[38;2;233;196;106m", lemon: "\x1b[38;2;244;162;97m", dim: "\x1b[38;2;150;150;150m", lilac: "\x1b[38;2;255;158;181m", aqua: "\x1b[38;2;255;200;130m", butter: "\x1b[38;2;255;220;130m", coral: "\x1b[38;2;255;120;110m" },
  ocean: { pink: "\x1b[38;2;72;202;228m", mint: "\x1b[38;2;144;224;239m", lavender: "\x1b[38;2;119;141;169m", peach: "\x1b[38;2;100;223;223m", sky: "\x1b[38;2;0;187;249m", lemon: "\x1b[38;2;128;255;219m", dim: "\x1b[38;2;140;140;140m", lilac: "\x1b[38;2;180;160;255m", aqua: "\x1b[38;2;120;240;255m", butter: "\x1b[38;2;190;255;220m", coral: "\x1b[38;2;120;220;230m" },
  mono: { pink: "\x1b[37m", mint: "\x1b[37m", lavender: "\x1b[37m", peach: "\x1b[37m", sky: "\x1b[37m", lemon: "\x1b[37m", dim: "\x1b[90m", lilac: "\x1b[37m", aqua: "\x1b[37m", butter: "\x1b[37m", coral: "\x1b[37m" },
};

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
const getKey = () => (memApiKey || "").trim();

// Migration sécurité : les tokens ne sont plus stockés sur disque.
// Purge au démarrage (une fois) : clé config + vth.json oubliés.
function purgeStoredSecrets() {
  let wiped = false;
  try {
    const cfg = loadJson(CONFIG_FILE, {});
    if (cfg.apiKey) { delete cfg.apiKey; saveJson(CONFIG_FILE, cfg); wiped = true; }
  } catch { /* ignore */ }
  try {
    if (fs.existsSync(VTH_FILE)) { fs.unlinkSync(VTH_FILE); wiped = true; }
  } catch { /* ignore */ }
  if (wiped) console.log("Anciens tokens locaux supprimés (désormais : mémoire seule, login à chaque lancement).");
}

// Dossier d'installation à désinstaller (jamais le dossier projet courant).
function getInstallDir() {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "AuraCode");
  }
  return path.join(os.homedir(), ".auracode-cli");
}

function uninstallCmds(dir, wipeData) {
  const cmds = [];
  cmds.push(`if (Test-Path '${dir}') { Remove-Item -Recurse -Force '${dir}' }`);
  cmds.push(`$p=[Environment]::GetEnvironmentVariable('Path','User'); $n=($p -split ';' | Where-Object { $_ -and $_.TrimEnd('\\') -ne '${dir}'.TrimEnd('\\') }) -join ';'; [Environment]::SetEnvironmentVariable('Path',$n,'User')`);
  if (wipeData) cmds.push(`if (Test-Path '${HOME}') { Remove-Item -Recurse -Force '${HOME}' }`);
  return cmds.join("; ");
}

function brandLine(W) {
  const plain = "Aura by VTH Group";
  const pad = " ".repeat(Math.max(0, Math.floor((W - plain.length) / 2)));
  return pad + P.bold + P.pink + "Aura" + P.reset + P.dim + " by " + P.reset + P.bold + P.sky + "VTH Group" + P.reset;
}

async function splash() {
  // Écran de lancement plein écran : logo centré + vérification auto des mises à jour.
  // Retourne : version dispo (string), null (à jour), undefined (hors ligne).
  if (!process.stdout.isTTY) {
    console.log(`AuraCode v${PKG.version}`);
    return checkUpdate();
  }
  const W = process.stdout.columns || 80;
  const H = process.stdout.rows || 24;
  const center = (text, color) => {
    const pad = " ".repeat(Math.max(0, Math.floor((W - text.length) / 2)));
    return pad + (color ? P[color] + text + P.reset : text);
  };
  const block = [
    ...ART_LINES.map((ln, i) => center(ln, ART_COLORS[i % ART_COLORS.length])),
    center("L'IA qui pilote ton PC — propulsée par le cloud VTH", "sky"),
    "",
    center(`v${PKG.version}`, "dim"),
    "",
  ];
  block.splice(block.length - 1, 0, brandLine(W));
  const topPad = Math.max(0, Math.floor((H - block.length - 1) / 2));
  const statusRow = topPad + block.length + 1;
  process.stdout.write("\x1b[?25l\x1b[2J\x1b[H");
  process.stdout.write("\n".repeat(topPad));
  for (const ln of block) process.stdout.write(ln + "\n");
  const setStatus = (txt, color) => {
    const pad = " ".repeat(Math.max(0, Math.floor((W - txt.length) / 2)));
    process.stdout.write(`\x1b[${statusRow};1H\x1b[K` + pad + (color ? P[color] + txt + P.reset : txt));
  };
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let fi = 0, finished = false, latest = undefined;
  const t0 = Date.now();
  checkUpdate().then((v) => { latest = v; finished = true; });
  const timer = setInterval(() => {
    if (finished) return;
    fi = (fi + 1) % frames.length;
    setStatus(`${frames[fi]} Vérification des mises à jour…`, "lavender");
  }, 80);
  setStatus(`${frames[0]} Vérification des mises à jour…`, "lavender");
  while (!finished) await sleep(60);
  clearInterval(timer);
  await sleep(Math.max(0, 800 - (Date.now() - t0)));
  if (latest === undefined) setStatus("? Impossible de vérifier (hors ligne ?)", "peach");
  else if (latest) setStatus(`↓ Mise à jour ${latest} disponible — tape /update dans le chat`, "lemon");
  else setStatus(`✓ À jour (v${PKG.version})`, "mint");
  await sleep(1100);
  process.stdout.write("\x1b[?25h");
  return latest;
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
    if (!r.ok) return undefined;
    const latest = (await r.json()).version;
    if (latest && latest !== PKG.version) {
      return latest;
    }
    return null;
  } catch { return undefined; }
}

// Mise à jour : mode .exe via releases GitHub, mode script via fichiers du repo.
async function selfUpdate(quiet = false) {
  const lines = [];
  const say = (t) => { lines.push(t); if (!quiet) console.log(t); };
  const done = () => lines.join("\n");
  const cmpVer = (a, b) => {
    const pa = String(a || "").split(".").map((x) => parseInt(x, 10) || 0);
    const pb = String(b || "").split(".").map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
  };
  const isExe = process.platform === "win32" && /auracode\.exe$/i.test(process.execPath);
  if (isExe) {
    say("Recherche de mise à jour...");
    let rel;
    try {
      const r = await fetch("https://api.github.com/Grungyyt/auracode/releases/latest", {
        headers: { "User-Agent": "auracode" },
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      rel = await r.json();
    } catch (e) {
      say("Impossible de contacter GitHub (" + e.message + ").");
      return done();
    }
    const latest = (rel.tag_name || "").replace(/^v/, "");
    if (!latest) {
      say("Aucune release GitHub pour l'instant : réinstalle avec install.ps1 (mode script, toujours à jour).");
      return done();
    }
    if (cmpVer(latest, PKG.version) <= 0) {
      say("Déjà à jour (" + PKG.version + ").");
      return done();
    }
    const asset = (rel.assets || []).find((a) => /auracode.*\.exe$/i.test(a.name));
    if (!asset) { say("Aucun .exe dans la release " + rel.tag_name); return done(); }
    const exePath = process.execPath;
    const tmp = exePath + ".new";
    say("Téléchargement " + latest + "...");
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
    say("Mise à jour installée, redémarrage...");
    setTimeout(() => process.exit(0), 600);
    return done();
  }
  // Mode script (install.ps1 / npm link) : re-télécharge les fichiers du repo.
  // Garde anti-downgrade : ne JAMAIS écraser par une version égale ou plus ancienne
  // (protège le dossier de dev si update est lancé depuis le repo).
  say("Mise à jour depuis GitHub...");
  try {
    const base = "https://raw.githubusercontent.com/Grungyyt/auracode/main";
    const head = { "User-Agent": "auracode" };
    const rp = await (await fetch(base + "/cli/package.json", { headers: head })).json();
    if (!rp.version || cmpVer(rp.version, PKG.version) <= 0) {
      say("Déjà à jour (" + PKG.version + ").");
      return done();
    }
    const js = await (await fetch(base + "/cli/bin/auracode.js", { headers: head })).text();
    if (!js.includes("AuraCode")) throw new Error("Téléchargement invalide.");
    const dir = path.dirname(__filename);
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(rp, null, 2));
    fs.writeFileSync(__filename, js);
    say("Mis à jour vers " + rp.version + ". Quitte (Ctrl+C) et relance auracode.");
  } catch (e) {
    say("Échec : " + e.message);
  }
  return done();
}

async function api(pathname, body, key, method = "POST", signal = undefined) {
  const doFetch = (k) => fetch(API + pathname, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  let res = await doFetch(isVthToken(key) && vthCurrent ? vthCurrent : key);
  if (res.status === 401 && isVthToken(key) && !(signal && signal.aborted)) {
    const fresh = await refreshVth();
    if (fresh && fresh !== key) res = await doFetch(fresh);
  }
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
// Accès complet au PC : résout le chemin (relatif au projet ou absolu).
// Les écritures / exécutions demandent toujours confirmation (ui.confirm).
function inside(p) {
  return path.resolve(process.cwd(), p);
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

const SYSTEM = `Tu es AuraCode, un agent qui pilote DIRECTEMENT le PC de l'utilisateur via des outils. Ce n'est pas une simulation : quand tu émets un bloc outil, le programme l'exécute vraiment sur le PC puis te renvoie le résultat. Réponds en français, concis.
Pour agir, réponds UNIQUEMENT avec un bloc outil (une action à la fois) :
<tool name="NOM">{"arg": "valeur"}</tool>
Exemple : <tool name="write_file">{"path": "C:/Users/test.txt", "content": "coucou"}</tool>
Outils disponibles :
- read_file {"path"} : lire un fichier
- list_dir {"path"?} : lister un dossier
- write_file {"path", "content"} : écrire un fichier
- exec {"cmd"} : commande shell
- search {"pattern", "path"?} : chercher du texte
- open_file {"path"} : ouvrir un fichier/dossier avec le programme par défaut
- sysinfo {} : infos du PC (OS, CPU, RAM)
- Accès COMPLET au PC : tous les disques et dossiers, chemins relatifs OU absolus (ex C:/Docs/fichier.txt, D:/projet).
- Le dossier actuel et l'OS sont rappelés dans chaque demande ([Contexte PC]) : utilise-les pour construire tes chemins.
Règles : une seule action par réponse. Quand tu as fini, réponds normalement SANS bloc outil. Quand l'utilisateur demande une action sur son PC (créer/lire/modifier un fichier ou dossier, exécuter une commande), tu DOIS émettre un bloc outil : ne dis JAMAIS que tu ne peux pas créer de fichiers, que tu es un chatbot web ou que l'utilisateur doit le faire lui-même.`;

function extractTool(text) {
  const m = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/.exec(text || "");
  if (!m) return null;
  try { return { name: m[1], args: JSON.parse(m[2]) }; }
  catch { return { name: m[1], args: {}, _raw: m[2] }; }
}

// La demande ressemble-t-elle à une action sur le PC ?
const wantsAction = (t) => /\b(cré|cree|créer|creer|écris|ecris|écrire|ecrire|lis|lire|lisez|ouvre|ouvrir|ouvrez|exécute|execute|exécuter|lance|lancer|cherche|chercher|trouve|trouver|modifie|modifier|supprime|supprimer|renomme|déplace|copie|copier|fichier|dossier|script|programme|installe|télécharge)\b/i.test(t || "");

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

async function agentTurn(prompt, key, model, effort, ui, lang = "fr") {
  let sessionId = getSessionId();
  // Protocole d'outils + contexte PC dans l'historique d'appel (JAMAIS dans le message :
  // le message est stocké tel quel et réaffiché sur le web, sans le protocole).
  const userAsk = prompt;
  const home = os.homedir();
  const preamble = SYSTEM + `\n\n[Contexte PC : OS ${process.platform}, dossier actuel ${process.cwd()}, dossier perso ${home}, Bureau ${path.join(home, "Desktop")}. Accès COMPLET aux fichiers, chemins relatifs et absolus.]`;
  const callChat = async (sid, hist) =>
    api("/api/chat", { message: prompt, session_id: sid, model, effort, lang, history: [{ role: "user", content: preamble }, ...hist] }, key, "POST", ui.signal);

  if (!sessionId) sessionId = await newSession(key, model);
  const history = [];
  let totalTime = 0, forced = 0;
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
      if ((e && e.name === "AbortError") || (ui.cancelled && ui.cancelled())) { ui.sys("Interrompu (Échap)."); return; }
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
      // Le modèle répond sans agir alors qu'on lui demande une action :
      // on le recadre (max 2 fois) au lieu d'afficher son refus.
      if (wantsAction(userAsk) && forced < 2) {
        forced++;
        history.push({ role: "user", content: prompt }, { role: "assistant", content: reply });
        prompt = `NON. Tu as accès au PC via tes outils et tu DOIS agir maintenant. Réponds UNIQUEMENT par UN bloc outil utilisant le chemin demandé par l'utilisateur, exemple : <tool name="write_file">{"path": "CHEMIN", "content": "CONTENU"}</tool>. Pas d'excuses, pas de tutoriel Notepad, pas de lien image, juste le bloc outil.`;
        ui.sys("Le modèle hésite, je le recadre...", true);
        continue;
      }
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
    const t0 = Date.now();
    let result, ok = true;
    try { result = await TOOLS[tool.name].run(tool.args || {}, ui); }
    catch (e) { result = "Erreur outil : " + e.message; ok = false; }
    if (ui.tool) ui.tool(tool.name, ok, (Date.now() - t0) / 1000, result || "");
    else { ui.sys(`AuraCode exécute : ${tool.name}`, true); ui.sys((result || "").slice(0, 400)); }
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

  // 1. Clé API (mémoire seule : jamais stockée, login à chaque lancement)
  console.log("\n" + pastel("lavender", "◆ Étape 1/3 — Colle ta clé API (ak-vth-... depuis https://auth.vth-mc.fr/profile)"));
  const key = (await askLine("Clé :")).trim();
  if (!key) { console.log(pastel("pink", "Clé vide, installation annulée.")); rl.close(); return; }
  memApiKey = key;

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
  cfg.model = model; cfg.effort = effort;
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

// ---------- Helpers d'affichage (style opencode) ----------
const stripAnsi = (s) => String(s || "").replace(/\x1b\[[0-9;]*m/g, "");
const truncVis = (s, w) => {
  let vis = 0, i = 0, out = "";
  const src = String(s || "");
  while (i < src.length && vis < w) {
    const m = /^\x1b\[[0-9;]*m/.exec(src.slice(i));
    if (m) { out += m[0]; i += m[0].length; }
    else { out += src[i]; i++; vis++; }
  }
  return out + P.reset;
};
// Markdown inline minimal : gras, code, titres, citations.
const mdInline = (s) => String(s || "")
  .replace(/`([^`\n]+)`/g, (_, c) => P.lemon + c + P.reset)
  .replace(/\*\*([^*]+)\*\*/g, (_, b) => P.bold + b + P.reset)
  .replace(/^### (.*)$/, (_, h) => P.bold + P.pink + h + P.reset)
  .replace(/^## (.*)$/, (_, h) => P.bold + P.lavender + h + P.reset)
  .replace(/^# (.*)$/, (_, h) => P.bold + P.lemon + h + P.reset)
  .replace(/^> (.*)$/, (_, q) => P.dim + "▏ " + q + P.reset);
// Découpe exacte (offsets conservés) pour le curseur multiligne.
const wrapRows = (text, width) => {
  const w = Math.max(5, width);
  if (!text) return [{ text: "", start: 0 }];
  const rows = [];
  let i = 0;
  while (i < text.length) {
    let cut = Math.min(i + w, text.length);
    if (cut < text.length) {
      const sp = text.lastIndexOf(" ", cut);
      if (sp > i) cut = sp;
    }
    rows.push({ text: text.slice(i, cut), start: i });
    i = cut;
    if (i < text.length && text[i] === " ") i++;
  }
  return rows.length ? rows : [{ text: "", start: 0 }];
};
// Scan des fichiers du projet (pour @mentions), cache 10 s.
let fileCache = { t: 0, list: [] };
const scanFiles = () => {
  const now = Date.now();
  if (now - fileCache.t < 10000 && fileCache.list.length) return fileCache.list;
  const out = [];
  const walk = (dir, rel) => {
    if (out.length >= 60) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (out.length >= 60) break;
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name.startsWith(".")) continue;
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.isFile() && r.length < 80) out.push(r);
    }
  };
  try { walk(process.cwd(), ""); } catch { /* ignore */ }
  fileCache = { t: now, list: out };
  return out;
};
// Branche git du dossier (cache 5 s).
let branchCache = { t: 0, v: "" };
const gitBranch = () => {
  const now = Date.now();
  if (now - branchCache.t < 5000) return branchCache.v;
  branchCache.t = now;
  try {
    branchCache.v = execSync("git rev-parse --abbrev-ref HEAD", { cwd: process.cwd(), timeout: 1500, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch { branchCache.v = ""; }
  return branchCache.v;
};
// Remplace @chemin par le contenu du fichier (max 8 Ko, 3 fichiers).
const expandMentions = (line) => {
  let n = 0;
  const send = String(line).replace(/(^|[\s(])@([\w.\-/:\\]+)/g, (m, pre, p) => {
    if (n >= 3) return m;
    try {
      const abs = inside(p);
      const st = fs.statSync(abs);
      if (!st.isFile() || st.size > 20000) return m;
      n++;
      return `${pre}[fichier ${p}]\n${fs.readFileSync(abs, "utf8").slice(0, 8000)}`;
    } catch { return m; }
  });
  return { display: line, send };
};
// Shell local (timeout 30 s, sortie tronquée).
const shellOut = (cmd, timeout = 30000) => new Promise((resolve) => {
  exec(cmd, { cwd: process.cwd(), timeout, maxBuffer: 1024 * 500 }, (err, stdout, stderr) => {
    let out = (stdout || "") + (stderr ? "\n[stderr]\n" + stderr : "");
    if (err && !out) out = "Erreur: " + err.message;
    resolve(out.slice(0, 6000) || "(pas de sortie)");
  });
});

// ---------- Commandes slash (avec autocomplétion) ----------
const COMMANDS = [
  { name: "/new", desc: "Nouvelle conversation" },
  { name: "/model", desc: "Voir / changer de modèle", values: ["aura-1.1", "aura-1.2", "aura-1.1-code"] },
  { name: "/effort", desc: "Voir / changer l'effort", values: ["low", "middle", "high", "xhigh"] },
  { name: "/lang", desc: "Langue des réponses", values: ["fr", "en"] },
  { name: "/theme", desc: "Thème de couleur", values: ["pastel", "sunset", "ocean", "mono"] },
  { name: "/sessions", desc: "Panneau des conversations (F2)" },
  { name: "/account", desc: "Panneau du compte (F3)" },
  { name: "/retry", desc: "Relancer la dernière réponse" },
  { name: "/compact", desc: "Garder les N derniers blocs (/compact 20)" },
  { name: "/stats", desc: "Stats de la session" },
  { name: "/doctor", desc: "Diagnostic connexion / modèles" },
  { name: "/quota", desc: "Afficher ton quota global" },
  { name: "/image", desc: "Générer une image : /image <texte>" },
  { name: "/bash", desc: "Commande shell (confirmation)" },
  { name: "/read", desc: "Lire un fichier : /read <chemin>" },
  { name: "/ls", desc: "Lister un dossier : /ls [dossier]" },
  { name: "/write", desc: "Écrire un fichier : /write <chemin> … /end" },
  { name: "/run", desc: "Exécuter le dernier bloc de code" },
  { name: "/undo", desc: "Annuler la dernière écriture" },
  { name: "/search", desc: "Chercher du texte : /search <motif>" },
  { name: "/open", desc: "Ouvrir fichier/dossier" },
  { name: "/sysinfo", desc: "Infos du PC" },
  { name: "/copy", desc: "Copier une réponse : /copy [n]" },
  { name: "/export", desc: "Sauver en markdown : /export [fichier]" },
  { name: "/update", desc: "Mettre à jour AuraCode" },
  { name: "/uninstall", desc: "Désinstaller le programme" },
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
  constructor(state, updateAvailable) {
    this.state = state;
    this.updateAvailable = updateAvailable;
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
    this.hist = loadJson(HIST_FILE, []);
    this.histIdx = -1;
    this.draft = "";
    this.modal = null;
    this.sidebar = false;
    this.sessionsCache = [];
    this.account = false;
    this.accountCache = {};
    this.pendingWrite = null;
    this.lastPrompt = null;
    this.cancelled = false;
    this.abort = null;
    this.typingMsg = null;
    this.undoStack = [];
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

  assistant(text, meta = null) {
    const m = { role: "assistant", text: "", full: String(text), time: timeStr(), meta };
    this.messages.push(m);
    if (this.messages.length > 300) this.messages.splice(0, this.messages.length - 300);
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.typingMsg = m;
    this.typeTimer = setInterval(() => {
      const next = Math.min(m.full.length, m.text.length + 40);
      m.text = m.full.slice(0, next);
      this.render();
      if (next >= m.full.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
        this.typingMsg = null;
      }
    }, 40);
    this.render();
  }

  tool(name, ok, ms, output) {
    this.messages.push({ role: "tool", name: String(name), ok: !!ok, ms: ms == null ? null : ms, output: String(output || "").slice(0, 2000), time: timeStr() });
    if (this.messages.length > 300) this.messages.splice(0, this.messages.length - 300);
    this.render();
  }

  openModal(title, items, onPick) {
    this.modal = { title, items: items || [], sel: 0, onPick };
    this.completion = null;
    this.render();
  }

  openPalette() {
    this.openModal("Commandes", COMMANDS.map((c) => ({ label: `${c.name}  —  ${c.desc}`, value: c.name })), (v) => {
      if (!v) { this.render(); return; }
      this.input = v + " ";
      this.cursor = this.input.length;
      this.completion = null;
      this.updateCompletion();
      this.render();
    });
  }

  openHelp() {
    const rows = [
      "↑↓ historique • Tab compléter • Ctrl+J saut de ligne",
      "Ctrl+P palette • F1 aide • F2 sessions • F3 compte • Alt+1-9 switch",
      "PgUp/PgDn défiler • Échap annuler • Ctrl+C quitter",
      "@fichier joindre un fichier • /help commandes",
    ];
    this.openModal("Aide — raccourcis", rows.map((r) => ({ label: r, value: "__close" })), () => this.render());
  }

  async toggleSidebar() {
    this.sidebar = !this.sidebar;
    if (this.sidebar) {
      this.account = false;
      try {
        const d = await api("/api/sessions", null, this.state.key, "GET");
        this.sessionsCache = (d.sessions || []).slice(-9);
      } catch { this.sessionsCache = []; }
    }
    this.render();
  }

  async toggleAccount() {
    this.account = !this.account;
    if (this.account) {
      this.sidebar = false;
      try {
        const me = await api("/api/me", null, this.state.key, "GET");
        this.accountCache = me || {};
      } catch { this.accountCache = {}; }
    }
    this.render();
  }

  accountRows(h) {
    const sbW = Math.min(30, Math.max(20, Math.floor(this.W * 0.3)));
    const me = this.accountCache || {};
    const k = this.state.key || "";
    const keyType = !k ? "—" : k.startsWith("ak-vth-") ? "clé API" : k.startsWith("vth-acc.") ? "compte VTH" : k.startsWith("sk-aura-") ? "master" : "JWT";
    const rows = [
      " Compte",
      "─".repeat(sbW),
      ` user ${String(me.user_id || "?").slice(0, 18)}`,
      ` conv ${(getSessionId() || "—").slice(0, 8)} • ${me.sessions ?? "?"} srv`,
      ` msgs ${me.messages_used ?? "?"}`,
      ` quota ${String(this.quotaText || "?").slice(0, Math.max(8, sbW - 9))}`,
      ` ${this.state.model} • ${this.state.effort} • ${this.state.lang || "fr"}`,
      ` thème ${this.state.theme || "pastel"} • v${PKG.version}`,
      ` accès ${keyType}`,
    ];
    while (rows.length < h - 1) rows.push("");
    rows.push("F3 fermer");
    const base = rows.map((r) => r.slice(0, sbW));
    const tinted = base.map((r, i) => {
      if (i === 0) return P.lavender + r + P.reset;
      if (i === 1 || i === base.length - 1) return P.dim + r + P.reset;
      return P.butter + r + P.reset;
    });
    return { sbW, rows: tinted.slice(0, h) };
  }

  async switchSession(i) {
    const s = this.sessionsCache[i];
    if (!s || !s.session_id) return;
    setSessionId(s.session_id);
    if (s.model) this.state.model = s.model;
    this.sys("Session : " + String(s.session_id).slice(0, 8));
    await this.refreshQuota();
    this.render();
  }

  sidebarRows(h) {
    const sbW = Math.min(30, Math.max(20, Math.floor(this.W * 0.3)));
    const rows = [];
    const n = this.sessionsCache.length;
    const cur = getSessionId();
    rows.push(` Sessions (${n})`);
    rows.push("─".repeat(sbW));
    for (let i = 0; i < Math.min(9, n); i++) {
      const s = this.sessionsCache[i] || {};
      const id = String(s.session_id || "?").slice(0, 8);
      const mark = s.session_id && s.session_id === cur ? "●" : " ";
      rows.push(`${mark}${i + 1} ${id} ${s.model || ""}`.slice(0, sbW));
    }
    while (rows.length < h - 1) rows.push("");
    rows.push("Alt+n • F2 fermer".slice(0, sbW));
    const tinted = rows.map((r, i) => {
      if (i === 0) return P.lavender + r + P.reset;
      if (i === rows.length - 1) return P.dim + r + P.reset;
      if (r.includes("●")) return P.mint + r + P.reset;
      return P.butter + r + P.reset;
    });
    return { sbW, rows: tinted.slice(0, h) };
  }

  inputRows(fieldW) {
    const paras = this.input.split("\n");
    const rows = [];
    let base = 0, crow = 0, ccol = 0;
    paras.forEach((p) => {
      for (const r of wrapRows(p, fieldW)) {
        const gstart = base + r.start;
        const gi = rows.length;
        rows.push({ text: r.text, gi });
        if (this.cursor >= gstart) { crow = gi; ccol = Math.min(this.cursor - gstart, r.text.length); }
      }
      base += p.length + 1;
    });
    if (!rows.length) rows.push({ text: "", gi: 0 });
    const maxR = 5;
    const start = rows.length <= maxR ? 0 : Math.max(0, Math.min(rows.length - maxR, crow - 2));
    return { rows, crow, ccol, start, shown: rows.slice(start, start + maxR) };
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
    const fieldW = Math.max(10, W - 6);
    const inR = this.confirmState ? null : this.inputRows(fieldW);
    const boxH = inR ? inR.shown.length + 2 : 1;
    const viewH = Math.max(3, H - 1 - boxH - 1 - compH);

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
      if (m.role === "tool") {
        const icol = m.ok ? P.mint : P.pink;
        const icon = m.ok ? "✓" : "✗";
        push("", ` ${icol}⚙ ${P.reset + P.bold + P.aqua}${m.name}${P.reset + icol} ${icon}${m.ms != null ? ` ${m.ms.toFixed(1)}s` : ""}${P.reset}`);
        const outs = String(m.output || "").split("\n").slice(0, 6);
        for (const ol of outs) {
          const t = ol.slice(0, Math.max(20, W - 10));
          push("  " + t, P.dim + "  " + t + P.reset);
        }
        const rest = String(m.output || "").split("\n").length - outs.length;
        if (rest > 0) push("", P.dim + `  … +${rest} lignes` + P.reset);
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
      const headOut = nameColor + P.bold + (mine ? "Toi" : "Aura") + P.reset + P.dim + ` • ${m.time || ""}` + P.reset;
      const rowsV = [headPlain, top, ...wrapped.map((wl) => `│ ${padEnd(wl)} │`), bot];
      const fmt = (wl) => (m.role === "assistant" ? mdInline(wl) : wl);
      const rowsO = [headOut, border + top + P.reset, ...wrapped.map((wl) => border + "│ " + P.reset + fmt(padEnd(wl)) + border + " │" + P.reset), border + bot + P.reset];
      if (m.meta && !mine) {
        const meta = `${m.time || ""} · ${(m.meta.ms || 0).toFixed(1)}s · ~${m.meta.tok || 0} tok`;
        rowsV.push("  " + meta, "");
        rowsO.push("  " + P.dim + meta + P.reset, "");
      } else {
        rowsV.push("");
        rowsO.push("");
      }
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

    if (this.modal) {
      const mw = Math.min(62, W - 4);
      const iw = mw - 4;
      const fit = (s) => String(s).slice(0, iw) + " ".repeat(Math.max(0, iw - Math.min(String(s).length, iw)));
      const mRows = [];
      mRows.push(P.dim + "╭" + "─".repeat(mw - 2) + "╮" + P.reset);
      mRows.push(P.dim + "│ " + P.reset + P.bold + P.pink + fit("◆ " + this.modal.title) + P.reset + P.dim + " │" + P.reset);
      mRows.push(P.dim + "├" + "─".repeat(mw - 2) + "┤" + P.reset);
      const mItems = this.modal.items.slice(0, Math.max(1, viewH - 6));
      mItems.forEach((it, i) => {
        const txt = ((i === this.modal.sel ? "❯ " : "  ") + (it.label || "")).slice(0, iw);
        const colored = i === this.modal.sel
          ? P.bold + P.pink + "❯ " + P.reset + P.lemon + txt.slice(2) + P.reset
          : P.dim + txt + P.reset;
        mRows.push(P.dim + "│ " + P.reset + colored + " ".repeat(Math.max(0, iw - Math.min(txt.length, iw))) + P.dim + " │" + P.reset);
      });
      const foot = "↑↓ choisir • Entrée valider • Échap fermer";
      mRows.push(P.dim + "├" + "─".repeat(mw - 2) + "┤" + P.reset);
      mRows.push(P.dim + "│ " + P.reset + P.dim + fit(foot) + P.reset + P.dim + " │" + P.reset);
      mRows.push(P.dim + "╰" + "─".repeat(mw - 2) + "╯" + P.reset);
      const mStart = Math.max(0, Math.floor((viewH - mRows.length) / 2));
      const mLeft = " ".repeat(Math.max(0, Math.floor((W - mw) / 2)));
      mRows.forEach((r, i) => {
        const idx = mStart + i;
        if (idx < visible.length) visible[idx] = { vis: "", out: mLeft + r };
      });
    }

    const sid8 = (getSessionId() || "").slice(0, 8);
    let rawL = `◤ auracode  ${sid8 ? sid8 + "  " : ""}${this.state.model} • ${this.state.effort} • ${this.state.lang || "fr"}`;
    if (rawL.length > W) rawL = rawL.slice(0, W);
    const rawR = this.quotaText;
    const pad = " ".repeat(Math.max(1, W - rawL.length - rawR.length));
    const hTitle = P.bold + P.pink + "◤ auracode" + P.reset;
    const hMid = P.lavender + rawL.slice("◤ auracode".length) + P.reset;
    const header = hTitle + hMid + pad + P.mint + rawR + P.reset;

    let out = "\x1b[?25l\x1b[H";
    out += header + "\x1b[K\n";
    const sb = !this.modal ? (this.sidebar ? this.sidebarRows(viewH) : this.account ? this.accountRows(viewH) : null) : null;
    const msgW = sb ? W - sb.sbW - 1 : W;
    visible.forEach((l, i) => {
      let row = l ? l.out : "";
      if (sb) {
        const cut = truncVis(row, msgW);
        const vlen = Math.min(stripAnsi(row).length, msgW);
        row = cut + " ".repeat(Math.max(0, msgW - vlen)) + P.dim + "▏" + P.reset + (sb.rows[i] || "");
      }
      out += row + "\x1b[K\n";
    });
    compItems.forEach((it, i) => {
      const sel = i === this.completion.sel;
      out += (sel ? P.bold + P.pink + "> " + P.lemon + it.display + P.reset : P.dim + "  " + it.display + P.reset) + "\x1b[K\n";
    });

    let cursorCol = -1, cursorRowOff = 0;
    if (this.confirmState) {
      const q = (`? ${this.confirmState.q} [o/N]`).slice(0, W - 4);
      out += "│ " + P.lemon + q + P.reset + " ".repeat(Math.max(0, W - 4 - q.length)) + " │" + "\x1b[K\n";
    } else {
      let boxTitle = "─ Écris ton message… (Ctrl+J = ligne, @fichier) ";
      if (inR.rows.length > inR.shown.length) boxTitle = `─ ↑↓ ${inR.start + 1}-${inR.start + inR.shown.length}/${inR.rows.length} ─ `;
      out += P.dim + "╭" + boxTitle + "─".repeat(Math.max(0, W - 2 - boxTitle.length)) + "╮" + P.reset + "\x1b[K\n";
      inR.shown.forEach((r, i) => {
        const gi = inR.start + i;
        const pre = gi === 0 ? "> " : "  ";
        out += "│ " + P.bold + P.pink + pre + P.reset + r.text + " ".repeat(Math.max(0, fieldW - r.text.length)) + " │" + "\x1b[K\n";
        if (gi === inR.crow) { cursorCol = 4 + inR.ccol; cursorRowOff = i; }
      });
      out += P.dim + "╰" + "─".repeat(Math.max(0, W - 2)) + "╯" + P.reset + "\x1b[K\n";
    }

    let sL, sR = "";
    const br = gitBranch();
    const cwd = path.basename(process.cwd()) || process.cwd();
    if (this.updateAvailable) {
      sL = `↓ MAJ ${this.updateAvailable} • /update`;
    } else if (this.busy && this.thinkSec !== null && this.thinkSec !== undefined) {
      sL = `Aura réfléchit... ${this.thinkSec.toFixed(0)}s (Échap = stop)`;
    } else if (this.busy) {
      sL = "Travail en cours... (Échap = stop)";
    } else {
      sL = `${this.state.model} • ${this.state.effort} • ${this.state.lang || "fr"}`;
    }
    const rParts = [this.quotaText, br ? `⎇ ${br}` : "", cwd].filter(Boolean);
    sR = rParts.join(" • ");
    if (this.scroll > 0) sR += (sR ? " • " : "") + "PgDn : bas";
    if (this.updateAvailable && !this.busy) sR += (sR ? " • " : "") + "Tape /update";
    let sLine = sL;
    if (sR) sLine += " ".repeat(Math.max(1, W - sL.length - sR.length)) + sR;
    if (sLine.length > W) sLine = sLine.slice(0, W);
    const thinking = this.busy && this.thinkSec !== null && this.thinkSec !== undefined;
    out += (thinking ? P.lavender : P.dim) + sLine + P.reset;
    process.stdout.write(out);

    if (cursorCol >= 0) {
      const inputRow = viewH + compH + 2 + cursorRowOff;
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
    const before = this.input.slice(0, this.cursor);
    const ma = /(^|[\s(])@([\w.\-/:\\]*)$/.exec(before);
    if (ma) {
      const frag = ma[2].toLowerCase();
      const head = before.slice(0, before.length - ma[2].length);
      const tail = this.input.slice(this.cursor);
      const items = scanFiles()
        .filter((f) => f.toLowerCase().includes(frag))
        .slice(0, 8)
        .map((f) => ({ insert: head + f + " " + tail, cursor: (head + f + " ").length, display: "@" + f }));
      this.completion = items.length ? { items, sel: 0 } : null;
      return;
    }
    this.completion = null;
  }

  acceptCompletion() {
    if (!this.completion || !this.completion.items.length) return false;
    const it = this.completion.items[Math.min(this.completion.sel, this.completion.items.length - 1)];
    this.input = it.insert;
    this.cursor = it.cursor != null ? Math.min(it.cursor, this.input.length) : this.input.length;
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
    if (this.hist.length > 200) this.hist.splice(0, this.hist.length - 200);
    try { saveJson(HIST_FILE, this.hist); } catch { /* ignore */ }
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
    if (this.modal) {
      const n = this.modal.items.length || 1;
      if (key.name === "up") { this.modal.sel = (this.modal.sel - 1 + n) % n; this.render(); return; }
      if (key.name === "down") { this.modal.sel = (this.modal.sel + 1) % n; this.render(); return; }
      if (key.name === "return" || key.name === "tab") {
        const it = this.modal.items[this.modal.sel];
        const cb = this.modal.onPick;
        this.modal = null;
        if (cb) cb(it ? it.value : null);
        else this.render();
        return;
      }
      if (key.name === "escape") {
        const cb = this.modal.onPick;
        this.modal = null;
        if (cb) cb(null);
        else this.render();
        return;
      }
      return;
    }
    if (this.sidebar && key.meta && str && /^[1-9]$/.test(str)) {
      this.switchSession(parseInt(str, 10) - 1);
      return;
    }
    if (this.confirmState) {
      const c = (str || "").toLowerCase();
      if (c === "y" || c === "o") this.resolveConfirm(true);
      else if (c === "n" || key.name === "escape" || key.name === "return") this.resolveConfirm(false);
      return;
    }
    if (this.busy || this.typeTimer) {
      if (key.name === "escape") {
        if (this.typeTimer && this.typingMsg) {
          this.typingMsg.text = this.typingMsg.full;
          clearInterval(this.typeTimer);
          this.typeTimer = null;
          this.typingMsg = null;
          this.render();
        } else if (this.busy) {
          this.cancelled = true;
          try { if (this.abort) this.abort.abort(); } catch { /* ignore */ }
        }
      }
      return;
    }
    if (key.ctrl && key.name === "p") { this.openPalette(); return; }
    if (key.name === "f1") { this.openHelp(); return; }
    if (key.name === "f2") { this.toggleSidebar(); return; }
    if (key.name === "f3") { this.toggleAccount(); return; }
    if (str === "\n" || (key.meta && key.name === "return")) {
      this.input = this.input.slice(0, this.cursor) + "\n" + this.input.slice(this.cursor);
      this.cursor++;
      this.onEdit();
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
        if (this.sidebar || this.account) { this.sidebar = false; this.account = false; this.render(); }
        else if (this.completion) { this.completion = null; this.render(); }
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

async function runTUI(state, updateAvailable) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("Terminal interactif requis pour le mode plein écran.");
    process.exit(1);
  }
  const screen = new Screen(state, updateAvailable);

  screen.onLine = async (line) => {
    if (screen.pendingWrite && line !== "/end") {
      screen.pendingWrite.lines.push(line);
      screen.render();
      return;
    }
    let skipPush = false;
    if (line.startsWith("/")) {
      const [cmd, ...rest] = line.slice(1).split(" ");
      const arg = rest.join(" ").trim();
      const MODELS = ["aura-1.1", "aura-1.2", "aura-1.1-code"];
      const EFFORTS = ["low", "middle", "high", "xhigh"];
      const LANGS = ["fr", "en"];
      const saveCfg = () => saveJson(CONFIG_FILE, {
        apiKey: state.key, model: state.model, effort: state.effort,
        lang: state.lang, theme: state.theme,
      });
      const pickModal = (title, options, current, apply) => {
        screen.openModal(title, options.map((o) => ({ label: o + (o === current ? "  ● actuel" : ""), value: o })), (v) => {
          if (!v) { screen.render(); return; }
          apply(v);
        });
      };
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
          if (!arg) {
            pickModal("Modèle", MODELS, state.model, (v) => {
              state.model = v; saveCfg();
              screen.sys("Modèle : " + v);
              screen.render();
            });
            return;
          }
          if (!MODELS.includes(arg)) { screen.sys("Modèle inconnu. Valides : " + MODELS.join(", ")); return; }
          state.model = arg; saveCfg();
          screen.sys("Modèle : " + arg);
          screen.render();
          return;
        case "effort":
          if (!arg) {
            pickModal("Effort", EFFORTS, state.effort, (v) => {
              state.effort = v; saveCfg();
              screen.sys("Effort : " + v);
              screen.render();
            });
            return;
          }
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
          const n = Math.max(1, parseInt(arg, 10) || 1);
          const lasts = screen.messages.filter((m) => m.role === "assistant" && (m.text || "").trim());
          const last = lasts[lasts.length - n];
          if (!last) { screen.sys("Rien à copier."); return; }
          try {
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
            m.role === "user" ? `**Toi :** ${m.text}` : m.role === "assistant" ? `**Aura :** ${m.text}` : m.role === "tool" ? `⚙ ${m.name} : ${(m.output || "").slice(0, 500)}` : `_${m.text}_`
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
          if (!arg) {
            pickModal("Thème", names, state.theme || "pastel", (v) => {
              Object.assign(P, THEMES[v]);
              state.theme = v;
              saveCfg();
              screen.sys("Thème : " + v);
              screen.render();
            });
            return;
          }
          if (!THEMES[arg]) { screen.sys("Thème inconnu. Dispos : " + names.join(", ")); return; }
          Object.assign(P, THEMES[arg]);
          state.theme = arg;
          saveCfg();
          screen.sys("Thème : " + arg);
          screen.render();
          return;
        }
        case "lang": {
          if (!arg) {
            pickModal("Langue", LANGS, state.lang || "fr", (v) => {
              state.lang = v; saveCfg();
              screen.sys("Langue : " + v);
              screen.render();
            });
            return;
          }
          if (!LANGS.includes(arg)) { screen.sys("Langue inconnue. Valides : fr, en"); return; }
          state.lang = arg; saveCfg();
          screen.sys("Langue : " + arg);
          screen.render();
          return;
        }
        case "sessions": {
          await screen.toggleSidebar();
          return;
        }
        case "account": {
          await screen.toggleAccount();
          return;
        }
        case "retry": {
          if (!screen.lastPrompt) { screen.sys("Rien à relancer."); return; }
          for (let i = screen.messages.length - 1; i >= 0; i--) {
            if (screen.messages[i].role === "assistant") { screen.messages.splice(i, 1); break; }
          }
          line = screen.lastPrompt;
          skipPush = true;
          break;
        }
        case "compact": {
          const n = Math.max(2, Math.min(100, parseInt(arg, 10) || 20));
          if (screen.messages.length > n) screen.messages.splice(0, screen.messages.length - n);
          screen.sys(`Historique compacté : ${n} derniers blocs.`);
          screen.render();
          return;
        }
        case "stats": {
          const users = screen.messages.filter((m) => m.role === "user").length;
          const bots = screen.messages.filter((m) => m.role === "assistant").length;
          const tools = screen.messages.filter((m) => m.role === "tool").length;
          screen.sys(`Session ${(getSessionId() || "—").slice(0, 8)} • ${screen.messages.length} blocs (${users} toi / ${bots} Aura / ${tools} outils)`);
          screen.sys(`${state.model} • ${state.effort} • ${state.lang || "fr"} • ${screen.quotaText || "quota ?"}`);
          return;
        }
        case "doctor": {
          screen.busy = true; screen.render();
          try {
            const h = await (await fetch(API + "/health", { signal: AbortSignal.timeout(8000) })).json().catch(() => ({}));
            screen.sys(h.status === "ok" ? `API ${API} : OK` : `API ${API} : réponse inattendue`);
          } catch (e) { screen.sys("API injoignable : " + e.message); }
          try {
            const ms = await (await fetch(API + "/api/models", { signal: AbortSignal.timeout(8000) })).json().catch(() => []);
            const arr = Array.isArray(ms) ? ms : ms.models || [];
            screen.sys("Modèles : " + (arr.map((m) => m.id || m).join(", ") || "?"));
          } catch (e) { screen.sys("Modèles : ? (" + e.message + ")"); }
          screen.sys("Clé : " + (state.key ? "présente" : "absente (auracode login)"));
          screen.sys(`Node ${process.version} • ${process.platform} • ${process.cwd()}`);
          try {
            const probe = path.join(process.cwd(), ".aura-write-test");
            fs.writeFileSync(probe, "ok");
            fs.unlinkSync(probe);
            screen.sys("Disque : écriture OK ici");
          } catch (e) { screen.sys("Disque : écriture IMPOSSIBLE (" + e.message + ")"); }
          screen.busy = false; screen.render();
          return;
        }
        case "bash": {
          if (!arg) { screen.sys("Usage : /bash <commande>"); return; }
          screen.sys("$ " + arg);
          if (!(await screen.confirm("Exécuter ?"))) { screen.sys("Annulé."); return; }
          const t0 = Date.now();
          const res = await shellOut(arg);
          screen.tool("bash", true, (Date.now() - t0) / 1000, "$ " + arg + "\n" + res);
          return;
        }
        case "read": {
          if (!arg) { screen.sys("Usage : /read <chemin>"); return; }
          try {
            const abs = inside(arg);
            const content = fs.readFileSync(abs, "utf8").slice(0, 6000);
            screen.tool("read " + arg, true, null, content);
          } catch (e) { screen.tool("read " + arg, false, null, e.message); }
          return;
        }
        case "ls": {
          try {
            const dir = inside(arg || ".");
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            screen.tool("ls " + (arg || "."), true, null, entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).join("\n") || "(vide)");
          } catch (e) { screen.tool("ls", false, null, e.message); }
          return;
        }
        case "write": {
          if (!arg) { screen.sys("Usage : /write <chemin>  (puis ton texte, /end pour sauver)"); return; }
          try { inside(arg); } catch (e) { screen.sys("Refusé : " + e.message); return; }
          screen.pendingWrite = { path: arg, lines: [] };
          screen.sys(`Écriture de ${arg} — envoie le contenu (même multiligne), termine par /end.`);
          screen.render();
          return;
        }
        case "end": {
          const pw = screen.pendingWrite;
          if (!pw) { screen.sys("Rien en cours d'écriture."); return; }
          screen.pendingWrite = null;
          const content = pw.lines.join("\n");
          const abs = path.resolve(process.cwd(), pw.path);
          try {
            inside(pw.path);
            let existed = false, prev = "";
            try { prev = fs.readFileSync(abs, "utf8"); existed = true; } catch { /* nouveau */ }
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
            screen.undoStack.push({ path: pw.path, existed, content: prev });
            if (screen.undoStack.length > 10) screen.undoStack.shift();
            screen.tool("write " + pw.path, true, null, `${content.length} caractères écrits (/undo pour annuler)`);
          } catch (e) { screen.tool("write " + pw.path, false, null, e.message); }
          return;
        }
        case "run": {
          let blk = null;
          for (let i = screen.messages.length - 1; i >= 0; i--) {
            const m = screen.messages[i];
            if (m.role !== "assistant") continue;
            const mm = /```(\w*)\n([\s\S]*?)```/.exec(m.text || "");
            if (mm) { blk = { lang: (mm[1] || "").toLowerCase(), code: mm[2] }; break; }
          }
          if (!blk) { screen.sys("Aucun bloc de code à exécuter."); return; }
          screen.sys(`Bloc ${blk.lang || "?"} détecté (${blk.code.length} caractères).`);
          if (!(await screen.confirm("Exécuter ?"))) { screen.sys("Annulé."); return; }
          const runners = {
            js: ["node", ".js"], javascript: ["node", ".js"],
            py: ["python", ".py"], python: ["python", ".py"],
            ps1: ["powershell", ".ps1"], powershell: ["powershell", ".ps1"],
            sh: ["bash", ".sh"], bash: ["bash", ".sh"],
          };
          const r = runners[blk.lang];
          if (!r) { screen.sys("Langage non exécutable ici — utilise /bash pour forcer."); return; }
          const tmp = path.join(os.tmpdir(), `aura-run-${Date.now()}${r[1]}`);
          try {
            fs.writeFileSync(tmp, blk.code);
            const t0 = Date.now();
            const res = await shellOut(`${r[0]} "${tmp}"`);
            screen.tool("run " + blk.lang, true, (Date.now() - t0) / 1000, res);
          } catch (e) { screen.tool("run", false, null, e.message); }
          finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
          return;
        }
        case "undo": {
          const u = screen.undoStack.pop();
          if (!u) { screen.sys("Rien à annuler."); return; }
          try {
            if (!u.existed) fs.unlinkSync(path.resolve(process.cwd(), u.path));
            else fs.writeFileSync(path.resolve(process.cwd(), u.path), u.content);
            screen.sys("Annulé : " + u.path);
          } catch (e) { screen.sys("Undo impossible : " + e.message); }
          screen.render();
          return;
        }
        case "search": {
          if (!arg) { screen.sys("Usage : /search <motif> [dossier]"); return; }
          const [pattern, dir] = arg.split(/\s+/);
          try {
            const t0 = Date.now();
            const res = await TOOLS.search.run({ pattern, path: dir || "." });
            screen.tool("search", true, (Date.now() - t0) / 1000, res);
          } catch (e) { screen.tool("search", false, null, e.message); }
          return;
        }
        case "open": {
          if (!arg) { screen.sys("Usage : /open <chemin>"); return; }
          try {
            const res = await TOOLS.open_file.run({ path: arg }, {
              confirm: (q) => screen.confirm(q),
              sys: (t) => screen.sys(t),
            });
            screen.sys(res);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "sysinfo": {
          try {
            const res = await TOOLS.sysinfo.run({});
            screen.tool("sysinfo", true, null, res);
          } catch (e) { screen.tool("sysinfo", false, null, e.message); }
          return;
        }
        case "uninstall": {
          screen.sys("Désinstalle le programme + entrée PATH" + (fs.existsSync(getInstallDir()) ? "" : " (dossier introuvable)") + ".");
          if (!(await screen.confirm("Désinstaller AuraCode ?"))) { screen.sys("Annulé."); return; }
          const wipe = await screen.confirm("Supprimer aussi ~/.auracode (réglages, historique) ?");
          const { spawn } = require("child_process");
          spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", uninstallCmds(getInstallDir(), wipe)], { detached: true, stdio: "ignore" }).unref();
          screen.sys("Désinstallé. Fermeture...");
          screen.render();
          setTimeout(() => { screen.quit(); setTimeout(() => process.exit(0), 400); }, 600);
          return;
        }
        case "update": {
          screen.sys("Recherche de mise à jour...");
          screen.busy = true; screen.render();
          let v;
          try { v = await checkUpdate(); }
          catch { v = undefined; }
          screen.busy = false;
          if (v === undefined) {
            screen.sys("Vérification impossible (réseau ?). Réessaie /update.");
            screen.render();
            return;
          }
          if (!v) {
            screen.sys("Déjà à jour (" + PKG.version + ").");
            screen.render();
            return;
          }
          screen.updateAvailable = v;
          screen.sys("Mise à jour vers " + v + " (tu as " + PKG.version + ")...");
          screen.render();
          const msg = await selfUpdate(true);
          String(msg).split("\n").forEach((l) => { if (l.trim()) screen.sys(l); });
          screen.render();
          return;
        }
        default:
          screen.sys("Commande inconnue, /help pour la liste.");
          return;
      }
    }
    const { display, send } = expandMentions(line);
    if (!skipPush) screen.messages.push({ role: "user", text: display, time: timeStr() });
    screen.lastPrompt = send;
    screen.busy = true;
    screen.cancelled = false;
    screen.abort = new AbortController();
    screen.render();
    const ui = {
      sys: (t, dim) => screen.sys(t),
      assistant: (t) => screen.assistant(t),
      thinking: (s) => screen.thinking(s),
      confirm: (q) => screen.confirm(q),
      tool: (name, ok, ms, output) => screen.tool(name, ok, ms, output),
      cancelled: () => screen.cancelled,
      signal: screen.abort.signal,
    };
    const t0 = Date.now();
    try {
      await agentTurn(send, state.key, state.model, state.effort, ui, state.lang || "fr");
    } catch (e) {
      if (e && e.name === "AbortError") screen.sys("Interrompu (Échap).");
      else {
        const d = e.data || {};
        screen.sys(d.quota_exceeded ? (d.error || "Quota épuisé.") : `Erreur (${e.status || "?"}) : ${e.message}`);
      }
    }
    const ms = (Date.now() - t0) / 1000;
    for (let i = screen.messages.length - 1; i >= 0; i--) {
      const m = screen.messages[i];
      if (m.role === "assistant" && !m.meta) { m.meta = { ms, tok: Math.max(1, Math.round((m.text || "").length / 4)) }; break; }
      if (m.role === "user") break;
    }
    screen.busy = false;
    screen.abort = null;
    await screen.refreshQuota();
    screen.render();
  };

  screen.start();
  // Re-vérification auto toutes les 30 min pendant la session.
  const updTimer = setInterval(async () => {
    try {
      const v = await checkUpdate();
      if (v && !screen.updateAvailable) { screen.updateAvailable = v; screen.render(); }
    } catch { /* silencieux */ }
  }, 30 * 60 * 1000);
  if (updTimer.unref) updTimer.unref();
  screen.sys(`Modèle ${state.model} • effort ${state.effort} • dossier ${process.cwd()}`);
  screen.sys("Tape / pour voir les commandes. Les réponses s'affichent ici en direct.");
  screen.busy = true;
  await screen.refreshQuota();
  screen.busy = false;
  screen.render();
  await screen.loop();
  clearInterval(updTimer);
}

// Login OAuth : serveur local http://127.0.0.1:3000/login -> VTH authorize
// -> callback locale -> échange via le VPS (la clé privée ne quitte jamais le serveur).
async function cmdLoginOAuth() {
  const http = require("http");
  const state = newState32();
  let used = false;
  let finish = null;
  let timer = null;
  const page = (title, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#f5f2eb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="background:#fff;border-radius:16px;padding:40px 48px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);max-width:420px"><h1 style="margin:0 0 8px">AuraCode</h1><p style="color:#666">${body}</p></div></body></html>`;
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      if (u.pathname === "/login") {
        const authUrl = vthAuthorizeUrl(state);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(page("AuraCode — Connexion", `Connecte-toi avec ton compte VTH.<br><br><a href="${authUrl.replace(/&/g, "&amp;")}" style="display:inline-block;background:#c15f3c;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600">Se connecter avec VTH</a>`));
        return;
      }
      if (u.pathname === "/auracode/auth/callback") {
        const st = u.searchParams.get("state") || "";
        const code = u.searchParams.get("secretCode") || "";
        const same = st.length > 0 && st.length === state.length && crypto.timingSafeEqual(Buffer.from(st), Buffer.from(state));
        if (used || !same || !code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page("Échec", "Session invalide ou expirée. Relance <code>auracode login</code> dans ton terminal."));
          finish(null);
          return;
        }
        used = true;
        try {
          const r = await fetch(API + "/api/auth/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const j = await r.json().catch(() => ({}));
          if (!j.access_token) throw new Error(j.error || ("HTTP " + r.status));
          saveVth({ access_token: j.access_token, refresh_token: j.refresh_token || null, obtained_at: Date.now() });
          vthCurrent = j.access_token;
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page("Connecté ✓", "Ton compte VTH est lié. Retourne dans ton terminal, c'est prêt."));
          finish(true);
        } catch (e) {
          res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          res.end(page("Échec", "Échange impossible : " + String((e && e.message) || e)));
          finish(null);
        }
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("?");
    } catch {
      try { res.writeHead(500); res.end("?"); } catch { /* ignore */ }
    }
  });
  const ok = await new Promise((resolve) => {
    finish = (v) => {
      if (timer) clearTimeout(timer);
      try { server.closeAllConnections(); } catch { /* ignore */ }
      try { server.close(); } catch { /* ignore */ }
      resolve(v);
    };
    timer = setTimeout(() => finish(null), 10 * 60 * 1000);
    server.on("error", (e) => {
      console.log("Port 3000 occupé ou réseau local bloqué (" + ((e && e.message) || e) + "). Libère le port puis réessaie.");
      finish(null);
    });
    server.listen(AURA_LOGIN_PORT, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${AURA_LOGIN_PORT}/login`;
      console.log("Ouvre cette page si le navigateur ne s'ouvre pas :\n" + url + "\n");
      openBrowser(url);
    });
  });
  return !!ok;
}

// Désinstallation propre : programme + entrée PATH, puis (option) données locales.
// Exécutée dans un processus détaché car le script en cours ne peut pas toujours
// s'auto-supprimer sous Windows. Ne touche JAMAIS au dossier projet courant.
async function cmdUninstall() {
  const dir = getInstallDir();
  let hasInstall = false;
  try { hasInstall = fs.existsSync(dir); } catch { /* ignore */ }
  console.log(P.bold + P.pink + "Désinstaller AuraCode ?" + P.reset);
  if (hasInstall) console.log("  Supprimé : " + dir + " (programme)");
  else console.log("  (aucune installation programme trouvée : " + dir + ")");
  console.log("  Retiré du PATH utilisateur (si présent).");
  console.log("  Les conversations serveur sont conservées (compte intact).");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askYN = (q) => new Promise((res) => rl.question(q + " [o/N] ", (a) => res(/^o(ui)?$/i.test(a.trim()))));
  if (!(await askYN("Désinstaller le programme ?"))) { console.log("Annulé."); rl.close(); return; }
  const wipeData = await askYN("Supprimer aussi les données locales (~/.auracode : réglages, historique, sessions) ?");
  rl.close();
  if (process.platform === "win32") {
    const { spawn } = require("child_process");
    console.log("Suppression en cours (tu peux fermer ce terminal)...");
    spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", uninstallCmds(dir, wipeData)], { detached: true, stdio: "ignore" }).unref();
  } else {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.log("Dossier programme : " + e.message); }
    console.log("(pense à retirer " + dir + " de ton PATH shell : ~/.bashrc, ~/.zshrc...)");
    if (wipeData) {
      try { fs.rmSync(HOME, { recursive: true, force: true }); } catch (e) { console.log("Données : " + e.message); }
    }
  }
  console.log("Désinstallé. Au revoir !");
  setTimeout(() => process.exit(0), 800);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) { console.log(PKG.version); return; }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AuraCode v${PKG.version}\n\nUsage:\n  auracode              Démarre l'assistant (intro + chat)\n  auracode setup          Écran d'installation pastel (clé, modèle, effort)\n  auracode login          Connexion VTH (navigateur localhost:3000)\n  auracode logout         Oublie la clé\n  auracode new            Nouvelle conversation\n  auracode update         Met à jour le .exe (Windows)
  auracode uninstall      Désinstalle (confirmation, tokens effacés)\n  auracode --model X      Modèle (aura-1.1, aura-1.2, aura-1.1-code)\n  auracode --effort X     Effort (low, middle, high, xhigh)\n  auracode "question"       Réponse unique sans ouvrir l'interface
  Plein écran : /new /model /effort /lang /sessions /retry /bash /read /run /write /doctor /stats /quota /image /copy /export /theme /update /clear /help (/ = suggestions, @fichier, Ctrl+P palette, F1 aide)\n`);
    return;
  }
  purgeStoredSecrets();
  let model = "aura-1.1-code", effort = "high", lang = "fr";
  try {
    const saved = loadJson(CONFIG_FILE, {});
    if (saved.model) model = saved.model;
    if (saved.effort) effort = saved.effort;
    if (saved.lang) lang = saved.lang;
  } catch { /* config absente, défauts */ }
  const mi = args.indexOf("--model");
  if (mi >= 0 && args[mi + 1]) model = args[mi + 1];
  const ei = args.indexOf("--effort");
  if (ei >= 0 && args[ei + 1]) effort = args[ei + 1];

  if (args[0] === "login") {
    console.log("Connexion via VTH Auth (navigateur)...\n");
    const ok = await cmdLoginOAuth();
    if (ok) { console.log("Connecté ✓ (compte VTH lié, conversations synchronisées avec le web)"); return; }
    console.log("Navigateur indisponible ou délai dépassé — colle une clé ak-vth-... :");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Colle ta clé API : ", (k) => {
      k = k.trim();
      if (!k) { console.log("Clé vide, annulé."); rl.close(); return; }
      memApiKey = k;
      console.log("Connecté ✓ (clé gardée en mémoire seule — login à refaire au prochain lancement)");
      rl.close();
    });
    return;
  }
  if (args[0] === "logout") {
    const cfg = loadJson(CONFIG_FILE, {});
    delete cfg.apiKey; saveJson(CONFIG_FILE, cfg);
    memApiKey = null;
    clearVth(); vthCurrent = null;
    console.log("Déconnecté (clé API + compte VTH oubliés de la mémoire).");
    return;
  }
  if (args[0] === "uninstall") {
    await cmdUninstall();
    return;
  }
  if (args[0] === "setup") {
    await cmdSetup();
    return;
  }
  if (args[0] === "new") {
    const key = getKey() || await vthAccess() || "";
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
    let key = getKey() || await vthAccess() || "";
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

  const updateAvailable = await splash();
  let key = getKey() || await vthAccess() || "";
  if (!key) {
    // Connexion sans rien taper : navigateur d'abord, setup manuel en secours.
    console.log("Connexion VTH requise — ouverture du navigateur (aucune saisie nécessaire)...\n");
    await cmdLoginOAuth();
    key = getKey() || await vthAccess() || "";
    if (!key) {
      console.log("Navigateur indisponible — configuration manuelle.\n");
      await cmdSetup();
      key = getKey() || await vthAccess() || "";
      if (!key) return;
    }
  }
  try {
    if (!getSessionId()) {
      // Sync inter-comptes : reprend la dernière conversation du serveur (web ↔ CLI
      // partagent les mêmes sessions) au lieu d'en créer une neuve à chaque dossier.
      let synced = false;
      try {
        const d = await api("/api/sessions", null, key, "GET");
        const list = d.sessions || [];
        if (list.length) {
          const s = list[list.length - 1];
          setSessionId(s.session_id);
          if (s.model) model = s.model;
          synced = true;
        }
      } catch { /* ignore */ }
      if (!synced) await newSession(key, model);
    }
  } catch (e) {
    console.log("Erreur API (" + (e.status || "?") + ") : " + e.message);
    return;
  }
  // ---------- Mode plein écran ----------
  const state = { key, model, effort, lang, theme: "pastel" };
  try {
    const savedTheme = loadJson(CONFIG_FILE, {}).theme;
    if (savedTheme && THEMES[savedTheme]) {
      Object.assign(P, THEMES[savedTheme]);
      state.theme = savedTheme;
    }
  } catch { /* défaut pastel */ }
  await runTUI(state, updateAvailable);
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
