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
// ---------- Checkpoints : sauvegardes locales avant chaque écriture (/rewind) ----------
const BACKUP_ROOT = path.join(HOME, "backups");
const SKILLS_DIR = path.join(HOME, "skills");
function backupList(root) {
  // [{n, file, rel, path, time, session, existed, content}] du plus récent au plus ancien.
  const out = [];
  try {
    const base = root || BACKUP_ROOT;
    if (!fs.existsSync(base)) return out;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".bak.json")) {
          try {
            const meta = JSON.parse(fs.readFileSync(full, "utf8"));
            out.push({ path: full, file: meta.file, rel: meta.rel || meta.file, time: meta.time || 0, session: meta.session || "", existed: !!meta.existed, content: meta.content ?? null });
          } catch { /* backup corrompu : ignoré */ }
        }
      }
    };
    walk(base);
  } catch { /* ignore */ }
  out.sort((a, b) => b.time - a.time);
  out.forEach((b, i) => { b.n = i + 1; });
  return out;
}
function snapshotFile(abs, sessionId, root) {
  // Sauvegarde le contenu actuel avant écriture (ou marque "nouveau"). Retourne le chemin du backup ou null.
  try {
    let prev = null, existed = false;
    try { prev = fs.readFileSync(abs, "utf8"); existed = true; } catch { prev = null; }
    if (prev && prev.length > 500000) return null; // trop gros : pas de snapshot
    const rel = path.relative(process.cwd(), abs).replace(/\\/g, "/");
    const safe = rel.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80) || "fichier";
    const base = root || BACKUP_ROOT;
    const dir = path.join(base, String(sessionId || "local").slice(0, 12));
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, Date.now() + "-" + safe + ".bak.json");
    fs.writeFileSync(fp, JSON.stringify({ file: abs, rel, time: Date.now(), session: sessionId || "", existed, content: prev }));
    const all = backupList(root);
    for (const b of all.slice(50)) { try { fs.unlinkSync(b.path); } catch { /* ignore */ } }
    return fp;
  } catch { return null; }
}
// ---------- Mémoire projet (AURA.md) + skills + coûts ----------
function auraFile() {
  try {
    const p = path.join(process.cwd(), "AURA.md");
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf8").slice(0, 1500);
  } catch { return ""; }
}
function skillParse(text) {
  const lines = String(text || "").split("\n");
  let name = "", desc = "";
  for (const l of lines) {
    const t = l.trim();
    if (!name && /^#{1,3}\s+/.test(t)) name = t.replace(/^#{1,3}\s+/, "").trim();
    else if (!desc && /^>\s?/.test(t)) desc = t.replace(/^>\s?/, "").trim();
    if (name && desc) break;
  }
  if (!name && lines.length) name = lines[0].trim().replace(/^#*\s*/, "").slice(0, 40);
  return { name: name || "sans-nom", desc: desc || "" };
}
function listSkills(dir) {
  const out = [];
  try {
    const base = dir || SKILLS_DIR;
    if (!fs.existsSync(base)) return out;
    for (const e of fs.readdirSync(base)) {
      if (!e.endsWith(".md")) continue;
      try {
        const t = fs.readFileSync(path.join(base, e), "utf8");
        const s = skillParse(t);
        out.push({ id: e.replace(/\.md$/, ""), name: s.name, desc: s.desc, file: path.join(base, e), text: t });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
function sessionSpend(messages) {
  // Même calcul que la barre de statut (ui.js) : total tokens estimés de la conversation.
  let t = 0;
  try {
    for (const m of messages || []) {
      if (m && m.meta && m.meta.tok) t += m.meta.tok;
      else if (m && (m.role === "user" || m.role === "assistant")) t += Math.round(String(m.text || "").length / 4);
    }
  } catch { /* ignore */ }
  return t;
}
function formatAdminStats(g) {
  // Met en forme le global de /api/admin/stats (pur, testé).
  try {
    const t = (g && g.totals) || {};
    const n = (x) => typeof x === "number" ? x.toLocaleString("fr-FR") : "—";
    const L = [];
    L.push(`📊 Stats globales (${(g && g.days) || "?"} jours) :`);
    L.push(`  Requêtes : ${n(t.requests)} · Tokens : ${n(t.tokens)} · Erreurs : ${n(t.errors)}`);
    L.push(`  Comptes actifs : ${n(t.users_active)} / ${n(t.users_total)} · Verrouillés : ${n(t.locked_now)} · Latence moy. : ${n(t.avg_latency_ms)} ms`);
    const pm = (g && g.per_model) || [];
    if (pm.length) {
      L.push("  Par modèle :");
      pm.slice(0, 8).forEach((m) => L.push(`    ${m.model} : ${n(m.requests)} req · ${n(m.tokens)} tok · ${n(m.errors)} err`));
    }
    const pd = (g && g.per_day) || [];
    if (pd.length) {
      L.push("  Derniers jours :");
      pd.slice(0, 7).forEach((d) => L.push(`    ${d.day} : ${n(d.requests)} req · ${n(d.tokens)} tok · ${n(d.users)} comptes`));
    }
    const tu = (g && g.top_users) || [];
    if (tu.length) {
      L.push("  Top comptes :");
      tu.slice(0, 10).forEach((u, i) => L.push(`    ${i + 1}. ${u.user_id} : ${n(u.requests)} req · ${n(u.tokens)} tok · ${n(u.images)} img`));
    }
    return L.join("\n");
  } catch { return "Stats illisibles."; }
}
function sandboxSpawnArgs() {
  // Commande "nouveau terminal Windows" pour la sandbox admin (pur, testé).
  // Titre ASCII (cmd.exe) + /k (fenêtre conservée pour voir les erreurs).
  const exe = process.execPath || "";
  const isExe = /auracode(\.exe)?$/i.test(exe);
  const script = (!isExe && process.argv[1]) || "";
  const inner = (isExe || !script) ? [(isExe ? exe : "auracode"), "--sandbox"]
    : [exe, script, "--sandbox"];
  return {
    launcher: "cmd.exe",
    args: ["/c", "start", "AuraCode Sandbox BETA - Aura 1.3", "/d",
      process.cwd(), "cmd", "/k", ...inner],
  };
}
function unavailableText(model) {
  // Lignes de l'écran "indisponible" (pur, testé).
  if (model === "aura-2") return ["🔒 AURA 2 — Indisponible pour le moment.", "Nous préparons Aura 2 (Qwen3.8-27B, 27B). Reste à l'affût !"];
  return ["🔒 AURA 1.3 — Indisponible pour le moment.", `Nous préparons Aura 1.3. Sortie : ${AURA13_LAUNCH_LABEL} (dans ${aura13Countdown()}).`];
}
function showUnavailable(screen, model) {
  // Écran "indisponible" : panneau encadré dans le chat.
  const lines = unavailableText(model);
  const w = Math.max(...lines.map((l) => l.length));
  const bar = "═".repeat(w + 4);
  screen.sys("╔" + bar + "╗");
  lines.forEach((l) => screen.sys("║  " + l + " ".repeat(Math.max(0, w - l.length)) + "  ║"));
  screen.sys("╚" + bar + "╝");
  screen.render();
}
function ask(rl, q) {
  return new Promise((res) => rl.question(q + " [o/N] ", (a) => res(/^o(ui)?$/i.test(a.trim()))));
}
const denyHit = (ui, n) => !!(ui && ui.denied && ui.denied[n]);
const DENY_MSG = (t) => `Refusé par règle auto (${t}). /permissions pour voir, /auto ${t} ask pour réactiver.`;
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
      if (denyHit(ui, "write_file")) return DENY_MSG("write_file");
      let okW = ui.permitted && ui.permitted("write_file") ? true : await ui.confirm("Écrire ce fichier ?", !!(ui && ui.permit));
      if (okW === "always" && ui.permit) { ui.permit("write_file"); okW = true; }
      if (!okW) return "Annulé par l'utilisateur.";
      snapshotFile(abs, getSessionId());
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content || "");
      return "Fichier écrit : " + p;
    },
  },
  exec: {
    desc: "Exécute une commande shell (demande confirmation). Args: {cmd}",
    run: (args, ui) => new Promise(async (resolve) => {
      ui.sys("$ " + args.cmd);
      if (denyHit(ui, "exec")) return resolve(DENY_MSG("exec"));
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
      if (denyHit(ui, "open_file")) return DENY_MSG("open_file");
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
  const preamble = SYSTEM + (() => { try { const pz = String(loadJson(CONFIG_FILE, {}).persona || "").trim().slice(0, 2000); return pz ? `\n\n[Persona utilisateur : ${pz}]` : ""; } catch { return ""; } })() + (() => { try { const a = auraFile().trim(); return a ? `\n\n[Mémoire projet (AURA.md) :\n${a}]` : ""; } catch { return ""; } })() + (() => { try { const sk = loadJson(CONFIG_FILE, {}).skill; if (!sk) return ""; const hit = listSkills().find((s) => s.id === sk); return hit ? `\n\n[Compétence active (${hit.id}) :\n${String(hit.text).slice(0, 2000)}]` : ""; } catch { return ""; } })() + `\n\n[Contexte PC : OS ${process.platform}, dossier actuel ${process.cwd()}, dossier perso ${home}, Bureau ${path.join(home, "Desktop")}. Accès COMPLET aux fichiers, chemins relatifs et absolus.]`;
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

