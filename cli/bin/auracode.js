#!/usr/bin/env node
/* AuraCode — agent terminal connecté au cloud VTH (api.ia.vth-mc.fr).
 * Zéro dépendance, Node 18+. Stockage privé : sessions sur ton VPS.
 * FICHIER GÉNÉRÉ — ne pas éditer. Sources : cli/src/shared.js (commun),
 * backend.js (API/agent/outils/auth), ui.js (affichage terminal), main.js (commandes).
 * Régénérer : node scripts/bundle.js (ou `npm run build` dans cli/).
 */
// cli/src/shared.js — constantes, helpers purs et petits moteurs (aucune dépendance métier).
// Bundlé dans cli/bin/auracode.js via `node scripts/bundle.js`.
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const { exec, execSync } = require("child_process");

const HOME = path.join(os.homedir(), ".auracode");
const CONFIG_FILE = path.join(HOME, "config.json");
const SESSIONS_FILE = path.join(HOME, "sessions.json");
const HIST_FILE = path.join(HOME, "history.json");

const PKG = { version: "1.3.0.4" };

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
  opencode: { pink: "\x1b[38;2;255;95;86m", mint: "\x1b[38;2;80;200;120m", lavender: "\x1b[38;2;150;160;180m", peach: "\x1b[38;2;255;150;100m", sky: "\x1b[38;2;120;170;220m", lemon: "\x1b[38;2;230;220;170m", dim: "\x1b[38;2;130;135;145m", lilac: "\x1b[38;2;180;150;220m", aqua: "\x1b[38;2;100;200;210m", butter: "\x1b[38;2;220;200;130m", coral: "\x1b[38;2;255;110;100m" },
};

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return fallback; }
}
function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
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

// --- Désinstallation réelle : détection du mode + plan + script ---
// classifyInstall(o) est pur et testable : o = { execPath, filename, localData }.
// kind: 'exe' (binaire SEA) | 'npm' (npm -g) | 'script' (install.ps1) | 'repo' (sources dev).
function classifyInstall(o) {
  o = o || {};
  const f = String(o.filename || "");
  const e = String(o.execPath || "");
  if (/auracode\.exe$/i.test(e)) return { kind: "exe", dir: path.dirname(e) };
  const m = /node_modules[\\/]auracode([\\/]|$)/i.exec(f);
  if (m) {
    let dir = f.slice(0, m.index + m[0].length);
    dir = dir.replace(/[\\/]+$/, "");
    return { kind: "npm", dir };
  }
  const local = o.localData ? path.join(o.localData, "AuraCode") : "";
  if (local) {
    const fl = f.toLowerCase();
    const ll = local.toLowerCase();
    if (fl === ll || fl.startsWith(ll + path.sep)) return { kind: "script", dir: local };
  }
  return { kind: "repo", dir: "" };
}

function detectInstall() {
  const info = classifyInstall({
    execPath: process.execPath,
    filename: __filename,
    localData: process.platform === "win32" ? (process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")) : "",
  });
  let exists = false;
  try { exists = !!info.dir && fs.existsSync(info.dir); } catch { exists = false; }
  info.exists = exists;
  return info;
}

// Plan de suppression. removePaths = fichiers/dossiers à supprimer (avec réessais),
// rmdirParents = dossiers à supprimer seulement si vides, pathStrip = retirés du PATH.
// En mode repo, on ne touche JAMAIS au code (removePaths vide).
function uninstallPlan(info) {
  const strip = [];
  try { const d = getInstallDir(); if (d) strip.push(d); } catch { /* ignore */ }
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  if (info.kind === "exe") {
    const exe = process.execPath;
    return { removePaths: [exe], rmdirParents: [path.dirname(exe)], pathStrip: uniq(strip.concat([path.dirname(exe)])) };
  }
  if (info.kind === "npm" || info.kind === "script") {
    const dirs = info.dir ? [info.dir] : [];
    return { removePaths: dirs, rmdirParents: [], pathStrip: uniq(strip.concat(dirs)) };
  }
  return { removePaths: [], rmdirParents: [], pathStrip: strip };
}

// Génère le script .ps1 de désinstallation (pur, testable).
// Le script attend la fin du processus parent (pid, timeout 60s), supprime les
// cibles avec réessais (12 x 500ms, fichiers verrouillés), vide les dossiers
// parents seulement s'ils sont vides, nettoie le PATH utilisateur (match exact,
// insensible à la casse), efface les données si demandé, journalise dans logFile,
// puis s'auto-supprime.
function buildUninstallerPs(o) {
  o = o || {};
  const pid = parseInt(o.pid, 10) || 0;
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const arr = (a) => "@(" + (a || []).filter(Boolean).map((x) => q(x)).join(", ") + ")";
  const L = [];
  L.push("$ErrorActionPreference = 'SilentlyContinue'");
  L.push(`$log = ${q(o.logFile || "")}`);
  L.push("function L($m) { if ($log) { Add-Content -LiteralPath $log -Value ('[' + (Get-Date -Format o) + '] ' + $m) } }");
  L.push(`L ${q("--- debut desinstallation (pid parent: " + pid + ") ---")}`);
  L.push("$n = 0");
  L.push(`while ($n -lt 120) { $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if (-not $p -or $p.HasExited) { break }; Start-Sleep -Milliseconds 500; $n++ }`);
  L.push("L 'parent termine (ou timeout 60s), suppression...'");
  L.push(`$i = 0`);
  L.push(`foreach ($t in ${arr(o.removePaths)}) {`);
  L.push(`  $ok = $false; $tr = 0`);
  L.push(`  while (-not $ok -and $tr -lt 24) {`);
  L.push(`    try { if (Test-Path -LiteralPath $t) { Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction Stop }; $ok = $true }`);
  L.push(`    catch { $tr++; Start-Sleep -Milliseconds 500 }`);
  L.push(`  }`);
  L.push(`  $i++; if ($ok) { L ('OK [' + $i + ']: ' + $t) } else { L ('ECHEC [' + $i + ']: ' + $t) }`);
  L.push(`}`);
  L.push(`foreach ($d in ${arr(o.rmdirParents)}) {`);
  L.push(`  try { if ((Get-ChildItem -LiteralPath $d -Force | Measure-Object).Count -eq 0) { Remove-Item -LiteralPath $d -Force; L ('dossier vide supprime: ' + $d) } else { L ('dossier conserve (non vide): ' + $d) } } catch { L ('dossier ECHEC: ' + $d) }`);
  L.push(`}`);
  L.push(`$tl = ${arr(o.pathStrip)}`);
  L.push(`$tlNorm = @($tl | ForEach-Object { $_.TrimEnd('\\', '/').ToLower() })`);
  L.push(`$path = [Environment]::GetEnvironmentVariable('Path', 'User')`);
  L.push(`$parts = @($path -split ';' | Where-Object { $_ -and $_.Trim() -ne '' })`);
  L.push(`$keep = @($parts | Where-Object { $tlNorm -notcontains $_.Trim().TrimEnd('\\', '/').ToLower() })`);
  L.push(`[Environment]::SetEnvironmentVariable('Path', ($keep -join ';'), 'User')`);
  L.push(`L 'PATH nettoye'`);
  if (o.wipeData && o.homeDir) {
    L.push(`$hd = ${q(o.homeDir)}`);
    L.push(`$okd = $false; $trd = 0`);
    L.push(`while (-not $okd -and $trd -lt 24) { try { if (Test-Path -LiteralPath $hd) { Remove-Item -LiteralPath $hd -Recurse -Force -ErrorAction Stop }; $okd = $true } catch { $trd++; Start-Sleep -Milliseconds 500 } }`);
    L.push(`if ($okd) { L 'donnees OK' } else { L 'donnees ECHEC' }`);
  } else {
    L.push(`L 'donnees conservees'`);
  }
  L.push(`L '--- fin ---'`);
  L.push(`Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force`);
  return L.join("\r\n");
}

const AURA13_LAUNCH_ISO = "2026-10-18T15:00:00+00:00"; // 17h Paris (été, UTC+2)
const AURA13_LAUNCH_LABEL = "dimanche 18 octobre à 17h";
const AURA13_WAIT_URL = "https://ai.vth-mc.fr/?error=try-to-use-1.3";
// Fenêtre de fête : 3 h après la sortie (splash + feux automatiques).
const aura13Party = () => {
  try {
    const t = Date.parse(AURA13_LAUNCH_ISO);
    if (!Number.isFinite(t)) return false;
    const now = Date.now();
    return now >= t && now < t + 3 * 3600 * 1000;
  } catch { return false; }
};
const aura13Locked = () => {
  try {
    const t = Date.parse(AURA13_LAUNCH_ISO);
    return Number.isFinite(t) && Date.now() < t;
  } catch { return false; }
};
const aura13Countdown = () => {
  const ms = Math.max(0, Date.parse(AURA13_LAUNCH_ISO) - Date.now());
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${d}j ${hh}:${mm}:${ss}`;
};
// ID unique de build : hash court du fichier exécuté (marche en mode script comme .exe,
// sans maintenance manuelle). Chaque mise à jour a donc son identifiant vérifiable.
let BUILD_ID = null;
const buildId = () => {
  if (BUILD_ID) return BUILD_ID;
  try {
    BUILD_ID = crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex").slice(0, 8);
  } catch { BUILD_ID = "dev"; }
  return BUILD_ID;
};

// 🎆 Feux d'artifice latéraux : fusées + explosion + retombées. Touche = passer.
// Comparaison semver : >0 si a plus récent, <0 si plus vieux, 0 si égaux.
// (Évite les faux "update dispo" quand le code local est en avance sur main.)
const cmpVer = (a, b) => {
  const norm = (v) => String(v || "").trim().replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
  const pa = norm(a), pb = norm(b);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

// ---------- Helpers d'affichage (style opencode) ----------
const stripAnsi = (s) => String(s || "").replace(/\x1b\[[0-9;]*m/g, "");
// Pastille clavier façon site : [ Tab ] sur fond beige, texte sombre.
const kbd = (s) => `\x1b[48;2;222;216;198m\x1b[38;2;38;36;34m ${s} ${P.reset}`;
// Barre de progression ASCII en dégradé (menthe -> citron -> corail).
const vbar = (pct, w = 10) => {
  const f = Math.max(0, Math.min(w, Math.round((Number(pct) || 0) / 100 * w)));
  let s = "";
  for (let i = 0; i < f; i++) {
    const c = (i / w) * 100;
    s += (c < 50 ? P.mint : c < 80 ? P.lemon : P.coral) + "█";
  }
  return s + P.reset + "░".repeat(w - f);
};
// Texte en dégradé pastel : chaque caractère prend la couleur suivante.
const gradText = (s, cols) => {
  const C = (cols && cols.length ? cols : [P.pink, P.peach, P.butter, P.mint, P.aqua, P.sky, P.lavender, P.lilac]);
  const chars = [...String(s || "")];
  if (!chars.length) return "";
  return chars.map((ch, i) => C[i % C.length] + ch).join("") + P.reset;
};
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

// ---------- Petits moteurs (zéro dépendance) ----------
// Calculatrice sûre (pas d'eval) : + - * / % ^, (), sqrt/abs/sin/cos/log..., pi/e.
const calcExpr = (src) => {
  const FUNCS = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: (x) => Math.log10(x), ln: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round };
  const CONSTS = { pi: Math.PI, e: Math.E };
  let i = 0;
  const s = String(src || "");
  const skip = () => { while (/\s/.test(s[i])) i++; };
  const parseNum = () => { skip(); const m = /^(\d+(?:\.\d+)?)/.exec(s.slice(i)); if (!m) throw new Error(`nombre attendu (pos ${i})`); i += m[1].length; return parseFloat(m[1]); };
  const parsePrimary = () => {
    skip();
    if (s[i] === "(") { i++; const v = parseAdd(); skip(); if (s[i] !== ")") throw new Error(") manquante"); i++; return v; }
    if (s[i] === "-") { i++; return -parsePrimary(); }
    if (s[i] === "+") { i++; return parsePrimary(); }
    const id = /^([a-z]+)/.exec(s.slice(i));
    if (id) {
      const name = id[1];
      if (CONSTS[name] !== undefined && s[i + name.length] !== "(") { i += name.length; return CONSTS[name]; }
      if (FUNCS[name]) { i += name.length; skip(); if (s[i] !== "(") throw new Error("( attendue après " + name); i++; const v = parseAdd(); skip(); if (s[i] !== ")") throw new Error(") manquante"); i++; return FUNCS[name](v); }
      throw new Error("inconnu : " + name);
    }
    return parseNum();
  };
  const parsePow = () => { const v = parsePrimary(); skip(); if (s[i] === "^") { i++; return Math.pow(v, parsePow()); } return v; };
  const parseMul = () => { let v = parsePow(); for (;;) { skip(); const op = s[i]; if (op === "*" || op === "/" || op === "%") { i++; const r = parsePow(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } else return v; } };
  const parseAdd = () => { let v = parseMul(); for (;;) { skip(); const op = s[i]; if (op === "+" || op === "-") { i++; const r = parseMul(); v = op === "+" ? v + r : v - r; } else return v; } };
  const v = parseAdd();
  skip();
  if (i < s.length) throw new Error("inattendu : " + s.slice(i));
  if (!isFinite(v)) throw new Error("résultat infini");
  return v;
};
// Durées : "25m", "1h30m", "45s", "90" (=90 min). Retourne des ms.
const parseDur = (s) => {
  const t = String(s || "").trim().toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60000;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[3])) throw new Error("durée ? (ex : 25m, 1h30m, 45s)");
  const ms = (parseInt(m[1] || "0", 10) * 3600 + parseInt(m[2] || "0", 10) * 60 + parseInt(m[3] || "0", 10)) * 1000;
  if (ms <= 0 || ms > 12 * 3600 * 1000) throw new Error("durée entre 1s et 12h");
  return ms;
};
// Listes persistées (notes, todos) : [{t, text, done?}].
const NOTES_FILE = path.join(HOME, "notes.json");
const TODOS_FILE = path.join(HOME, "todos.json");
const loadList = (p) => { try { const a = JSON.parse(fs.readFileSync(p, "utf8")); return Array.isArray(a) ? a : []; } catch { return []; } };
const saveList = (p, a) => { try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(a, null, 2)); return true; } catch { return false; } };
// Export.
const escapeHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const exportTxt = (messages) => messages.map((m) => m.role === "user" ? `Toi : ${m.text}` : m.role === "assistant" ? `Aura : ${m.text}` : m.role === "tool" ? `⚙ ${m.name} : ${m.output || ""}` : `${m.text}`).join("\n\n");
const exportHtml = (messages) => {
  const rows = messages.map((m) => {
    const cls = m.role === "user" ? "user" : m.role === "assistant" ? "aura" : "sys";
    const head = m.role === "user" ? "Toi" : m.role === "assistant" ? "Aura" : (m.name || "info");
    const body = m.role === "tool" ? (m.output || "") : (m.text || "");
    return `<div class="msg ${cls}"><div class="head">${escapeHtml(head)} <span>${escapeHtml(m.time || "")}</span></div><pre>${escapeHtml(body)}</pre></div>`;
  }).join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Conversation AuraCode</title><style>body{font-family:system-ui;background:#f5f2eb;color:#262624;max-width:760px;margin:0 auto;padding:24px}.msg{border-radius:12px;padding:12px 16px;margin:12px 0}.user{background:#D97757;color:#fff;margin-left:20%}.aura{background:#FAF9F5;border:1px solid #DED8C6}.sys{color:#6F6E69;font-size:13px;text-align:center}.head{font-weight:700;font-size:12px;margin-bottom:6px}.head span{font-weight:400;opacity:.7}pre{white-space:pre-wrap;margin:0;font-size:13px}</style></head><body><h1>Conversation AuraCode</h1>${rows}</body></html>`;
};
// Recherche dans l'historique : [{i, role, snippet}].
const findMatches = (messages, q) => {
  const needle = String(q || "").toLowerCase();
  if (!needle) return [];
  const out = [];
  messages.forEach((m, i) => {
    const t = String(m.text || m.output || "");
    const idx = t.toLowerCase().indexOf(needle);
    if (idx >= 0) out.push({ i, role: m.role, snippet: t.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, " ") });
  });
  return out;
};
// Top fichiers du dossier : [{name, size}].
const topFiles = (dir, n = 10) => {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    try {
      const st = fs.statSync(full);
      if (st.isFile()) files.push({ name: e.name, size: st.size });
    } catch { /* ignore */ }
  }
  return files.sort((a, b) => b.size - a.size).slice(0, n);
};
const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " Mo" : b > 1024 ? (b / 1024).toFixed(1) + " Ko" : b + " o";
// Minuteur avec compte à rebours dans la barre de statut + cloche à la fin.
function startTimer(screen, ms, label) {
  stopTimer(screen, true);
  screen.timer = { until: Date.now() + ms, label: label || "minuteur" };
  screen.timer.iv = setInterval(() => {
    if (!screen.timer) return;
    if (screen.timer.until - Date.now() <= 0) {
      const l = screen.timer.label;
      stopTimer(screen, true);
      screen.sys(`⏱ Temps écoulé : ${l}`);
      try { process.stdout.write("\x07\x07\x07"); } catch { /* ignore */ }
      screen.render();
      return;
    }
    screen.render();
  }, 1000);
  if (screen.timer.iv.unref) screen.timer.iv.unref();
  screen.render();
}
function stopTimer(screen, silent) {
  if (screen.timer) {
    try { clearInterval(screen.timer.iv); } catch { /* ignore */ }
    screen.timer = null;
    if (!silent) screen.sys("Minuteur arrêté.");
    screen.render();
  }
}

// ---------- Moteurs V1 ----------
// Diff unifié simplifié (borné) : ["- vieux", "+ neuf", "  ctx", "…"].
const diffLines = (a, b, ctx = 3, max = 60) => {
  const A = String(a || "").split("\n"), B = String(b || "").split("\n");
  const n = Math.min(A.length, 200), m = Math.min(B.length, 200);
  const aa = A.slice(0, n), bb = B.slice(0, m);
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = aa[i] === bb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aa[i] === bb[j]) { ops.push([" ", aa[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", aa[i]]); i++; }
    else { ops.push(["+", bb[j]]); j++; }
  }
  while (i < n) ops.push(["-", aa[i++]]);
  while (j < m) ops.push(["+", bb[j++]]);
  if (A.length > 200 || B.length > 200) ops.push(["…", "(tronqué à 200 lignes)"]);
  const keep = new Set();
  ops.forEach((o, k) => { if (o[0] !== " ") for (let d = -ctx; d <= ctx; d++) keep.add(k + d); });
  const out = [];
  let skipped = false;
  ops.forEach((o, k) => {
    if (!keep.has(k)) { if (!skipped) { out.push("…"); skipped = true; } return; }
    skipped = false;
    out.push(`${o[0]} ${o[1]}`);
  });
  const lines = out.slice(0, max);
  if (out.length > max) lines.push(`… +${out.length - max} lignes`);
  return lines.join("\n");
};
const paintDiff = (t) => String(t || "").split("\n").map((l) =>
  l.startsWith("+") ? P.mint + l + P.reset : l.startsWith("-") ? P.coral + l + P.reset : l.startsWith("…") ? P.dim + l + P.reset : l
).join("\n");
// Dernier bloc de code d'une conversation : {lang, code} | null.
const findCodeBlock = (screen) => {
  for (let i = screen.messages.length - 1; i >= 0; i--) {
    const m = screen.messages[i];
    if (m.role !== "assistant") continue;
    const mm = /```(\w*)\n([\s\S]*?)```/.exec(m.text || "");
    if (mm) return { lang: (mm[1] || "").toLowerCase(), code: mm[2] };
  }
  return null;
};
// Appel modèle simple (sans outils) : bulle + méta + quota.
async function askModel(screen, state, text, model, effort = "middle") {
  let sid = getSessionId();
  if (!sid) sid = await newSession(state.key, model);
  const t0 = Date.now();
  const d = await api("/api/chat", { message: text, session_id: sid, model, effort }, state.key);
  const reply = String(d.reply || "").trim() || "(vide)";
  screen.assistant(reply, { ms: (Date.now() - t0) / 1000, tok: Math.max(1, Math.round(reply.length / 4)) });
  await screen.refreshQuota();
}
const MACROS_FILE = path.join(HOME, "macros.json");
// Usage disque borné : {bytes, files, capped}.
const diskUsage = (dir, maxFiles = 3000, maxDepth = 6) => {
  let bytes = 0, files = 0, stop = false;
  const walk = (d, depth) => {
    if (stop || depth > maxDepth) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (stop) return;
      if (e.name === "node_modules" || e.name === ".git") continue;
      const full = path.join(d, e.name);
      try {
        if (e.isDirectory()) walk(full, depth + 1);
        else { const st = fs.statSync(full); if (st.isFile()) { bytes += st.size; if (++files >= maxFiles) stop = true; } }
      } catch { /* ignore */ }
    }
  };
  walk(dir, 0);
  return { bytes, files, capped: stop };
};
// Lignes de code par extension : [[ext, {files, lines}]].
const countLoc = (dir) => {
  const exts = {};
  let files = 0;
  const walk = (d, depth) => {
    if (depth > 5 || files > 2000) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
      const full = path.join(d, e.name);
      try {
        if (e.isDirectory()) walk(full, depth + 1);
        else if (e.isFile() && /\.(js|ts|tsx|jsx|py|json|md|html|css|txt|yml|yaml|toml|rs|go|java|c|cpp|h|php|rb)$/i.test(e.name)) {
          const c = fs.readFileSync(full, "utf8");
          const ext = (e.name.split(".").pop() || "?").toLowerCase();
          exts[ext] = exts[ext] || { files: 0, lines: 0 };
          exts[ext].files++; exts[ext].lines += c.split("\n").length; files++;
        }
      } catch { /* ignore */ }
    }
  };
  walk(dir, 0);
  return Object.entries(exts).sort((a, b) => b[1].lines - a[1].lines).slice(0, 10);
};
// Arbre de dossiers ASCII.
const treeStr = (dir, maxDepth = 3) => {
  const out = [];
  const walk = (d, depth, prefix) => {
    if (depth > maxDepth || out.length > 120) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.name !== "node_modules" && e.name !== ".git"); } catch { return; }
    entries.forEach((e, i) => {
      const last = i === entries.length - 1;
      out.push(`${prefix}${last ? "└── " : "├── "}${e.name}${e.isDirectory() ? "/" : ""}`);
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1, prefix + (last ? "    " : "│   "));
    });
  };
  walk(dir, 0, "");
  return out.join("\n");
};
// Calendrier ASCII du mois.
const calMonth = (year, month) => {
  const first = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const rows = [];
  let week = new Array(first).fill("  ");
  for (let d = 1; d <= days; d++) {
    week.push(String(d).padStart(2, " "));
    if (week.length === 7) { rows.push(week.join(" ")); week = []; }
  }
  if (week.length) rows.push(week.join(" "));
  const name = new Date(year, month - 1, 1).toLocaleString("fr-FR", { month: "long", year: "numeric" });
  return `${name}\nLu Ma Me Je Ve Sa Di\n${rows.join("\n")}`;
};
// Tableau markdown depuis "a,b;c,d".
const mdTable = (text) => {
  const rows = String(text || "").split(";").map((r) => r.split(",").map((c) => c.trim()));
  if (!rows.length || !rows[0].length || !rows[0][0]) throw new Error("Usage : /table <a,b;c,d>");
  const cols = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => { const a = r.slice(); while (a.length < cols) a.push(""); return a; });
  const widths = [];
  for (let c = 0; c < cols; c++) widths.push(Math.max(...norm.map((r) => r[c].length)));
  const fmt = (r) => "| " + r.map((v, i) => v.padEnd(widths[i])).join(" | ") + " |";
  return [fmt(norm[0]), "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|", ...norm.slice(1).map(fmt)].join("\n");
};
// Vache qui parle.
const cowSay = (text) => {
  const msg = String(text || "meuh").slice(0, 200);
  return [" " + "_".repeat(msg.length + 2), `< ${msg} >`, " " + "-".repeat(msg.length + 2),
    "        \\   ^__^", "         \\  (oo)\\_______", "            (__)\\       )\\/\\",
    "                ||----w |", "                ||     ||"].join("\n");
};
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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
// cli/src/backend.js — API, agent, outils, auth, sessions, update.
// Bundlé : symboles partagés fournis par shared.js (même portée finale).

const API = process.env.AURA_API || "https://api.ia.vth-mc.fr";
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
async function checkUpdate() {
  // Retourne la version distante SEULEMENT si strictement plus récente (semver),
  // null si à jour ou en avance (dev), undefined si vérification impossible.
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
    if (latest && cmpVer(latest, PKG.version) > 0) {
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
    const rootDir = path.join(dir, "..");
    fs.writeFileSync(path.join(rootDir, "package.json"), JSON.stringify(rp, null, 2));
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
        let old = "";
        try { old = fs.readFileSync(abs, "utf8"); } catch { /* nouveau fichier */ }
        ui.sys(`--- ${old ? "Diff" : "Nouveau fichier"} ${p} (${(content || "").length} caractères) ---`);
        (old ? diffLines(old, content || "").split("\n").slice(0, 25) : String(content || "").split("\n").slice(0, 25)).forEach((l) => ui.sys(l || " "));
        ui.sys("--- fin aperçu ---");
      let okW = ui.permitted && ui.permitted("write_file") ? true : await ui.confirm("Écrire ce fichier ?", !!(ui && ui.permit));
      if (okW === "always" && ui.permit) { ui.permit("write_file"); okW = true; }
      if (!okW) return "Annulé par l'utilisateur.";
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content || "");
      return "Fichier écrit : " + p;
    },
  },
  exec: {
    desc: "Exécute une commande shell (demande confirmation). Args: {cmd}",
    run: (args, ui) => new Promise(async (resolve) => {
      ui.sys("$ " + args.cmd);
      let okE = ui.permitted && ui.permitted("exec") ? true : await ui.confirm("Exécuter ?", !!(ui && ui.permit));
      if (okE === "always" && ui.permit) { ui.permit("exec"); okE = true; }
      if (!okE) return resolve("Annulé par l'utilisateur.");
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
      let okO = ui.permitted && ui.permitted("open_file") ? true : await ui.confirm(`Ouvrir ${p} ?`, !!(ui && ui.permit));
      if (okO === "always" && ui.permit) { ui.permit("open_file"); okO = true; }
      if (!okO) return "Annulé par l'utilisateur.";
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
  const preamble = SYSTEM + (() => { try { const pz = String(loadJson(CONFIG_FILE, {}).persona || "").trim().slice(0, 2000); return pz ? `\n\n[Persona utilisateur : ${pz}]` : ""; } catch { return ""; } })() + `\n\n[Contexte PC : OS ${process.platform}, dossier actuel ${process.cwd()}, dossier perso ${home}, Bureau ${path.join(home, "Desktop")}. Accès COMPLET aux fichiers, chemins relatifs et absolus.]`;
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
// npm rm -g : retourne { ok, msg } (l'appelant affiche, compatible CLI + TUI).
function npmRmGlobal() {
  try {
    const { spawnSync } = require("child_process");
    const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["rm", "-g", "auracode"], { stdio: "pipe", encoding: "utf8" });
    if (r.status === 0) return { ok: true, msg: "npm : paquet supprimé." };
    const detail = String((r.stderr || "") + (r.stdout || "")).trim().slice(0, 300);
    return { ok: false, msg: "npm : échec (code " + r.status + ")" + (detail ? " : " + detail : "") + ", suppression manuelle du dossier prévue." };
  } catch (e) { return { ok: false, msg: "npm : impossible (" + e.message + "), suppression manuelle du dossier prévue." }; }
}

async function cmdUninstall() {
  const info = detectInstall();
  const plan = uninstallPlan(info);
  console.log(P.bold + P.pink + "Désinstaller AuraCode ?" + P.reset);
  if (info.kind === "npm") {
    console.log("  Mode détecté : npm global (" + (info.dir || "?") + (info.exists ? "" : ", dossier absent") + ")");
    console.log("  Supprimé via : npm rm -g auracode (+ nettoyage manuel en secours)");
  } else if (info.kind === "exe") {
    console.log("  Mode détecté : exécutable : " + process.execPath);
    console.log("  Supprimé : le fichier .exe (après fermeture, avec réessais) + dossier vide si vide");
  } else if (info.kind === "script") {
    console.log("  Mode détecté : script install.ps1 (" + (info.dir || "?") + (info.exists ? "" : ", dossier absent") + ")");
  } else {
    console.log("  Mode détecté : sources de développement — le code ne sera PAS supprimé.");
    console.log("  Seront nettoyés : entrées PATH AuraCode + (option) données locales.");
  }
  plan.removePaths.forEach((p) => console.log("  Supprimé : " + p));
  plan.rmdirParents.forEach((p) => console.log("  Dossier vidé si vide : " + p));
  console.log("  Retiré du PATH utilisateur (si présent).");
  console.log("  Les conversations serveur sont conservées (compte intact).");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askYN = (q) => new Promise((res) => rl.question(q + " [o/N] ", (a) => res(/^o(ui)?$/i.test(a.trim()))));
  if (!(await askYN("Désinstaller le programme ?"))) { console.log("Annulé."); rl.close(); return; }
  const wipeData = await askYN("Supprimer aussi les données locales (~/.auracode : réglages, historique, sessions) ?");
  rl.close();
  if (info.kind === "npm") {
    const nr = npmRmGlobal();
    console.log("  " + nr.msg);
  }
  if (process.platform !== "win32") {
    // Pas de verrou d'exécutable hors Windows : suppression directe.
    for (const p of plan.removePaths) { try { fs.rmSync(p, { recursive: true, force: true }); console.log("  OK : " + p); } catch (e) { console.log("  ECHEC : " + p + " (" + e.message + ")"); } }
    console.log("(pense à retirer les dossiers AuraCode de ton PATH shell : ~/.bashrc, ~/.zshrc...)");
    if (wipeData) {
      try { fs.rmSync(HOME, { recursive: true, force: true }); console.log("  Données supprimées."); } catch (e) { console.log("  Données : " + e.message); }
    }
    console.log("Désinstallé. Au revoir !");
    setTimeout(() => process.exit(0), 800);
    return;
  }
  const logFile = path.join(os.tmpdir(), "auracode-uninstall-" + process.pid + ".log");
  const ps1 = buildUninstallerPs({ pid: process.pid, removePaths: plan.removePaths, rmdirParents: plan.rmdirParents, pathStrip: plan.pathStrip, wipeData, homeDir: HOME, logFile });
  const file = path.join(os.tmpdir(), "auracode-uninstall-" + process.pid + ".ps1");
  fs.writeFileSync(file, ps1);
  console.log("Suppression en cours (détail : " + logFile + ")...");
  const { spawn } = require("child_process");
  spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file], { detached: true, stdio: "ignore" }).unref();
  console.log("Désinstallé (vérifie dans un NOUVEAU terminal : where auracode doit échouer). Au revoir !");
  setTimeout(() => process.exit(0), 800);
}
// cli/src/ui.js — affichage terminal : Screen, splash, modales, canvas.
// Bundlé : symboles partagés fournis par shared.js (même portée finale).

function adLine(W) {
  const txt = aura13Locked() ? `✨ Aura 1.3 dans ${aura13Countdown()} — ${AURA13_LAUNCH_LABEL}` : "✨ Aura 1.3 est là — /model aura-1.3 !";
  const pad = " ".repeat(Math.max(0, Math.floor((W - txt.length) / 2)));
  return pad + P.bold + P.butter + txt + P.reset;
}

function brandLine(W) {
  const plain = "Aura by VTH Group";
  const pad = " ".repeat(Math.max(0, Math.floor((W - plain.length) / 2)));
  return pad + P.bold + P.pink + "Aura" + P.reset + P.dim + " by " + P.reset + P.bold + P.sky + "VTH Group" + P.reset;
}

const PARTY_COLS = () => [P.pink, P.butter, P.mint, P.aqua, P.lavender, P.lilac, P.lemon, P.coral];
const PARTY_CH = ["*", "+", "✦", "·", "•", "×"];
const explodeRocket = (r, cols, chs) => {
  const sparks = [];
  const n = 8 + Math.floor(Math.random() * 7);
  const col = cols[Math.floor(Math.random() * cols.length)];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.3 + Math.random() * 0.8;
    sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.2, life: 8 + Math.floor(Math.random() * 9), col, ch: chs[Math.floor(Math.random() * chs.length)] });
  }
  return sparks;
};
async function runFireworks(screen, seconds = 7, title = "🎆 Aura 1.3 est là ! 🎆") {
  if (!process.stdout.isTTY) return;
  const W = process.stdout.columns || 80, H = process.stdout.rows || 24;
  const cols = PARTY_COLS(), chs = PARTY_CH;
  let rockets = [], sparks = [];
  let stopped = false;
  let cleanupKeys = null;
  if (screen) {
    screen.celebrating = true;
  } else if (process.stdin.isTTY) {
    try {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      const onKey = () => { stopped = true; };
      process.stdin.on("keypress", onKey);
      cleanupKeys = () => {
        try { process.stdin.removeListener("keypress", onKey); } catch { /* ignore */ }
        try { if (process.stdin.isTTY) process.stdin.setRawMode(false); } catch { /* ignore */ }
        try { process.stdin.pause(); } catch { /* ignore */ }
      };
    } catch { /* ignore */ }
  }
  const t0 = Date.now();
  process.stdout.write("\x1b[?25l");
  try {
    while (!stopped && !(screen && !screen.celebrating) && Date.now() - t0 < seconds * 1000) {
      if (rockets.length < 3 && Math.random() < 0.35) {
        const left = Math.random() < 0.5;
        rockets.push({ x: left ? 1 + Math.random() * 3 : W - 4 + Math.random() * 3, y: H - 1, vy: -(0.7 + Math.random() * 0.5), fuse: 6 + Math.floor(Math.random() * 6) });
      }
      const grid = Array.from({ length: H }, () => new Array(W).fill(" "));
      const put = (x, y, s) => {
        const xi = Math.round(x), yi = Math.round(y);
        if (xi >= 0 && xi < W && yi >= 0 && yi < H) grid[yi][xi] = s;
      };
      const nextRockets = [];
      for (const r of rockets) {
        r.y += r.vy; r.fuse--;
        if (r.fuse <= 0 || r.y < H * 0.2) sparks.push(...explodeRocket(r, cols, chs));
        else { put(r.x, r.y, P.butter + "↑" + P.reset); nextRockets.push(r); }
      }
      rockets = nextRockets;
      sparks = sparks.filter((p) => p.life > 0 && p.y < H && p.x > -2 && p.x < W + 2);
      for (const p of sparks) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
        put(p.x, p.y, (p.life < 4 ? P.dim : p.col) + p.ch + P.reset);
      }
      const ti = Math.floor(W / 2 - title.length / 2);
      for (let i = 0; i < title.length && ti + i < W; i++) {
        if (ti + i >= 0) grid[Math.floor(H / 2)][ti + i] = P.bold + P.butter + title[i] + P.reset;
      }
      process.stdout.write("\x1b[H" + grid.map((row) => row.join("")).join("\n"));
      await sleep(110);
    }
  } finally {
    if (screen) screen.celebrating = false;
    if (cleanupKeys) cleanupKeys();
    process.stdout.write("\x1b[?25h");
  }
}

const TIPS = [
  "Astuce : / + Tab complète les commandes",
  "Astuce : @fichier joint un fichier au message",
  "Astuce : Ctrl+P palette • F1 aide • F2 sessions",
  "Astuce : /timer 25m + /todo pour rester focus",
  "Astuce : Échap interrompt une réponse en cours",
  "Astuce : /export html sauve la conversation",
];

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
    ...ART_LINES.map((ln) => {
      const pad = " ".repeat(Math.max(0, Math.floor((W - ln.length) / 2)));
      return pad + gradText(ln);
    }),
    center("L'IA qui pilote ton PC — By VTH Group", "sky"),
    "",
    center(`v${PKG.version}`, "dim"),
    center(`build ${buildId()}`, "dim"),
    center(TIPS[Math.floor(Math.random() * TIPS.length)], "dim"),
    "",
  ];
  block.splice(block.length - 1, 0, brandLine(W));
  block.splice(block.length - 1, 0, adLine(W));
  const topPad = Math.max(0, Math.floor((H - block.length - 1) / 2));
  const statusRow = topPad + block.length + 1;
  process.stdout.write("\x1b[?25l\x1b[2J\x1b[H");
  process.stdout.write("\n".repeat(topPad));
  for (const ln of block) process.stdout.write(ln + "\n");
  const setStatus = (txt, color, rowOff = 0) => {
    const pad = " ".repeat(Math.max(0, Math.floor((W - txt.length) / 2)));
    process.stdout.write(`\x1b[${statusRow + rowOff};1H\x1b[K` + pad + (color ? P[color] + txt + P.reset : txt));
  };
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const BAR_W = 26;
  const bar = (p) => "█".repeat(Math.round(p * BAR_W)) + "─".repeat(BAR_W - Math.round(p * BAR_W));
  // Phase 1 (2 s) : connexion au cloud VTH + barre de progression.
  const healthP = fetch(API + "/health", { signal: AbortSignal.timeout(5000) }).then((r) => r.ok).catch(() => false);
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 2000);
      const fi = Math.floor(Date.now() / 80) % frames.length;
      setStatus(`${frames[fi]} Connexion au cloud VTH  ${bar(p)}`, "lavender", 0);
      if (p >= 1) { clearInterval(iv); res(); }
    }, 50);
  });
  const cloudOk = await healthP;
  setStatus(cloudOk ? "✓ Connecté au cloud VTH" : "… Cloud injoignable — vérifie ta connexion", cloudOk ? "mint" : "peach", 0);
  // Phase 2 (2 s) : vérification des mises à jour.
  let latest = undefined, done = false;
  const t1 = Date.now();
  checkUpdate().then((v) => { latest = v; done = true; });
  await new Promise((res) => {
    const iv = setInterval(() => {
      if (done && Date.now() - t1 >= 2000) { clearInterval(iv); res(); return; }
      const fi = Math.floor(Date.now() / 80) % frames.length;
      setStatus(`${frames[fi]} Vérification des mises à jour…`, "lavender", 1);
    }, 80);
  });
  if (latest === undefined) setStatus("? Impossible de vérifier (hors ligne ?)", "peach", 1);
  else if (latest) setStatus(`↓ Mise à jour ${latest} disponible — tape /update dans le chat`, "lemon", 1);
  else setStatus(`✓ À jour (v${PKG.version})`, "mint", 1);
  await sleep(900);
  process.stdout.write("\x1b[?25h");
  return latest;
}

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
    { value: "aura-1.3", label: "Aura 1.3", desc: "14B • ~3 mots/s • coût x6 • flagship (10 Go RAM) • 🔒 dim. 18 oct. 17h" },
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

// ---------- Commandes slash (avec autocomplétion) ----------
const COMMANDS = [
  { name: "/new", desc: "Nouvelle conv" },
  { name: "/model", desc: "Voir / changer de modèle", values: ["aura-1.1", "aura-1.2", "aura-1.3", "aura-1.1-code"] },
  { name: "/effort", desc: "Voir / changer l'effort", values: ["low", "middle", "high", "xhigh"] },
  { name: "/lang", desc: "Langue des réponses", values: ["fr", "en"] },
  { name: "/theme", desc: "Thème de couleur", values: ["pastel", "sunset", "ocean", "mono", "opencode"] },
  { name: "/sessions", desc: "Panneau des conversations (F2)" },
  { name: "/account", desc: "Panneau du compte (F3)" },
  { name: "/retry", desc: "Relancer la dernière réponse" },
  { name: "/compact", desc: "Garder les N derniers blocs (/compact 20)" },
  { name: "/stats", desc: "Stats de la session" },
  { name: "/doctor", desc: "Diagnostic connexion / modèles" },
  { name: "/quota", desc: "Afficher ton quota global" },
  { name: "/image", desc: "Générer une image : /image <texte>" },
  { name: "/image13", desc: "Image flagship : /image13 <texte>" },
  { name: "/bash", desc: "Commande shell (confirmation)" },
  { name: "/read", desc: "Lire un fichier : /read <chemin>", files: true },
  { name: "/ls", desc: "Lister un dossier : /ls [dossier]", files: true },
  { name: "/write", desc: "Écrire un fichier : /write <chemin> … /end", files: true },
  { name: "/run", desc: "Exécuter le dernier bloc de code" },
  { name: "/undo", desc: "Annuler la dernière écriture" },
  { name: "/search", desc: "Chercher du texte : /search <motif>" },
  { name: "/open", desc: "Ouvrir fichier/dossier", files: true },
  { name: "/sysinfo", desc: "Infos du PC" },
  { name: "/copy", desc: "Copier une réponse : /copy [n]" },
  { name: "/export", desc: "Sauver en markdown : /export [fichier]" },
  { name: "/update", desc: "Mettre à jour AuraCode" },
  { name: "/uninstall", desc: "Désinstaller le programme" },
  { name: "/calc", desc: "Calculatrice : /calc (2+3)*4" },
  { name: "/meteo", desc: "Météo : /meteo [ville]" },
  { name: "/trad", desc: "Traduire : /trad fr en bonjour" },
  { name: "/timer", desc: "Minuteur : /timer 25m repos" },
  { name: "/stoptimer", desc: "Arrêter le minuteur" },
  { name: "/note", desc: "Noter vite : /note <texte>" },
  { name: "/notes", desc: "Voir les notes" },
  { name: "/unnote", desc: "Supprimer une note : /unnote <n>" },
  { name: "/todo", desc: "Tâche : /todo <texte>" },
  { name: "/todos", desc: "Voir les tâches" },
  { name: "/todook", desc: "Cocher : /todook <n>" },
  { name: "/tododel", desc: "Supprimer : /tododel <n>" },
  { name: "/models", desc: "Modèles du serveur" },
  { name: "/ping", desc: "Latence API" },
  { name: "/top", desc: "Gros fichiers du dossier" },
  { name: "/find", desc: "Chercher dans l'historique" },
  { name: "/whoami", desc: "Qui suis-je (compte)" },
  { name: "/banner", desc: "Logo AuraCode" },
  { name: "/de", desc: "Lancer un dé" },
  { name: "/piece", desc: "Pile ou face" },
  { name: "/bg", desc: "Tâche shell en fond : /bg <cmd>" },
  { name: "/jobs", desc: "Tâches de fond" },
  { name: "/fg", desc: "Voir sortie : /fg <id>" },
  { name: "/plan", desc: "Plan d'action : /plan <tâche>" },
  { name: "/go", desc: "Exécute l'étape suivante" },
  { name: "/goall", desc: "Exécute tout le plan" },
  { name: "/macro", desc: "Macros : /macro add <nom> <texte>" },
  { name: "/conv", desc: "Conversations serveur (modale)" },
  { name: "/review", desc: "Relit du code : /review [fichier]" },
  { name: "/persona", desc: "Instructions perso : /persona <texte>" },
  { name: "/compare", desc: "2 modèles, 1 question" },
  { name: "/head", desc: "Début de fichier : /head [n] <f>" },
  { name: "/tail", desc: "Fin de fichier : /tail [n] <f>" },
  { name: "/wc", desc: "Lignes/mots : /wc <f>" },
  { name: "/diff", desc: "Diff de 2 fichiers" },
  { name: "/env", desc: "Variables d'environnement" },
  { name: "/disk", desc: "Poids du dossier" },
  { name: "/count", desc: "Lignes de code par langage" },
  { name: "/tree", desc: "Arbre du dossier" },
  { name: "/recent", desc: "Fichiers récents" },
  { name: "/zip", desc: "Archive : /zip <src> [dest]" },
  { name: "/unzip", desc: "Extrait : /unzip <f> [dir]" },
  { name: "/serve", desc: "Serveur fichiers : /serve [port]" },
  { name: "/unserve", desc: "Coupe le serveur" },
  { name: "/explain", desc: "Explique du code : /explain [f]" },
  { name: "/test", desc: "Lance les tests du projet" },
  { name: "/git", desc: "État git" },
  { name: "/commit", desc: "Propose un message de commit" },
  { name: "/history", desc: "Historique des prompts" },
  { name: "/share", desc: "Partage la conversation (lien)" },
  { name: "/uptime", desc: "Durée session + versions" },
  { name: "/prompt", desc: "Voir le protocole envoyé" },
  { name: "/fix", desc: "Répare : session, update" },
  { name: "/date", desc: "Date et heure" },
  { name: "/uuid", desc: "UUID aléatoire" },
  { name: "/pass", desc: "Mot de passe sûr : /pass [n]" },
  { name: "/encode", desc: "Encode : /encode b64|url|hex <t>" },
  { name: "/decode", desc: "Décode : /decode b64|url|hex <t>" },
  { name: "/json", desc: "Valide/embellit du JSON" },
  { name: "/upper", desc: "MAJUSCULES" },
  { name: "/lower", desc: "minuscules" },
  { name: "/len", desc: "Taille d'un texte" },
  { name: "/slug", desc: "Slugifie : /slug <texte>" },
  { name: "/sort", desc: "Trie : /sort a,b,c" },
  { name: "/shuffle", desc: "Mélange : /shuffle a,b,c" },
  { name: "/cal", desc: "Calendrier du mois" },
  { name: "/chrono", desc: "Chronomètre" },
  { name: "/table", desc: "Tableau : /table a,b;c,d" },
  { name: "/tva", desc: "TTC : /tva <prix> [taux]" },
  { name: "/8ball", desc: "Boule magique" },
  { name: "/lorem", desc: "Faux texte : /lorem [n]" },
  { name: "/rainbow", desc: "Texte arc-en-ciel" },
  { name: "/cowsay", desc: "Vache qui parle" },
  { name: "/feux-artifice-test", desc: "Feux d'artifice (admin)" },
  { name: "/clear", desc: "Effacer l'écran" },
  { name: "/help", desc: "Aide" },
  { name: "/exit", desc: "Quitter" },
];

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
    this.quotaPct = 0;
    this.hist = loadJson(HIST_FILE, []);
    this.histIdx = -1;
    this.draft = "";
    this.modal = null;
    this.sidebar = false;
    this.sessionsCache = [];
    this.account = false;
    this.accountCache = {};
    this.pendingWrite = null;
    this.timer = null;
    this.celebrating = false;
    this.plan = null;
    this.jobs = [];
    this.jobSeq = 0;
    this.watchers = [];
    this.serve = null;
    this.servePort = 0;
    this.chronoT = null;
    this.lastPrompt = null;
    this.cancelled = false;
    this.abort = null;
    this.typingMsg = null;
    this.undoStack = [];
    this.permits = {};
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
      if (this.timer) { try { clearInterval(this.timer.iv); } catch { /* ignore */ } this.timer = null; }
      try { (this.watchers || []).forEach((w) => { try { w.watcher.close(); } catch { /* ignore */ } }); } catch { /* ignore */ }
      try { if (this.serve) this.serve.close(); } catch { /* ignore */ }
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
    this.lastTool = name;
    this.messages.push({ role: "tool", name: String(name), ok: !!ok, ms: ms == null ? null : ms, output: String(output || "").slice(0, 2000), time: timeStr() });
    if (this.messages.length > 300) this.messages.splice(0, this.messages.length - 300);
    this.render();
  }

  openModal(title, items, onPick, filterable = false) {
    this.modal = { title, items: items || [], sel: 0, onPick, filter: "", filterable: !!filterable };
    this.completion = null;
    this.render();
  }

  modalItems() {
    const m = this.modal;
    if (!m || !m.filterable || !m.filter) return (m && m.items) || [];
    const f = m.filter.toLowerCase();
    return m.items.filter((it) => String(it.label || "").toLowerCase().includes(f));
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
      const pct = Math.max(0, Math.min(100, Number(s.usage_percent) || 0));
      rows.push(`${mark}${i + 1} ${id} ${vbar(pct, 5)} ${String(s.model || "").slice(0, 8)}`.slice(0, sbW));
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

  confirm(q, allowAlways = false) {
    return new Promise((resolve) => {
      this.confirmState = { q: String(q), resolve, always: !!allowAlways };
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
      if (!sid) { this.quotaText = ""; this.quotaPct = 0; return; }
      const q = await api("/api/quota/" + sid, null, this.state.key, "GET");
      this.quotaText = `Tokens ${q.tokens_remaining}/${q.token_limit}`;
      this.quotaPct = Math.max(0, Math.min(100, Number(q.usage_percent) || 0));
    } catch { this.quotaText = ""; this.quotaPct = 0; }
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
      if (m.role === "art") {
        for (const wl of String(m.text || "").split("\n")) {
          const t = truncVis(wl, W - 2);
          const plain = stripAnsi(t);
          const pad = " ".repeat(Math.max(0, Math.floor((W - plain.length) / 2)));
          push(pad + plain, pad + gradText(plain));
        }
        push("", "");
        continue;
      }
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
        const nOut = String(m.output || "").split("\n").length;
        push("", ` ${icol}⏺ ${P.reset + P.bold + P.aqua}${m.name}${P.reset + icol} ${icon}${m.ms != null ? ` ${m.ms.toFixed(1)}s` : ""} ${P.dim}· ${nOut}l${P.reset}`);
        const outs = String(m.output || "").split("\n").slice(0, 12);
        for (const ol of outs) {
          const t = ol.slice(0, Math.max(20, W - 12));
          push("  " + t, P.dim + "  ⎿ " + P.reset + P.dim + t + P.reset);
        }
        const rest = String(m.output || "").split("\n").length - outs.length;
        if (rest > 0) push("", P.dim + `  ⎿ … +${rest} lignes` + P.reset);
        push("", "");
        continue;
      }
      const mine = m.role === "user";
      const nameColor = mine ? P.sky : P.mint;
      const border = mine ? P.pink : P.mint;
      const segParts = [];
      if (!mine) {
        const re = /```(\w*)\n([\s\S]*?)```/g;
        let last = 0, mm;
        let hasCode = false;
        while ((mm = re.exec(m.text || ""))) {
          hasCode = true;
          if (mm.index > last) segParts.push({ t: "text", s: m.text.slice(last, mm.index) });
          segParts.push({ t: "code", lang: (mm[1] || "").toLowerCase(), s: mm[2].replace(/\n$/, "") });
          last = mm.index + mm[0].length;
        }
        if (hasCode && last < (m.text || "").length) segParts.push({ t: "text", s: m.text.slice(last) });
      }
      if (!segParts.length) segParts.push({ t: "text", s: m.text });
      const wrapped = [];
      for (const sg of segParts) {
        if (sg.t === "code") {
          wrapped.push({ fence: true, lang: sg.lang, line: "" });
          for (const wl of wrapText(sg.s, innerW)) wrapped.push({ fence: true, lang: sg.lang, line: wl });
          wrapped.push({ fence: true, lang: sg.lang, line: null });
        } else {
          for (const wl of wrapText(sg.s, innerW)) wrapped.push({ fence: false, line: wl });
        }
      }
      if (!wrapped.length) wrapped.push({ fence: false, line: "" });
      const bw = Math.min(innerW, Math.max(...wrapped.map((l) => (l.line || "").length)));
      const padEnd = (s) => s + " ".repeat(Math.max(0, bw - s.length));
      const top = "╭" + "─".repeat(bw + 2) + "╮";
      const bot = "╰" + "─".repeat(bw + 2) + "╯";
      const headPlain = `${mine ? "Toi" : "Aura"} • ${m.time || ""}`;
      const headOut = nameColor + P.bold + (mine ? "Toi" : "Aura") + P.reset + P.dim + ` • ${m.time || ""}` + P.reset;
      const rowsV = [headPlain, top];
      const fmt = (wl) => (m.role === "assistant" ? mdInline(wl) : wl);
      const rowsO = [headOut, border + top + P.reset];
      for (const w of wrapped) {
        if (w.fence && w.line === "") {
          const lbl = "◈ " + (w.lang || "code");
          rowsV.push(`│ ${padEnd(lbl)} │`);
          rowsO.push(border + "│ " + P.reset + P.bold + P.lavender + padEnd(lbl) + P.reset + border + " │" + P.reset);
        } else if (w.fence && w.line === null) {
          rowsV.push(bot);
          rowsO.push(border + bot + P.reset);
        } else if (w.fence) {
          rowsV.push(`│ ${padEnd(w.line)} │`);
          rowsO.push(border + "│ " + P.reset + P.lemon + padEnd(w.line) + P.reset + border + " │" + P.reset);
        } else {
          const wl = w.line;
          rowsV.push(`│ ${padEnd(wl)} │`);
          rowsO.push(border + "│ " + P.reset + fmt(padEnd(wl)) + border + " │" + P.reset);
        }
      }
      rowsV.push(bot, "");
      rowsO.push(border + bot + P.reset, "");
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

    if (!this.messages.length && !this.modal) {
      const wRow = [
        P.bold + gradText("◤  A U R A C O D E"),
        P.sky + "L'IA qui pilote ton PC" + P.reset,
        "",
        `Tape ton message + ${kbd("Entrée")}  •  ${kbd("/")} commandes  •  ${kbd("Ctrl+P")} palette`,
        `${kbd("@fichier")} joint un fichier  •  ${kbd("F1")} aide  •  ${kbd("F2")} sessions`,
        "",
        P.dim + `${this.state.model} • ${this.state.effort} • ${this.state.lang || "fr"}` + P.reset,
      ];
      const ws = Math.max(0, Math.floor((viewH - wRow.length) / 2));
      wRow.forEach((r, i) => {
        const plain = stripAnsi(r);
        const left = " ".repeat(Math.max(0, Math.floor((W - plain.length) / 2)));
        const idx = ws + i;
        if (idx < visible.length) visible[idx] = { vis: "", out: left + r };
      });
    }

    if (this.modal) {
      const mw = Math.min(62, W - 4);
      const iw = mw - 4;
      const fit = (s) => String(s).slice(0, iw) + " ".repeat(Math.max(0, iw - Math.min(String(s).length, iw)));
      const mRows = [];
      mRows.push(P.dim + "╭" + "─".repeat(mw - 2) + "╮" + P.reset);
      mRows.push(P.dim + "│ " + P.reset + P.bold + P.pink + fit("◆ " + this.modal.title) + P.reset + P.dim + " │" + P.reset);
      mRows.push(P.dim + "├" + "─".repeat(mw - 2) + "┤" + P.reset);
      const list = this.modalItems();
      const mItems = list.slice(0, Math.max(1, viewH - 6));
      mItems.forEach((it, i) => {
        const txt = ((i === this.modal.sel ? "❯ " : "  ") + (it.label || "")).slice(0, iw);
        const colored = i === this.modal.sel
          ? P.bold + P.pink + "❯ " + P.reset + P.lemon + txt.slice(2) + P.reset
          : P.dim + txt + P.reset;
        mRows.push(P.dim + "│ " + P.reset + colored + " ".repeat(Math.max(0, iw - Math.min(txt.length, iw))) + P.dim + " │" + P.reset);
      });
      const fpieces = [`${kbd("↑↓")} choisir`, `${kbd("Entrée")} valider`, `${kbd("Échap")} fermer`];
      if (this.modal.filterable) fpieces.push(this.modal.filter ? `filtre : ${this.modal.filter}` : "taper pour filtrer");
      const foot = fpieces.join("   ");
      const footPlain = stripAnsi(foot);
      const footPad = Math.max(0, Math.floor((iw - footPlain.length) / 2));
      mRows.push(P.dim + "├" + "─".repeat(mw - 2) + "┤" + P.reset);
      mRows.push(P.dim + "│ " + P.reset + " ".repeat(footPad) + foot + " ".repeat(Math.max(0, iw - footPlain.length - footPad)) + P.dim + " │" + P.reset);
      mRows.push(P.dim + "╰" + "─".repeat(mw - 2) + "╯" + P.reset);
      const mStart = Math.max(0, Math.floor((viewH - mRows.length) / 2));
      const mLeft = " ".repeat(Math.max(0, Math.floor((W - mw) / 2)));
      mRows.forEach((r, i) => {
        const idx = mStart + i;
        if (idx < visible.length) visible[idx] = { vis: "", out: mLeft + r + P.dim + "░░" + P.reset };
      });
      if (mStart + mRows.length < visible.length) {
        visible[mStart + mRows.length] = { vis: "", out: mLeft + " " + P.dim + "░".repeat(mw) + P.reset };
      }
    }

    const HB = "\x1b[48;2;38;36;34m";
    const HF = "\x1b[38;2;216;210;196m";
    const sid8 = (getSessionId() || "").slice(0, 8);
    let mid = `${sid8 ? sid8 + "  " : ""}${this.state.model} • ${this.state.effort}`;
    const barV = this.quotaPct > 0 ? vbar(this.quotaPct, 8).split(P.reset).join(P.reset + HB + HF) : "";
    let right = ((this.quotaText || "") + (barV ? " " + stripAnsi(barV) : "")).trim();
    let maxMid = W - 11 - 3 - right.length - 1;
    if (maxMid < 8) { right = this.quotaText || ""; maxMid = W - 11 - 3 - right.length - 1; }
    if (maxMid < 8) { right = ""; maxMid = W - 11 - 3 - 1; }
    mid = mid.slice(0, Math.max(8, maxMid));
    const padN = Math.max(0, W - 11 - 3 - mid.length - right.length);
    let header =
      HB + HF + " " + P.bold + P.pink + "◤ auracode" + P.reset + HB + HF + " " + P.dim + "│" + P.reset + HB + HF + " " +
      P.lavender + mid + P.reset + HB + HF +
      " ".repeat(padN) +
      P.mint + (this.quotaText || "") + P.reset + HB + HF + (barV ? " " + barV : "");
    const hv = stripAnsi(header).length;
    header = (hv < W ? header + HB + HF + " ".repeat(W - hv) : truncVis(header, W)) + P.reset;

    let out = "\x1b[?25l\x1b[H";
    out += header + "\x1b[K\n";
    const sb = !this.modal ? (this.sidebar ? this.sidebarRows(viewH) : this.account ? this.accountRows(viewH) : null) : null;
    const msgW = sb ? W - sb.sbW - 1 : W;
    const showBar = !sb && !this.modal && maxScroll > 0;
    const thumbAt = showBar ? Math.round((1 - this.scroll / Math.max(1, maxScroll)) * (viewH - 1)) : -1;
    visible.forEach((l, i) => {
      let row = l ? l.out : "";
      if (sb) {
        const cut = truncVis(row, msgW);
        const vlen = Math.min(stripAnsi(row).length, msgW);
        row = cut + " ".repeat(Math.max(0, msgW - vlen)) + P.dim + "▏" + P.reset + (sb.rows[i] || "");
      } else if (showBar) {
        const cut = truncVis(row, W - 1);
        const vlen = Math.min(stripAnsi(row).length, W - 1);
        row = cut + " ".repeat(Math.max(0, W - 1 - vlen)) + (i === thumbAt ? P.lavender + "█" + P.reset : P.dim + "│" + P.reset);
      }
      out += row + "\x1b[K\n";
    });
    compItems.forEach((it, i) => {
      const sel = i === this.completion.sel;
      out += (sel ? P.bold + P.pink + "> " + P.lemon + it.display + P.reset : P.dim + "  " + it.display + P.reset) + "\x1b[K\n";
    });

    let cursorCol = -1, cursorRowOff = 0;
    if (this.confirmState) {
      const q = (`? ${this.confirmState.q}`).slice(0, W - 12);
      const chips = this.confirmState.always ? " " + kbd("o") + " " + kbd("t") + " " + kbd("N") : " " + kbd("o") + " " + kbd("N");
      const chipLen = this.confirmState.always ? 12 : 8;
      out += "│ " + P.lemon + q + P.reset + chips + " ".repeat(Math.max(0, W - 4 - q.length - chipLen)) + " │" + "\x1b[K\n";
    } else {
      const inLen = this.input.length;
      let boxTitle = `─ Écris ton message… (${inLen}) ── Ctrl+J ligne, @fichier `;
      let boxTitleOut = `${P.dim}─ Écris ton message… ${P.reset + P.lavender}(${inLen})${P.reset + P.dim} ── Ctrl+J ligne, @fichier `;
      if (inR.rows.length > inR.shown.length) {
        boxTitle = `─ ↑↓ ${inR.start + 1}-${inR.start + inR.shown.length}/${inR.rows.length} ─ `;
        boxTitleOut = P.dim + boxTitle;
      }
      out += P.dim + "╭" + boxTitleOut + "─".repeat(Math.max(0, W - 2 - boxTitle.length)) + "╮" + P.reset + "\x1b[K\n";
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
      sL = `✻ Réflexion… ${this.thinkSec.toFixed(0)}s${this.lastTool ? ` · ${this.lastTool}` : ""} (Échap = stop)`;
    } else if (this.busy) {
      sL = "Travail en cours... (Échap = stop)";
    } else if (this.typeTimer) {
      sL = "Aura écrit" + "●".repeat(1 + (Math.floor(Date.now() / 400) % 3));
    } else {
      sL = `${this.state.model} • ${this.state.effort} • ${this.state.lang || "fr"}`;
    }
    const rParts = [];
    if (this.timer) {
      const left = Math.max(0, this.timer.until - Date.now());
      const mm = String(Math.floor(left / 60000)).padStart(2, "0");
      const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
      rParts.push(`⏱ ${mm}:${ss} ${this.timer.label}`);
    }
    if (this.serve) rParts.push(`srv:${this.servePort}`);
    let tokSum = 0;
    for (const m of this.messages) {
      if (m.meta && m.meta.tok) tokSum += m.meta.tok;
      else if (m.role === "user" || m.role === "assistant") tokSum += Math.round(String(m.text || "").length / 4);
    }
    if (tokSum > 0) rParts.push(`~${tokSum >= 1000 ? (tokSum / 1000).toFixed(1) + "k" : tokSum} tok`);
    rParts.push(this.quotaText, br ? `⎇ ${br}` : "", cwd);
    sR = rParts.filter(Boolean).join(" • ");
    if (this.scroll > 0) sR += (sR ? " • " : "") + "PgDn : bas";
    if (this.updateAvailable && !this.busy) sR += (sR ? " • " : "") + "Tape /update";
    let sLine = sL;
    if (sR) sLine += " ".repeat(Math.max(1, W - stripAnsi(sL).length - stripAnsi(sR).length)) + sR;
    if (stripAnsi(sLine).length > W) sLine = truncVis(sLine, W);
    const thinking = this.busy && this.thinkSec !== null && this.thinkSec !== undefined;
    out += HB + (thinking ? P.lavender : HF) + sLine + P.reset;
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
      if (cmd && cmd.files) {
        const frag = m2[2].toLowerCase();
        const items = scanFiles()
          .filter((f) => f.toLowerCase().includes(frag))
          .slice(0, 8)
          .map((f) => ({ insert: `/${m2[1]} ${f}`, display: f }));
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
    let line = this.input.trim();
    if (line.startsWith("!")) {
      const sp = line.indexOf(" ");
      const name = sp < 0 ? line.slice(1) : line.slice(1, sp);
      const rest = sp < 0 ? "" : line.slice(sp + 1);
      const hit = loadList(MACROS_FILE).find((x) => x.name === name);
      if (!hit) {
        this.sys(`Macro inconnue : ${name} (/macro pour la liste)`);
        this.completion = null; this.input = ""; this.cursor = 0; this.histIdx = -1;
        this.render();
        return;
      }
      line = (hit.text + " " + rest).trim();
    }
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
    if (this.celebrating) { this.celebrating = false; return; }
    if (this.modal) {
      const list = this.modalItems();
      const n = list.length || 1;
      if (key.name === "up") { this.modal.sel = (this.modal.sel - 1 + n) % n; this.render(); return; }
      if (key.name === "down") { this.modal.sel = (this.modal.sel + 1) % n; this.render(); return; }
      if (key.name === "return" || key.name === "tab") {
        const it = list[Math.min(this.modal.sel, list.length - 1)];
        const cb = this.modal.onPick;
        this.modal = null;
        if (cb) cb(it ? it.value : null);
        else this.render();
        return;
      }
      if (key.name === "escape") {
        if (this.modal.filter) { this.modal.filter = ""; this.modal.sel = 0; this.render(); return; }
        const cb = this.modal.onPick;
        this.modal = null;
        if (cb) cb(null);
        else this.render();
        return;
      }
      if (this.modal.filterable && str && str.length === 1 && !key.ctrl && !key.meta && str >= " ") {
        this.modal.filter += str;
        this.modal.sel = 0;
        this.render();
        return;
      }
      if (this.modal.filterable && key.name === "backspace" && this.modal.filter) {
        this.modal.filter = this.modal.filter.slice(0, -1);
        this.modal.sel = 0;
        this.render();
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
      else if (c === "t" && this.confirmState.always) this.resolveConfirm("always");
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
// cli/src/main.js — commandes CLI, runTUI, boucle principale.
// Bundlé : symboles partagés fournis par shared/backend/ui (même portée finale).

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
      const MODELS = ["aura-1.1", "aura-1.2", "aura-1.3", "aura-1.1-code"];
      const EFFORTS = ["low", "middle", "high", "xhigh"];
      const LANGS = ["fr", "en"];
      const saveCfg = () => saveJson(CONFIG_FILE, {
        model: state.model, effort: state.effort,
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
          if (arg === "aura-1.3" && aura13Locked()) {
            screen.sys(`🔒 Aura 1.3 dans ${aura13Countdown()} (${AURA13_LAUNCH_LABEL})`);
            screen.sys("Ouverture de la page d'attente...");
            openBrowser(AURA13_WAIT_URL);
            screen.render();
            return;
          }
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
        case "image13": {
          if (!arg) { screen.sys("Usage : /image13 <description>  (Aura 1.3 Image, grand format)"); return; }
          if (aura13Locked()) {
            screen.sys(`🔒 Aura 1.3 Image dans ${aura13Countdown()} (${AURA13_LAUNCH_LABEL})`);
            openBrowser(AURA13_WAIT_URL);
            screen.render();
            return;
          }
          let sid = getSessionId();
          screen.busy = true;
          try {
            if (!sid) sid = await newSession(state.key, state.model);
            screen.sys("Génération de l'image 1.3 (grand format, coût x3)...");
            const d = await api("/api/image", { prompt: arg, session_id: sid, model: "aura-1.3-image" }, state.key);
            screen.assistant(`![image](${d.image_url})`);
            await screen.refreshQuota();
          } catch (e) {
            const ed = e.data || {};
            if (/aura 1\.3/i.test(String(ed.error || ""))) {
              screen.sys(`🔒 Aura 1.3 Image dans ${aura13Countdown()} (${AURA13_LAUNCH_LABEL})`);
              openBrowser(AURA13_WAIT_URL);
            } else screen.sys("Erreur : " + e.message);
          }
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
          const parts = (arg || "").split(/\s+/).filter(Boolean);
          let fmt = "md";
          if (parts.length && ["md", "html", "txt"].includes(parts[0].toLowerCase())) fmt = parts.shift().toLowerCase();
          const fname = parts.join(" ") || `aura-export.${fmt}`;
          const body = fmt === "html" ? exportHtml(screen.messages) : fmt === "txt" ? exportTxt(screen.messages) : "# Conversation AuraCode\n\n" + screen.messages.map((m) =>
            m.role === "user" ? `**Toi :** ${m.text}` : m.role === "assistant" ? `**Aura :** ${m.text}` : m.role === "tool" ? `⚙ ${m.name} : ${(m.output || "").slice(0, 500)}` : `_${m.text}_`
          ).join("\n\n");
          try {
            const fp = path.resolve(process.cwd(), fname);
            fs.writeFileSync(fp, body);
            screen.sys("Exporté : " + fp);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "theme": {
          const names = Object.keys(THEMES);
          if (arg === "surprise") {
            const pool = names.filter((n) => n !== (state.theme || "pastel"));
            const pick = pool[Math.floor(Math.random() * pool.length)];
            Object.assign(P, THEMES[pick]);
            state.theme = pick;
            saveCfg();
            screen.sys("Thème surprise : " + pick);
            screen.render();
            return;
          }
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
          const parts = String(arg || "").split(/\s+/).filter(Boolean);
          const resume = parts.includes("resume");
          const nn = parseInt(parts.find((p) => /^\d+$/.test(p)) || "", 10);
          const n = Math.max(2, Math.min(100, nn || 20));
          if (screen.messages.length <= n) { screen.sys("Rien à compacter."); return; }
          if (resume) {
            const dropped = screen.messages.splice(0, screen.messages.length - n);
            let sid = getSessionId();
            screen.busy = true; screen.render();
            try {
              if (!sid) sid = await newSession(state.key, state.model);
              const d = await api("/api/chat", {
                message: "Résume cette conversation en 8 lignes max (faits + décisions, style télégraphique). Réponds QUE le résumé :",
                session_id: sid, model: "aura-1.1", effort: "low",
                history: dropped.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.text || m.output || "").slice(0, 600) })),
              }, state.key);
              screen.messages.unshift({ role: "system", text: "📌 Mémoire : " + String(d.reply || "").trim().slice(0, 1200) });
              screen.sys(`Compacté + résumé (${dropped.length} blocs → mémoire).`);
            } catch (e) {
              screen.sys("Résumé impossible (" + e.message + "), compactage simple.");
            }
            screen.busy = false;
            await screen.refreshQuota();
            screen.render();
            return;
          }
          screen.messages.splice(0, screen.messages.length - n);
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
          screen.sys(`Build : ${buildId()} (vérifie quel code tourne vraiment)`);
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
            screen.tool("write " + pw.path, true, null, (existed ? paintDiff(diffLines(prev, content)).split("\n").slice(0, 10).join("\n") + "\n" : "") + `${content.length} caractères écrits (/undo pour annuler)`);
          } catch (e) { screen.tool("write " + pw.path, false, null, e.message); }
          return;
        }
        case "run": {
          const blk = findCodeBlock(screen);
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
              confirm: (q, always) => screen.confirm(q, always),
      permitted: (n) => !!(screen.permits || {})[n],
      permit: (n) => { screen.permits = screen.permits || {}; screen.permits[n] = true; },
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
          const info = detectInstall();
          const plan = uninstallPlan(info);
          screen.sys("Désinstallation (" + info.kind + (info.dir ? " : " + info.dir : "") + ").");
          plan.removePaths.forEach((p) => screen.sys("  Supprimé : " + p));
          if (!(await screen.confirm("Désinstaller AuraCode ?"))) { screen.sys("Annulé."); return; }
          const wipe = await screen.confirm("Supprimer aussi ~/.auracode (réglages, historique) ?");
          if (info.kind === "npm") {
            screen.busy = true; screen.sys("npm rm -g auracode ..."); screen.render();
            const nr = npmRmGlobal();
            screen.sys(nr.msg);
            screen.busy = false; screen.render();
          }
          if (process.platform !== "win32") {
            for (const p of plan.removePaths) { try { fs.rmSync(p, { recursive: true, force: true }); screen.sys("OK : " + p); } catch (e) { screen.sys("ECHEC : " + p); } }
            screen.sys("(pense à retirer les dossiers AuraCode de ton PATH shell)");
            if (wipe) { try { fs.rmSync(HOME, { recursive: true, force: true }); screen.sys("Données supprimées."); } catch (e) { screen.sys("Données : " + e.message); } }
            screen.sys("Désinstallé. Quitte et vérifie dans un nouveau terminal.");
            screen.render();
            return;
          }
          const logFile = path.join(os.tmpdir(), "auracode-uninstall-" + process.pid + ".log");
          const ps1 = buildUninstallerPs({ pid: process.pid, removePaths: plan.removePaths, rmdirParents: plan.rmdirParents, pathStrip: plan.pathStrip, wipeData: wipe, homeDir: HOME, logFile });
          const file = path.join(os.tmpdir(), "auracode-uninstall-" + process.pid + ".ps1");
          fs.writeFileSync(file, ps1);
          const { spawn } = require("child_process");
          spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", file], { detached: true, stdio: "ignore" }).unref();
          screen.sys("Désinstallé. Fermeture... (log : " + logFile + ")");
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
        case "calc": {
          if (!arg) { screen.sys("Usage : /calc <expression>  (ex : /calc (2+3)*4, sqrt(16))"); return; }
          try {
            const v = calcExpr(arg);
            screen.tool("calc", true, null, `${arg} = ${Math.round(v * 1e6) / 1e6}`);
          } catch (e) { screen.tool("calc", false, null, e.message); }
          return;
        }
        case "meteo": {
          const city = arg || "Paris";
          screen.busy = true; screen.render();
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 10000);
            const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3&lang=fr`, { signal: ctrl.signal, headers: { "User-Agent": "auracode" } });
            clearTimeout(t);
            const txt = (await r.text()).trim();
            if (!r.ok || !txt) throw new Error("météo indisponible");
            screen.tool("météo " + city, true, null, txt);
          } catch (e) { screen.tool("météo", false, null, e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "trad": {
          const parts = arg.split(/\s+/).filter(Boolean);
          if (parts.length < 3) { screen.sys("Usage : /trad <src> <dst> <texte>  (ex : /trad fr en bonjour)"); return; }
          const src = parts[0], dst = parts[1], text = parts.slice(2).join(" ");
          screen.busy = true; screen.render();
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 10000);
            const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(src)}|${encodeURIComponent(dst)}`, { signal: ctrl.signal, headers: { "User-Agent": "auracode" } });
            clearTimeout(t);
            const j = await r.json().catch(() => ({}));
            const out = (j.responseData && j.responseData.translatedText) || "";
            if (!r.ok || !out) throw new Error((j.responseStatus && String(j.responseStatus)) || "traduction impossible");
            screen.tool(`trad ${src}→${dst}`, true, null, out);
          } catch (e) { screen.tool("trad", false, null, e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "timer": {
          if (!arg) { screen.sys("Usage : /timer <durée> [label]  (ex : /timer 25m repos)"); return; }
          const [d, ...rest] = arg.split(/\s+/);
          try {
            startTimer(screen, parseDur(d), rest.join(" ") || "minuteur");
            screen.sys("Minuteur lancé.");
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "stoptimer": stopTimer(screen); return;
        case "note": {
          if (!arg) { screen.sys("Usage : /note <texte>"); return; }
          const arr = loadList(NOTES_FILE);
          arr.push({ t: Date.now(), text: arg });
          saveList(NOTES_FILE, arr);
          screen.sys(`Noté (#${arr.length}).`);
          return;
        }
        case "notes": {
          const arr = loadList(NOTES_FILE);
          if (!arr.length) { screen.sys("Aucune note. /note <texte> pour ajouter."); return; }
          const rows = [`🗒 Notes (${arr.length})`, ...arr.slice(-10).map((n, i) => `  ${i + 1}. ${String(n.text).slice(0, 60)}`)];
          screen.tool("notes", true, null, rows.join("\n"));
          return;
        }
        case "unnote": {
          const n = parseInt(arg, 10);
          const arr = loadList(NOTES_FILE);
          if (!n || n < 1 || n > arr.length) { screen.sys("Usage : /unnote <numéro> (voir /notes)"); return; }
          const gone = arr.splice(n - 1, 1)[0];
          saveList(NOTES_FILE, arr);
          screen.sys("Supprimé : " + String(gone.text).slice(0, 80));
          return;
        }
        case "todo": {
          if (!arg) { screen.sys("Usage : /todo <texte>"); return; }
          const arr = loadList(TODOS_FILE);
          arr.push({ t: Date.now(), text: arg, done: false });
          saveList(TODOS_FILE, arr);
          screen.sys(`À faire (#${arr.length}).`);
          return;
        }
        case "todos": {
          const arr = loadList(TODOS_FILE);
          if (!arr.length) { screen.sys("Rien à faire. /todo <texte> pour ajouter."); return; }
          const rows = [`☑ Todos (${arr.filter((x) => x.done).length}/${arr.length})`];
          arr.slice(-10).forEach((x, i) => rows.push(`  ${x.done ? "☑" : "☐"} ${i + 1}. ${String(x.text).slice(0, 55)}`));
          screen.tool("todos", true, null, rows.join("\n"));
          return;
        }
        case "todook": {
          const n = parseInt(arg, 10);
          const arr = loadList(TODOS_FILE);
          if (!n || n < 1 || n > arr.length) { screen.sys("Usage : /todook <numéro>"); return; }
          arr[n - 1].done = true;
          saveList(TODOS_FILE, arr);
          screen.sys("Fait ✓ (#" + n + ").");
          return;
        }
        case "tododel": {
          const n = parseInt(arg, 10);
          const arr = loadList(TODOS_FILE);
          if (!n || n < 1 || n > arr.length) { screen.sys("Usage : /tododel <numéro>"); return; }
          const gone = arr.splice(n - 1, 1)[0];
          saveList(TODOS_FILE, arr);
          screen.sys("Supprimé : " + String(gone.text).slice(0, 80));
          return;
        }
        case "models": {
          try {
            const d = await api("/api/models", null, state.key, "GET");
            const arr = Array.isArray(d) ? d : d.models || [];
            screen.tool("modèles", true, null, arr.map((m) => `${m.id || m} — ${m.name || ""}${m.loaded === false ? " (absent)" : ""}`.trim()).join("\n") || "Aucun.");
          } catch (e) { screen.tool("modèles", false, null, e.message); }
          return;
        }
        case "ping": {
          try {
            const t0 = Date.now();
            const st = await fetch(API + "/health").then((r) => r.status).catch(() => 0);
            screen.sys(`API : HTTP ${st} en ${Date.now() - t0} ms`);
          } catch (e) { screen.sys("Ping impossible : " + e.message); }
          return;
        }
        case "top": {
          const n = Math.max(1, Math.min(20, parseInt(arg, 10) || 10));
          const files = topFiles(process.cwd(), n);
          screen.tool("top", true, null, files.map((f) => `${fmtSize(f.size)}  ${f.name}`).join("\n") || "(vide)");
          return;
        }
        case "find": {
          if (!arg) { screen.sys("Usage : /find <mot>"); return; }
          const hits = findMatches(screen.messages, arg);
          if (!hits.length) { screen.sys(`Aucun résultat pour « ${arg} ».`); return; }
          screen.sys(`${hits.length} résultat(s) :`);
          hits.slice(-10).forEach((h) => screen.sys(`  #${h.i} [${h.role}] …${h.snippet}…`));
          return;
        }
        case "whoami": {
          try {
            const me = await api("/api/me", null, state.key, "GET");
            screen.sys(`Toi : ${String(me.user_id || "?").slice(0, 20)} • ${me.sessions || 0} conv • ${me.messages_used || 0} msgs`);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "banner": {
          screen.messages.push({ role: "art", text: ART_LINES.join("\n"), time: timeStr() });
          if (screen.messages.length > 300) screen.messages.splice(0, screen.messages.length - 300);
          screen.sys(`v${PKG.version} — Aura by VTH Group`);
          screen.render();
          return;
        }
        case "de": {
          const f = Math.max(2, parseInt(arg, 10) || 6);
          screen.sys(`🎲 ${1 + Math.floor(Math.random() * f)} (d${f})`);
          return;
        }
        case "piece": {
          screen.sys(`🪙 ${Math.random() < 0.5 ? "Pile" : "Face"}`);
          return;
        }
        case "head":
        case "tail": {
          const parts = arg.split(/\s+/).filter(Boolean);
          let n = 20, p = "";
          if (parts.length && /^\d+$/.test(parts[0])) { n = Math.max(1, Math.min(200, parseInt(parts[0], 10))); p = parts.slice(1).join(" "); }
          else p = arg;
          if (!p) { screen.sys(`Usage : /${cmd} [n] <fichier>`); return; }
          try {
            const lines = fs.readFileSync(inside(p), "utf8").split("\n");
            const sel = cmd === "head" ? lines.slice(0, n) : lines.slice(-n);
            screen.tool(`${cmd} ${p}`, true, null, sel.join("\n").slice(0, 4000));
          } catch (e) { screen.tool(cmd, false, null, e.message); }
          return;
        }
        case "wc": {
          if (!arg) { screen.sys("Usage : /wc <fichier>"); return; }
          try {
            const c = fs.readFileSync(inside(arg), "utf8");
            const words = (c.match(/\S+/g) || []).length;
            screen.sys(`${arg} : ${c ? c.split("\n").length : 0} lignes • ${words} mots • ${c.length} caractères`);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "diff": {
          const parts = arg.split(/\s+/).filter(Boolean);
          if (parts.length < 2) { screen.sys("Usage : /diff <fichier1> <fichier2>"); return; }
          try {
            const a = fs.readFileSync(inside(parts[0]), "utf8");
            const b = fs.readFileSync(inside(parts.slice(1).join(" ")), "utf8");
            screen.tool("diff", true, null, paintDiff(diffLines(a, b)));
          } catch (e) { screen.tool("diff", false, null, e.message); }
          return;
        }
        case "env": {
          const rows = Object.keys(process.env).sort()
            .filter((k) => !/^(PATH|Path)$/.test(k)).slice(0, 60)
            .map((k) => /KEY|TOKEN|SECRET|PASS|PWD|AUTH/i.test(k) ? `${k}=***` : `${k}=${String(process.env[k]).slice(0, 80)}`);
          screen.tool("env", true, null, rows.join("\n"));
          return;
        }
        case "disk": {
          const u = diskUsage(process.cwd());
          screen.sys(`Dossier : ${fmtSize(u.bytes)} • ${u.files} fichiers${u.capped ? " (plafonné)" : ""}`);
          return;
        }
        case "count": {
          const rows = countLoc(process.cwd());
          if (!rows.length) { screen.sys("Aucun code détecté."); return; }
          screen.tool("loc", true, null, rows.map(([ext, s]) => `${ext} — ${s.files} fichiers, ${s.lines} lignes`).join("\n"));
          return;
        }
        case "tree": {
          const depth = Math.max(1, Math.min(6, parseInt(arg, 10) || 3));
          screen.tool("tree", true, null, treeStr(process.cwd(), depth) || "(vide)");
          return;
        }
        case "recent": {
          const n = Math.max(1, Math.min(20, parseInt(arg, 10) || 10));
          const all = [];
          const walk = (d, depth) => {
            if (depth > 4 || all.length > 500) return;
            let entries = [];
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const e of entries) {
              if (e.name === "node_modules" || e.name === ".git") continue;
              const full = path.join(d, e.name);
              try {
                const st = fs.statSync(full);
                if (st.isDirectory()) walk(full, depth + 1);
                else if (st.isFile()) all.push({ p: path.relative(process.cwd(), full), m: st.mtimeMs });
              } catch { /* ignore */ }
            }
          };
          walk(process.cwd(), 0);
          all.sort((a, b) => b.m - a.m);
          screen.tool("recent", true, null, all.slice(0, n).map((f) => `${new Date(f.m).toLocaleString("fr-FR")}  ${f.p}`).join("\n") || "(vide)");
          return;
        }
        case "zip": {
          const parts = arg.split(/\s+/).filter(Boolean);
          if (!parts.length) { screen.sys("Usage : /zip <dossier|fichier> [archive.zip]"); return; }
          const src = inside(parts[0]);
          const dest = parts[1] ? path.resolve(process.cwd(), parts[1]) : src + ".zip";
          screen.busy = true; screen.render();
          try {
            if (process.platform === "win32") execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${src.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`, { timeout: 60000 });
            else execSync(`zip -qr "${dest.replace(/"/g, '\\"')}" "${src.replace(/"/g, '\\"')}"`, { timeout: 60000 });
            screen.sys("Archivé : " + dest);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "unzip": {
          const parts = arg.split(/\s+/).filter(Boolean);
          if (!parts.length) { screen.sys("Usage : /unzip <archive> [dossier]"); return; }
          const src = inside(parts[0]);
          const dest = parts[1] ? path.resolve(process.cwd(), parts[1]) : process.cwd();
          try {
            if (process.platform === "win32") execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${src.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`, { timeout: 60000 });
            else execSync(`unzip -oq "${src.replace(/"/g, '\\"')}" -d "${dest.replace(/"/g, '\\"')}"`, { timeout: 60000 });
            screen.sys("Extrait vers : " + dest);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "serve": {
          if (screen.serve) { screen.sys(`Déjà en ligne : http://127.0.0.1:${screen.servePort}/ (/unserve)`); return; }
          const parts = arg.split(/\s+/).filter(Boolean);
          const port = Math.max(1024, Math.min(9999, parseInt(parts[0], 10) || 8080));
          const root = parts[1] ? inside(parts[1]) : process.cwd();
          const http = require("http");
          const srv = http.createServer((req, res) => {
            try {
              const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
              const fp = path.resolve(root, "." + urlPath);
              if (!fp.startsWith(root)) { res.writeHead(403); res.end("?"); return; }
              const st = fs.statSync(fp);
              if (st.isDirectory()) {
                const items = fs.readdirSync(fp).map((e) => `<li><a href="${path.posix.join(urlPath, e)}">${escapeHtml(e)}</a></li>`).join("");
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`<ul>${items}</ul>`);
                return;
              }
              res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
              fs.createReadStream(fp).pipe(res);
            } catch { try { res.writeHead(404); res.end("?"); } catch { /* ignore */ } }
          });
          srv.listen(port, "127.0.0.1", () => {
            screen.serve = srv; screen.servePort = port;
            screen.sys(`Servi : http://127.0.0.1:${port}/ ← ${root} (/unserve pour couper)`);
            screen.render();
          });
          srv.on("error", (e) => screen.sys("Serveur impossible : " + e.message));
          return;
        }
        case "unserve": {
          if (!screen.serve) { screen.sys("Aucun serveur."); return; }
          try { screen.serve.close(); } catch { /* ignore */ }
          screen.serve = null;
          screen.sys("Serveur coupé.");
          screen.render();
          return;
        }
        case "explain": {
          let code = "", label = "";
          if (arg) {
            try { code = fs.readFileSync(inside(arg), "utf8").slice(0, 6000); label = arg; }
            catch (e) { screen.sys("Lecture impossible : " + e.message); return; }
          } else {
            const blk = findCodeBlock(screen);
            if (!blk) { screen.sys("Usage : /explain <fichier> (ou après un bloc de code)"); return; }
            code = blk.code; label = "dernier bloc " + (blk.lang || "");
          }
          screen.busy = true; screen.render();
          try {
            screen.sys("Explication de " + label + "...");
            await askModel(screen, state, `Explique ce code simplement, partie par partie (rôle, points clés, pièges) :\n\`\`\`\n${code.slice(0, 5000)}\n\`\`\``, state.model);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "test": {
          let cmd = "";
          if (fs.existsSync("package.json")) cmd = "npm test";
          else if (fs.existsSync("pytest.ini") || fs.existsSync("tests") || fs.existsSync("requirements.txt")) cmd = "python -m pytest -q";
          else if (fs.existsSync("Cargo.toml")) cmd = "cargo test";
          else if (fs.existsSync("go.mod")) cmd = "go test ./...";
          if (!cmd) { screen.sys("Aucun runner détecté (npm/pytest/cargo/go)."); return; }
          screen.sys("$ " + cmd);
          if (!(await screen.confirm("Exécuter les tests ?"))) { screen.sys("Annulé."); return; }
          const t0 = Date.now();
          const res = await shellOut(cmd, 120000);
          screen.tool("test", true, (Date.now() - t0) / 1000, res);
          return;
        }
        case "git": {
          try {
            const br = gitBranch() || "?";
            const st = execSync("git status --short", { cwd: process.cwd(), timeout: 5000 }).toString().slice(0, 2000);
            screen.tool("git " + br, true, null, st.trim() || "(propre)");
          } catch (e) { screen.tool("git", false, null, "pas un dépôt git ?"); }
          return;
        }
        case "commit": {
          let diff = "";
          try { diff = execSync("git diff --cached", { cwd: process.cwd(), timeout: 5000, maxBuffer: 1024 * 200 }).toString().slice(0, 4000); } catch { /* ignore */ }
          if (!diff.trim()) {
            try { diff = execSync("git diff", { cwd: process.cwd(), timeout: 5000, maxBuffer: 1024 * 200 }).toString().slice(0, 4000); } catch { /* ignore */ }
          }
          if (!diff.trim()) { screen.sys("Rien à commiter."); return; }
          screen.busy = true; screen.render();
          try {
            await askModel(screen, state, "Propose UN message de commit conventionnel en français (<72 caractères) pour ce diff. Réponds QUE le message, sans guillemets :\n```\n" + diff + "\n```", state.model);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "history": {
          if (!screen.hist.length) { screen.sys("Historique vide."); return; }
          const from = Math.max(0, screen.hist.length - 15);
          screen.hist.slice(from).forEach((h, i) => screen.sys(`  ${from + i + 1}. ${String(h).slice(0, 70)}`));
          return;
        }
        case "share": {
          screen.busy = true; screen.render();
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 15000);
            const r = await fetch("https://paste.rs", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "text/markdown", "User-Agent": "auracode" }, body: exportTxt(screen.messages).slice(0, 100000) });
            clearTimeout(t);
            const url = (await r.text()).trim();
            if (!r.ok || !url.startsWith("http")) throw new Error("partage impossible");
            screen.sys("Partagé : " + url);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "uptime": {
          const s = Math.floor(process.uptime());
          const hh = String(Math.floor(s / 3600)).padStart(2, "0");
          const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
          const ss = String(s % 60).padStart(2, "0");
          screen.sys(`v${PKG.version} (build ${buildId()}) • Node ${process.version} • session ${hh}:${mm}:${ss} • ${screen.messages.length} blocs`);
          return;
        }
        case "prompt": {
          screen.sys("Protocole envoyé au modèle :");
          SYSTEM.split("\n").forEach((l) => screen.sys(l.trim() ? l : " "));
          return;
        }
        case "fix": {
          screen.sys("Diagnostic + réparation...");
          if (!state.key) { screen.sys("• pas de clé : lance `auracode login` dans un terminal."); }
          else {
            try {
              if (!getSessionId()) { await newSession(state.key, state.model); screen.sys("• session créée ✓"); }
              else screen.sys("• session OK");
            } catch (e) { screen.sys("• session : " + e.message); }
          }
          try {
            const v = await checkUpdate();
            if (v) { screen.updateAvailable = v; screen.sys(`• mise à jour dispo : ${v} (/update)`); }
            else screen.sys("• à jour ✓");
          } catch { /* ignore */ }
          screen.render();
          return;
        }
        case "date": {
          const d = new Date();
          screen.sys(d.toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + `  •  ${d.getTime()}`);
          return;
        }
        case "uuid": {
          screen.sys(crypto.randomUUID());
          return;
        }
        case "pass": {
          const n = Math.max(8, Math.min(64, parseInt(arg, 10) || 20));
          const s = crypto.randomBytes(48).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").slice(0, n);
          screen.sys(`Mot de passe (${n}) : ${s}`);
          return;
        }
        case "encode":
        case "decode": {
          const parts = arg.split(/\s+/).filter(Boolean);
          const how = (parts[0] || "").toLowerCase();
          const text = parts.slice(1).join(" ");
          if (!["b64", "base64", "url", "hex"].includes(how) || !text) { screen.sys("Usage : /encode <b64|url|hex> <texte>  (idem /decode)"); return; }
          try {
            let out;
            const isEnc = cmd === "encode";
            if (how.startsWith("b")) out = isEnc ? Buffer.from(text, "utf8").toString("base64") : Buffer.from(text, "base64").toString("utf8");
            else if (how === "url") out = isEnc ? encodeURIComponent(text) : decodeURIComponent(text);
            else out = isEnc ? Buffer.from(text, "utf8").toString("hex") : Buffer.from(text, "hex").toString("utf8");
            screen.tool(cmd, true, null, out);
          } catch (e) { screen.tool(cmd, false, null, "Conversion impossible."); }
          return;
        }
        case "json": {
          if (!arg) { screen.sys("Usage : /json <texte json>"); return; }
          try { screen.tool("json", true, null, JSON.stringify(JSON.parse(arg), null, 2).slice(0, 3000)); }
          catch (e) { screen.tool("json", false, null, "JSON invalide."); }
          return;
        }
        case "upper": {
          if (!arg) { screen.sys("Usage : /upper <texte>"); return; }
          screen.sys(arg.toUpperCase());
          return;
        }
        case "lower": {
          if (!arg) { screen.sys("Usage : /lower <texte>"); return; }
          screen.sys(arg.toLowerCase());
          return;
        }
        case "len": {
          if (!arg) { screen.sys("Usage : /len <texte>"); return; }
          const words = (arg.match(/\S+/g) || []).length;
          screen.sys(`${arg.length} caractères • ${words} mots`);
          return;
        }
        case "slug": {
          if (!arg) { screen.sys("Usage : /slug <texte>"); return; }
          screen.sys(slugify(arg));
          return;
        }
        case "sort": {
          if (!arg) { screen.sys("Usage : /sort <a,b,c>"); return; }
          screen.sys(arg.split(",").map((x) => x.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr")).join(", "));
          return;
        }
        case "shuffle": {
          if (!arg) { screen.sys("Usage : /shuffle <a,b,c>"); return; }
          const a = arg.split(",").map((x) => x.trim()).filter(Boolean);
          for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
          screen.sys(a.join(", "));
          return;
        }
        case "cal": {
          const now = new Date();
          screen.tool("calendrier", true, null, calMonth(now.getFullYear(), now.getMonth() + 1));
          return;
        }
        case "chrono": {
          const sub = (arg || "").toLowerCase();
          const fmtEl = (ms) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
          if (sub === "stop") {
            if (!screen.chronoT) { screen.sys("Aucun chrono."); return; }
            screen.sys("Chrono : " + fmtEl(Date.now() - screen.chronoT));
            screen.chronoT = null;
            return;
          }
          if (!screen.chronoT) { screen.chronoT = Date.now(); screen.sys("Chrono lancé (/chrono = temps, /chrono stop = fin)."); return; }
          screen.sys("Chrono : " + fmtEl(Date.now() - screen.chronoT));
          return;
        }
        case "table": {
          if (!arg) { screen.sys("Usage : /table <a,b;c,d>"); return; }
          try { screen.tool("table", true, null, mdTable(arg)); }
          catch (e) { screen.tool("table", false, null, e.message); }
          return;
        }
        case "tva": {
          const parts = arg.split(/\s+/).filter(Boolean);
          const prix = parseFloat((parts[0] || "").replace(",", "."));
          const taux = parseFloat((parts[1] || "20").replace(",", ".")) || 20;
          if (!(prix > 0)) { screen.sys("Usage : /tva <prix HT> [taux=20]"); return; }
          const tva = prix * taux / 100;
          screen.sys(`${prix} € HT + ${taux}% = ${(prix + tva).toFixed(2)} € TTC (TVA ${tva.toFixed(2)} €)`);
          return;
        }
        case "8ball": {
          const reps = ["Oui, certainement.", "C'est certain.", "Sans aucun doute.", "Très probable.", "Oui.", "Signes favorables.", "Mieux vaut ne pas te le dire maintenant.", "Redemande plus tard.", "N'y compte pas.", "Non.", "Très douteux.", "Fonce !", "Réfléchis encore.", "Absolument pas.", "Les étoiles disent oui.", "Probablement.", "Ça sent bon.", "Évite.", "Gros oui.", "Non, et c'est non."];
          screen.sys(`🎱 ${reps[Math.floor(Math.random() * reps.length)]}`);
          return;
        }
        case "lorem": {
          const n = Math.max(1, Math.min(200, parseInt(arg, 10) || 30));
          const base = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis".split(" ");
          const out = [];
          for (let i = 0; i < n; i++) out.push(base[i % base.length]);
          screen.sys(out.join(" ") + ".");
          return;
        }
        case "rainbow": {
          if (!arg) { screen.sys("Usage : /rainbow <texte>"); return; }
          const cols = [P.pink, P.peach, P.butter, P.mint, P.aqua, P.sky, P.lavender, P.lilac, P.coral, P.lemon];
          let s = "";
          [...arg.slice(0, 200)].forEach((ch, i) => { s += cols[i % cols.length] + ch; });
          screen.tool("rainbow", true, null, s + P.reset);
          return;
        }
        case "cowsay": {
          screen.tool("vache", true, null, cowSay(arg || "meuh"));
          return;
        }
        case "bg": {
          if (!arg) { screen.sys("Usage : /bg <commande>"); return; }
          const id = (screen.jobSeq = (screen.jobSeq || 0) + 1);
          const file = path.join(os.tmpdir(), `aura-job-${process.pid}-${id}.log`);
          try { fs.writeFileSync(file, `$ ${arg}\n[démarré]\n`); } catch { /* ignore */ }
          const proc = exec(arg, { cwd: process.cwd(), timeout: 30 * 60000, maxBuffer: 1024 * 1024 }, (err) => {
            try { fs.appendFileSync(file, `\n[terminé code=${err ? err.code || 1 : 0}]\n`); } catch { /* ignore */ }
            try { screen.render(); } catch { /* ignore */ }
          });
          if (proc && proc.unref) proc.unref();
          screen.jobs = screen.jobs || [];
          screen.jobs.push({ id, cmd: arg, file, start: Date.now(), proc });
          if (screen.jobs.length > 10) screen.jobs.shift();
          screen.sys(`Tâche #${id} lancée en fond (/jobs, /fg ${id}).`);
          return;
        }
        case "jobs": {
          const list = screen.jobs || [];
          if (!list.length) { screen.sys("Aucune tâche. /bg <commande> pour lancer."); return; }
          list.forEach((j) => {
            const done = !j.proc || j.proc.exitCode !== null;
            const el = Math.round((Date.now() - j.start) / 1000);
            screen.sys(`  #${j.id} ${done ? `fini (${j.proc ? j.proc.exitCode : "?"})` : `en cours ${el}s`} — ${j.cmd}`);
          });
          return;
        }
        case "fg": {
          const id = parseInt(arg, 10);
          const j = (screen.jobs || []).find((x) => x.id === id);
          if (!j) { screen.sys("Usage : /fg <id> (voir /jobs)"); return; }
          try {
            const out = fs.readFileSync(j.file, "utf8").slice(-3000);
            screen.tool("job #" + id, true, null, out);
          } catch (e) { screen.tool("job", false, null, e.message); }
          return;
        }
        case "plan": {
          if (!arg) { screen.sys("Usage : /plan <tâche>"); return; }
          screen.busy = true; screen.render();
          try {
            let sid = getSessionId();
            if (!sid) sid = await newSession(state.key, state.model);
            const d = await api("/api/chat", {
              message: `Propose un plan numéroté (max 6 étapes, chacune faisable avec : lire/écrire/exécuter/chercher des fichiers) pour : ${arg}. Réponds UNIQUEMENT avec les étapes numérotées, une par ligne.`,
              session_id: sid, model: state.model, effort: "low",
            }, state.key);
            const steps = String(d.reply || "").split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((l) => l.length > 3).slice(0, 6);
            if (!steps.length) throw new Error("plan vide");
            screen.plan = { task: arg, steps, idx: 0 };
            screen.sys(`Plan (${steps.length} étapes) — /go une par une, /goall tout :`);
            steps.forEach((s, i) => screen.sys(`  ${i + 1}. ${s}`));
            await screen.refreshQuota();
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "go":
        case "goall": {
          const p = screen.plan;
          if (!p || p.idx >= p.steps.length) { screen.sys("Pas de plan en cours (/plan <tâche>)."); return; }
          const all = cmd === "goall";
          do {
            const step = p.steps[p.idx++];
            screen.sys(`▶ Étape ${p.idx}/${p.steps.length} : ${step}`);
            await screen.onLine(step);
            if (screen.cancelled) { screen.sys("Plan interrompu."); break; }
          } while (all && p.idx < p.steps.length);
          if (p.idx >= p.steps.length) { screen.sys("Plan terminé ✓"); screen.plan = null; }
          return;
        }
        case "macro": {
          const parts = arg.split(/\s+/).filter(Boolean);
          const sub = (parts[0] || "list").toLowerCase();
          const arr = loadList(MACROS_FILE);
          if (sub === "add") {
            const name = parts[1] || "";
            const text = parts.slice(2).join(" ");
            if (!/^[a-z0-9_-]{1,20}$/i.test(name) || !text) { screen.sys("Usage : /macro add <nom> <texte>"); return; }
            const i = arr.findIndex((x) => x.name === name);
            if (i >= 0) arr[i].text = text; else arr.push({ name, text });
            saveList(MACROS_FILE, arr);
            screen.sys(`Macro !${name} ${i >= 0 ? "mise à jour" : "créée"}.`);
            return;
          }
          if (sub === "del") {
            const name = parts[1] || "";
            const n0 = arr.length;
            saveList(MACROS_FILE, arr.filter((x) => x.name !== name));
            screen.sys(n0 === arr.length ? "Introuvable." : "Supprimée.");
            return;
          }
          if (!arr.length) { screen.sys("Aucune macro. /macro add <nom> <texte> puis tape !<nom>"); return; }
          screen.sys("Macros (tape !nom) :");
          arr.forEach((x) => screen.sys(`  !${x.name} → ${String(x.text).slice(0, 60)}`));
          return;
        }
        case "conv": {
          let list = [];
          try {
            const d = await api("/api/sessions", null, state.key, "GET");
            list = (d.sessions || []).slice(-12);
          } catch (e) { screen.sys("Erreur : " + e.message); return; }
          if (!list.length) { screen.sys("Aucune conversation. /new pour commencer."); return; }
          screen.openModal("Conversations (serveur)", [
            { label: "＋ Nouvelle conversation", value: "__new" },
            ...list.map((s) => ({ label: `${String(s.session_id).slice(0, 8)} • ${s.model || "?"} • ${s.messages_used || 0} msgs — ${(s.title || "").slice(0, 30)}`, value: s.session_id })),
          ], async (v) => {
            if (!v) { screen.render(); return; }
            try {
              if (v === "__new") {
                const id = await newSession(state.key, state.model);
                screen.sys("Nouvelle conversation : " + String(id).slice(0, 8));
              } else {
                setSessionId(v);
                const found = list.find((s) => s.session_id === v);
                if (found && found.model) state.model = found.model;
                screen.sys("Conversation : " + String(v).slice(0, 8));
              }
              await screen.refreshQuota();
              screen.render();
            } catch (e) { screen.sys("Erreur : " + e.message); }
          });
          return;
        }
        case "review": {
          let code = "", label = "";
          if (arg) {
            try { code = fs.readFileSync(inside(arg), "utf8").slice(0, 6000); label = arg; }
            catch (e) { screen.sys("Lecture impossible : " + e.message); return; }
          } else {
            const blk = findCodeBlock(screen);
            if (!blk) { screen.sys("Usage : /review <fichier> (ou après un bloc de code)"); return; }
            code = blk.code; label = "dernier bloc " + (blk.lang || "");
          }
          screen.busy = true; screen.render();
          try {
            screen.sys("Relecture de " + label + "...");
            await askModel(screen, state, `Relis ce code (bugs, sécurité, perf). Donne une note /10 puis max 5 remarques concrètes :\n\`\`\`\n${code.slice(0, 5000)}\n\`\`\``, state.model);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "persona": {
          const cfg = loadJson(CONFIG_FILE, {});
          if (!arg) {
            screen.sys(cfg.persona ? "Persona : " + cfg.persona : "Pas de persona. /persona <texte> pour en définir une, /persona off pour effacer.");
            return;
          }
          if (arg.toLowerCase() === "off") { delete cfg.persona; saveJson(CONFIG_FILE, cfg); screen.sys("Persona effacée."); return; }
          cfg.persona = arg.slice(0, 2000); saveJson(CONFIG_FILE, cfg);
          screen.sys("Persona enregistrée (appliquée à chaque demande).");
          return;
        }
        case "compare": {
          if (!arg) { screen.sys("Usage : /compare <question>"); return; }
          screen.busy = true; screen.render();
          try {
            let sid = getSessionId();
            if (!sid) sid = await newSession(state.key, state.model);
            screen.sys("J'interroge aura-1.1 et aura-1.2...");
            const [a, b] = await Promise.all([
              api("/api/chat", { message: arg, session_id: sid, model: "aura-1.1", effort: "middle" }, state.key),
              api("/api/chat", { message: arg, session_id: sid, model: "aura-1.2", effort: "middle" }, state.key),
            ]);
            screen.sys("— aura-1.1 :");
            screen.assistant(String(a.reply || "").trim());
            screen.sys("— aura-1.2 :");
            screen.assistant(String(b.reply || "").trim());
            await screen.refreshQuota();
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "feux-artifice-test":
        case "feux-artice-test": {
          let admin = false;
          try {
            const me = await api("/api/me", null, state.key, "GET");
            admin = !!(me && me.is_admin);
          } catch (e) { screen.sys("Vérification impossible : " + e.message); return; }
          if (!admin) { screen.sys("Réservé aux admins."); return; }
          screen.sys("🎆 Test admin — Échap pour passer.");
          await runFireworks(screen, 8, "🎆 Test Aura 1.3 🎆");
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
      confirm: (q, always) => screen.confirm(q, always),
      permitted: (n) => !!(screen.permits || {})[n],
      permit: (n) => { screen.permits = screen.permits || {}; screen.permits[n] = true; },
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
        const lockHit = state.model === "aura-1.3" || /aura 1\.3/i.test(String(d.hint || "") + " " + String(d.error || ""));
        if (lockHit && aura13Locked()) {
          screen.sys(`🔒 Aura 1.3 dans ${aura13Countdown()} (${AURA13_LAUNCH_LABEL})`);
          openBrowser(AURA13_WAIT_URL);
        } else screen.sys(d.quota_exceeded ? (d.error || "Quota épuisé.") : `Erreur (${e.status || "?"}) : ${e.message}`);
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
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) { console.log(`${PKG.version} (build ${buildId()})`); return; }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AuraCode v${PKG.version}\n\nUsage:\n  auracode              Démarre l'assistant (intro + chat)\n  auracode setup          Écran d'installation pastel (clé, modèle, effort)\n  auracode login          Connexion VTH (navigateur localhost:3000)\n  auracode logout         Oublie la clé\n  auracode new            Nouvelle conversation\n  auracode update         Met à jour le .exe (Windows)
  auracode uninstall      Désinstalle (confirmation, tokens effacés)\n  auracode --model X      Modèle (aura-1.1, aura-1.2, aura-1.3, aura-1.1-code)\n  auracode --effort X     Effort (low, middle, high, xhigh)\n  auracode "question"       Réponse unique sans ouvrir l'interface
  Plein écran : /new /model /effort /lang /sessions /retry /bash /read /run /write /doctor /stats /quota /image /copy /export /theme /update /clear /help (/tape /help pour tout voir)\n`);
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
      const lockHit = /aura 1\.3/i.test(String(er.hint || "") + " " + String(er.error || ""));
      if (lockHit && aura13Locked()) {
        console.log(`🔒 Aura 1.3 dans ${aura13Countdown()} (${AURA13_LAUNCH_LABEL})`);
        openBrowser(AURA13_WAIT_URL);
      } else console.log(er.quota_exceeded ? (er.error || "Quota épuisé.") : "Erreur (" + (e.status || "?") + ") : " + e.message);
    }
    return;
  }

  const updateAvailable = await splash();
  if (aura13Party()) {
    console.log("🎆 Aura 1.3 est sortie ! Célébration... (touche pour passer)");
    await runFireworks(null, 7, "🎆 Aura 1.3 est là ! 🎆");
  }
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

  const MODELS = ["aura-1.1", "aura-1.2", "aura-1.3", "aura-1.1-code"];
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
  /model [X]        Voir/Changer de modèle (aura-1.1, aura-1.2, aura-1.3, aura-1.1-code)
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
          { value: "aura-1.3", label: "Aura 1.3", desc: "14B • ~3 mots/s • coût x6" },
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
