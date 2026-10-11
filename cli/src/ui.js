// cli/src/ui.js — affichage terminal : Screen, splash, modales, canvas.
// Bundlé : symboles partagés fournis par shared.js (même portée finale).

function adLine(W) {
  const txt = aura13Locked() ? `✨ Aura 1.3 by VTH Groupdans ${aura13Countdown()} — ${AURA13_LAUNCH_LABEL}` : "✨ Aura 1.3 by VTH Group est là — /model aura-1.3 !";
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
    center("L'IA qui pilote (vraiment) ton PC — By VTH Group", "sky"),
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
  { name: "/mkdir", desc: "Crée un dossier : /mkdir <chemin>", files: true },
  { name: "/touch", desc: "Crée un fichier vide : /touch <chemin>", files: true },
  { name: "/resume", desc: "Reprend : /resume [n] (défaut dernière)" },
  { name: "/rewind", desc: "Annule une écriture : /rewind [n|liste]" },
  { name: "/init", desc: "Crée AURA.md (mémoire projet)" },
  { name: "/cost", desc: "Coût estimé de la session" },
  { name: "/skill", desc: "Compétence perso : /skill <nom>", skills: true },
  { name: "/auto", desc: "Règle auto : /auto <outil> <allow|deny|ask>" },
  { name: "/permissions", desc: "Voir les règles auto" },
  { name: "/admin-stats", desc: "Stats globales (admin)" },
  { name: "/allow", desc: "Toujours autoriser : /allow <outil>" },
  { name: "/deny", desc: "Toujours refuser : /deny <outil>" },
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
    this.denied = {};
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
      const mm = String((this.state && this.state.model) || "");
      const nameColor = mine ? P.sky : mm.includes("1.3") ? P.butter : /code/i.test(mm) ? P.aqua : P.mint;
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
      if (cmd && cmd.skills) {
        const frag = m2[2].toLowerCase();
        const items = listSkills()
          .filter((s) => (s.id + " " + s.name).toLowerCase().includes(frag))
          .slice(0, 8)
          .map((s) => ({ insert: `/${m2[1]} ${s.id}`, display: `${s.id}  —  ${s.name}` }));
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
        // Pas de macro : !cmd devient une commande shell directe (style Claude Code).
        line = ("/bash " + line.slice(1)).trim();
      } else {
        line = (hit.text + " " + rest).trim();
      }
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
    if (key.ctrl && key.name === "o") { if (typeof this.onQuickSwitch === "function") this.onQuickSwitch(); else { this.input = "/conv "; this.cursor = this.input.length; this.onEdit(); } return; }
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

