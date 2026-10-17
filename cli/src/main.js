// cli/src/main.js — commandes CLI, runTUI, boucle principale.
// Bundlé : symboles partagés fournis par shared/backend/ui (même portée finale).

async function runTUI(state, updateAvailable) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log("Terminal interactif requis pour le mode plein écran.");
    process.exit(1);
  }
  const screen = new Screen(state, updateAvailable);
  discordConnect();
  const saveRules = () => {
    try {
      const cfg = loadJson(CONFIG_FILE, {});
      const r = {};
      for (const t of Object.keys(screen.permits || {})) if (screen.permits[t]) r[t] = "allow";
      for (const t of Object.keys(screen.denied || {})) if (screen.denied[t]) r[t] = "deny";
      cfg.permits = r;
      saveJson(CONFIG_FILE, cfg);
    } catch { /* ignore */ }
  };
  try {
    const sv = loadJson(CONFIG_FILE, {});
    const r = (sv && typeof sv.permits === "object" && sv.permits) || {};
    screen.permits = screen.permits || {};
    screen.denied = screen.denied || {};
    for (const t of Object.keys(r)) {
      if (r[t] === "deny") screen.denied[t] = true;
      else if (r[t] === "allow") screen.permits[t] = true;
    }
  } catch { /* ignore */ }
  screen.onQuickSwitch = () => screen.onLine("/conv");
  screen.saveRules = saveRules;
  if (state.sandbox) screen.sys("🧪 SANDBOX ADMIN — Aura 1.3 déverrouillé (bêta, ne pas diffuser).");

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
      const MODELS = ["aura-1.1", "aura-1.2", "aura-1.3", "aura-1.1-code", "aura-2"];
      const EFFORTS = ["low", "middle", "high", "xhigh"];
      const LANGS = ["fr", "en"];
      const saveCfg = () => {
        try {
          const c = loadJson(CONFIG_FILE, {});
          c.model = state.model; c.effort = state.effort;
          c.lang = state.lang; c.theme = state.theme;
          saveJson(CONFIG_FILE, c);
        } catch { /* ignore */ }
      };
      const pickModal = (title, options, current, apply) => {
        screen.openModal(title, options.map((o) => ({ label: o + (o === current ? "  ● actuel" : ""), value: o })), (v) => {
          if (!v) { screen.render(); return; }
          apply(v);
        });
      };
      switch (cmd) {
        case "exit": case "quit": case "q": discordClear(); screen.quit(); return;
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
              discordPresence(v, state.effort);
              screen.sys("Modèle : " + v);
              screen.render();
            });
            return;
          }
          if (!MODELS.includes(arg)) { screen.sys("Modèle inconnu. Valides : " + MODELS.join(", ")); return; }
          if ((arg === "aura-1.3" || arg === "aura-2") && !state.sandbox && (arg === "aura-2" || aura13Locked())) {
            showUnavailable(screen, arg);
            if (arg === "aura-1.3") {
              screen.sys("Ouverture de la page d'attente...");
              openBrowser(AURA13_WAIT_URL);
              screen.render();
            }
            return;
          }
          state.model = arg; saveCfg();
          discordPresence(arg, state.effort);
          screen.sys("Modèle : " + arg);
          screen.render();
          return;
        case "effort":
          if (!arg) {
            pickModal("Effort", EFFORTS, state.effort, (v) => {
              state.effort = v; saveCfg();
              discordPresence(state.model, v);
              screen.sys("Effort : " + v);
              screen.render();
            });
            return;
          }
          if (!EFFORTS.includes(arg)) { screen.sys("Effort inconnu. Valides : " + EFFORTS.join(", ")); return; }
          state.effort = arg; saveCfg();
          discordPresence(state.model, arg);
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
          if (aura13Locked() && !state.sandbox) {
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
          if ((screen.denied || {}).exec) { screen.sys("Refusé par règle auto (exec). /auto exec ask pour réactiver."); return; }
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
            snapshotFile(abs, getSessionId());
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
          if ((screen.denied || {}).exec) { screen.sys("Refusé par règle auto (exec). /auto exec ask pour réactiver."); return; }
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
      denied: screen.denied || {},
      permit: (n) => { screen.permits = screen.permits || {}; screen.permits[n] = true; try { screen.saveRules && screen.saveRules(); } catch { /* ignore */ } },
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
        case "mkdir": {
          if (!arg) { screen.sys("Usage : /mkdir <chemin>"); return; }
          try {
            const abs = inside(arg);
            fs.mkdirSync(abs, { recursive: true });
            screen.tool("mkdir " + arg, true, null, "Dossier OK : " + abs);
          } catch (e) { screen.tool("mkdir", false, null, e.message); }
          return;
        }
        case "touch": {
          if (!arg) { screen.sys("Usage : /touch <chemin>"); return; }
          try {
            const abs = inside(arg);
            if (fs.existsSync(abs)) {
              const now = new Date();
              fs.utimesSync(abs, now, now);
              screen.tool("touch " + arg, true, null, "Existe déjà (dates mises à jour).");
            } else {
              snapshotFile(abs, getSessionId());
              fs.mkdirSync(path.dirname(abs), { recursive: true });
              fs.writeFileSync(abs, "");
              screen.tool("touch " + arg, true, null, "Fichier créé (vide).");
            }
          } catch (e) { screen.tool("touch", false, null, e.message); }
          return;
        }
        case "resume": {
          let list = [];
          try {
            const d = await api("/api/sessions", null, state.key, "GET");
            list = d.sessions || [];
          } catch (e) { screen.sys("Erreur : " + e.message); return; }
          if (!list.length) { screen.sys("Aucune conversation. /new pour commencer."); return; }
          const n = parseInt(arg, 10);
          const pick = Number.isFinite(n) && n >= 1 ? n : 1;
          const s = list[list.length - pick];
          if (!s) { screen.sys(`Numéro hors plage (1 = dernière, max ${list.length}).`); return; }
          try {
            setSessionId(s.session_id);
            if (s.model) { state.model = s.model; saveCfg(); }
            await screen.refreshQuota();
            screen.sys(`Reprise : ${String(s.session_id).slice(0, 8)} • ${s.model || "?"} • ${(s.title || "").slice(0, 40)}`);
            screen.render();
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "rewind": {
          const all = backupList();
          if (!all.length) { screen.sys("Aucun checkpoint. Les écritures futures seront sauvegardées avant modification."); return; }
          if (!arg || arg === "liste" || arg === "list") {
            screen.sys("Checkpoints (plus récent d'abord) : /rewind <n>");
            all.slice(0, 10).forEach((b) => screen.sys(`  ${b.n}. ${b.rel} — ${new Date(b.time).toLocaleString()}${b.existed ? "" : " (nouveau)"}`));
            return;
          }
          const n = parseInt(arg, 10);
          const b = all.find((x) => x.n === n);
          if (!b) { screen.sys("Numéro invalide. /rewind liste"); return; }
          try {
            if (b.existed) fs.writeFileSync(b.file, b.content ?? "");
            else { try { fs.unlinkSync(b.file); } catch { /* déjà absent */ } }
            screen.tool("rewind", true, null, `${b.rel} restauré (${b.existed ? "contenu précédent" : "fichier supprimé, il était nouveau"}).`);
          } catch (e) { screen.tool("rewind", false, null, e.message); }
          return;
        }
        case "init": {
          const fp = path.join(process.cwd(), "AURA.md");
          if (fs.existsSync(fp)) { screen.sys("AURA.md existe déjà — édite-le directement."); return; }
          const tpl = `# ${path.basename(process.cwd())}\n\n> Mémoire projet lue à chaque réponse. Décris ici : but du projet, commandes utiles, conventions.\n\n## Contexte\n- ...\n\n## Commandes\n- ...\n\n## Conventions\n- ...\n`;
          try {
            snapshotFile(fp, getSessionId());
            fs.writeFileSync(fp, tpl);
            screen.tool("init", true, null, "AURA.md créé — complète-le, il sera relu à chaque réponse.");
          } catch (e) { screen.tool("init", false, null, e.message); }
          return;
        }
        case "cost": {
          const tok = sessionSpend(screen.messages || []);
          const q = screen.quotaText ? ` · ${screen.quotaText}` : "";
          screen.sys(`Coût session : ~${tok} tok estimés (${state.model}, effort ${state.effort})${q}`);
          return;
        }
        case "skill": {
          const all = listSkills();
          if (!arg) {
            if (!all.length) { screen.sys(`Aucune compétence. Crée des fichiers .md dans ${SKILLS_DIR} puis /skill <nom>.`); return; }
            screen.sys("Compétences :");
            all.forEach((s) => screen.sys(`  ${s.id} — ${s.name}${s.desc ? " : " + s.desc.slice(0, 60) : ""}`));
            return;
          }
          if (arg === "off") {
            try { const c = loadJson(CONFIG_FILE, {}); delete c.skill; saveJson(CONFIG_FILE, c); } catch { /* ignore */ }
            screen.sys("Compétence désactivée.");
            return;
          }
          const hit = all.find((s) => s.id === arg) || all.find((s) => s.name.toLowerCase() === String(arg).toLowerCase());
          if (!hit) { screen.sys(`Introuvable : ${arg} (/skill pour la liste)`); return; }
          try { const c = loadJson(CONFIG_FILE, {}); c.skill = hit.id; saveJson(CONFIG_FILE, c); } catch { /* ignore */ }
          screen.sys(`Compétence active : ${hit.id} — ${hit.name} (injectée à chaque réponse, /skill off pour couper)`);
          return;
        }
        case "auto": case "allow": case "deny": {
          const VALID = ["write_file", "exec", "open_file"];
          let tool = arg, mode = cmd === "allow" ? "allow" : cmd === "deny" ? "deny" : "";
          if (cmd === "auto") {
            const parts = String(arg).split(/\s+/).filter(Boolean);
            tool = parts[0] || ""; mode = (parts[1] || "").toLowerCase();
            if (!tool || !["allow", "deny", "ask"].includes(mode)) { screen.sys("Usage : /auto <outil> <allow|deny|ask>  (outils : write_file, exec, open_file)"); return; }
          }
          if (!VALID.includes(tool)) { screen.sys("Outil inconnu. Valides : " + VALID.join(", ") + " (/bash et /run suivent exec)"); return; }
          screen.permits = screen.permits || {}; screen.denied = screen.denied || {};
          if (mode === "allow") { screen.permits[tool] = true; delete screen.denied[tool]; }
          else if (mode === "deny") { screen.denied[tool] = true; delete screen.permits[tool]; }
          else { delete screen.permits[tool]; delete screen.denied[tool]; }
          try { screen.saveRules && screen.saveRules(); } catch { /* ignore */ }
          screen.sys(`${tool} → ${mode === "allow" ? "toujours autorisé" : mode === "deny" ? "toujours refusé" : "demande à chaque fois"} (persisté).`);
          return;
        }
        case "permissions": {
          const rows = ["write_file", "exec", "open_file"].map((t) =>
            `  ${t} : ${(screen.denied || {})[t] ? "toujours refusé" : (screen.permits || {})[t] ? "toujours autorisé" : "demande à chaque fois"}`);
          screen.sys("Règles auto (persistées) :\n" + rows.join("\n") + "\n(/bash et /run suivent exec)");
          return;
        }
        case "admin-stats": {
          screen.busy = true; screen.render();
          try {
            const d = await api("/api/admin/stats", null, state.key, "GET");
            screen.sys(formatAdminStats(d.global || d));
          } catch (e) {
            if (e && e.status === 403) screen.sys("⛔ Réservé aux comptes avec la permission admin.");
            else screen.sys("Erreur : " + ((e && e.message) || e));
          }
          screen.busy = false; screen.render();
          return;
        }
        case "admin-sandbox": {
          screen.busy = true; screen.render();
          try {
            const me = await api("/api/me", null, state.key, "GET");
            if (!me.is_admin) {
              screen.sys("⛔ Sandbox 1.3 réservée aux comptes avec la permission admin.");
            } else if (process.platform !== "win32") {
              screen.sys("⛔ Sandbox : nouveau terminal supporté uniquement sous Windows pour l'instant.");
            } else {
              const s = sandboxSpawnArgs();
              const child = spawn(s.launcher, s.args, { detached: true, stdio: "ignore", cwd: process.cwd() });
              child.unref();
              screen.sys("🧪 Sandbox admin ouverte dans un nouveau terminal (Aura 1.3 bêta, verrou levé).");
              screen.sys("Reconnecte-toi via le navigateur dans la nouvelle fenêtre, puis teste en bêta (ne pas diffuser).");
            }
          } catch (e) { screen.sys("Erreur : " + ((e && e.message) || e)); }
          screen.busy = false; screen.render();
          return;
        }
        case "reach": {
          const st = discordStatus();
          screen.sys("Discord RPC : " + (st.connected ? "connecté au pipe " + st.pipe : "déconnecté"));
          screen.sys("Discord RPC : " + (st.ready ? "READY (présence active)" : "pas de READY (Discord fermé ou appli invalide)"));
          screen.sys("Application ID : " + st.clientId);
          screen.sys("Tape /model aura-1.2 pour envoyer la présence.");
          screen.render();
          return;
        }
        case "ping": {
          if (!arg) { screen.sys("Usage : /ping <url>"); return; }
          screen.busy = true; screen.render();
          try {
            const r = await pingUrl(arg.startsWith("http") ? arg : "https://" + arg);
            screen.sys((r.ok ? "✓ " : "✗ ") + arg + " — " + (r.ms ? r.ms + " ms" : "timeout") + (r.status ? " (HTTP " + r.status + ")" : "") + (r.error ? " — " + r.error : ""));
          } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "dns": {
          if (!arg) { screen.sys("Usage : /dns <domaine>"); return; }
          try {
            const r = await resolveDns(arg);
            screen.sys(arg + " → " + r.address + " (" + r.family + ")");
          } catch (e) { screen.sys("Erreur DNS : " + e.message); }
          return;
        }
        case "hash": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          const algo = (parts[0] || "sha256").toLowerCase();
          const text = parts.slice(1).join(" ");
          if (!text) { screen.sys("Usage : /hash <sha256|sha1|md5> <texte>"); return; }
          if (!["sha256","sha1","md5"].includes(algo)) { screen.sys("Algos : sha256, sha1, md5"); return; }
          screen.sys(algo.toUpperCase() + "(" + text + ") = " + hashStr(algo, text));
          return;
        }
        case "passgen": {
          const len = parseInt(arg, 10) || 16;
          screen.sys(randPass(len));
          return;
        }
        case "qr": {
          if (!arg) { screen.sys("Usage : /qr <texte>"); return; }
          screen.sys("QR : " + qrUrl(arg));
          return;
        }
        case "bmi": {
          const parts = String(arg).split(/\s+/).filter(Boolean).map(Number);
          if (parts.length < 2) { screen.sys("Usage : /bmi <poids kg> <taille cm>"); return; }
          const r = calcBmi(parts[0], parts[1]);
          screen.sys("IMC : " + r.bmi + " — " + r.label);
          return;
        }
        case "age": {
          if (!arg) { screen.sys("Usage : /age <YYYY-MM-DD>"); return; }
          screen.sys("Âge : " + calcAge(arg) + " ans");
          return;
        }
        case "geo": {
          if (!arg) { screen.sys("Usage : /geo <ip>"); return; }
          try {
            const r = await httpGet("https://ipapi.co/" + arg + "/json/");
            screen.sys(arg + " — " + (r.body ? (JSON.parse(r.body).country_name || "inconnu") + " / " + (JSON.parse(r.body).city || "inconnu") : "erreur"));
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "short": {
          if (!arg) { screen.sys("Usage : /short <url>"); return; }
          try {
            const r = await httpGet("https://tinyurl.com/api-create.php?url=" + encodeURIComponent(arg));
            screen.sys(r.body || "Erreur");
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "headers": {
          if (!arg) { screen.sys("Usage : /headers <url>"); return; }
          try {
            const r = await httpGet(arg.startsWith("http") ? arg : "https://" + arg);
            const h = r.headers || {};
            screen.sys("Status : " + r.status);
            for (const k of ["content-type","server","x-powered-by","cache-date","location"]) {
              if (h[k]) screen.sys("  " + k + " : " + h[k]);
            }
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "meta": {
          if (!arg) { screen.sys("Usage : /meta <url>"); return; }
          try {
            const r = await httpGet(arg.startsWith("http") ? arg : "https://" + arg);
            const body = r.body || "";
            const m = body.match(/<meta[^>]+>/gi) || [];
            m.forEach((x) => screen.sys(x.slice(0, 120)));
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "status": {
          if (!arg) { screen.sys("Usage : /status <url>"); return; }
          try {
            const r = await httpGet(arg.startsWith("http") ? arg : "https://" + arg);
            screen.sys(arg + " → HTTP " + r.status);
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "extract": {
          if (!arg) { screen.sys("Usage : /extract <url>"); return; }
          try {
            const r = await httpGet(arg.startsWith("http") ? arg : "https://" + arg);
            const links = (r.body || "").match(/<a[^>]+href=["']([^"']+)["']/gi) || [];
            links.slice(0, 15).forEach((l) => {
              const m = l.match(/href=["']([^"']+)["']/);
              if (m) screen.sys(m[1]);
            });
            if (!links.length) screen.sys("Aucun lien trouvé.");
          } catch (e) { screen.sys("Erreur : " + e.message); }
          return;
        }
        case "b64enc": {
          if (!arg) { screen.sys("Usage : /b64enc <texte>"); return; }
          screen.sys(b64enc(arg));
          return;
        }
        case "b64dec": {
          if (!arg) { screen.sys("Usage : /b64dec <base64>"); return; }
          try { screen.sys(b64dec(arg)); } catch { screen.sys("Base64 invalide."); }
          return;
        }
        case "rot13": {
          if (!arg) { screen.sys("Usage : /rot13 <texte>"); return; }
          screen.sys(rot13(arg));
          return;
        }
        case "ascii": {
          if (!arg) { screen.sys("Usage : /ascii <texte>"); return; }
          screen.sys(asciiFiglet(arg));
          return;
        }
        case "emoji": {
          screen.sys(randomEmoji());
          return;
        }
        case "fortune": {
          screen.sys(randomFortune());
          return;
        }
        case "fortune": {
          screen.sys(randomFortune());
          return;
        }
        case "banner": {
          if (!arg) { screen.sys("Usage : /banner <texte>"); return; }
          screen.sys(bannerFiglet(arg));
          return;
        }
        case "figlet": {
          if (!arg) { screen.sys("Usage : /figlet <texte>"); return; }
          screen.sys(asciiFiglet(arg));
          return;
        }
        case "cowsay": {
          if (!arg) { screen.sys("Usage : /cowsay <texte>"); return; }
          const w = Math.max(arg.length + 2, 10);
          const top = " " + "_".repeat(w) + "\n";
          const mid = " < " + padRight(arg, w - 2) + " >\n";
          const bot = " " + "-".repeat(w) + "\n";
          const cow = "        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\\\n                ||----w |\n                ||     ||";
          screen.sys(top + mid + bot + cow);
          return;
        }
        case "box": {
          if (!arg) { screen.sys("Usage : /box <texte>"); return; }
          screen.sys(boxText(arg.split("\n")));
          return;
        }
        case "tableau": {
          if (!arg) { screen.sys("Usage : /tableau <a,b;c,d>"); return; }
          const rows = arg.split(";").map((r) => r.split(","));
          const w = Math.max(...rows.map((r) => Math.max(...r.map((c) => vlen(c)))));
          const sep = "+" + rows[0].map(() => "-".repeat(w + 2)).join("+") + "+";
          let out = sep + "\n";
          rows.forEach((r) => {
            out += "| " + r.map((c) => padRight(c, w)).join(" | ") + " |\n" + sep + "\n";
          });
          screen.sys(out);
          return;
        }
        case "progress": {
          const pct = parseInt(arg, 10) || 0;
          const w = 20;
          const filled = Math.round((pct / 100) * w);
          const bar = "#".repeat(filled) + "-".repeat(w - filled);
          screen.sys("[" + bar + "] " + pct + "%");
          return;
        }
        case "calendar": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          const now = new Date();
          const y = parts[0] ? parseInt(parts[0], 10) : now.getFullYear();
          const m = parts[1] ? parseInt(parts[1], 10) : now.getMonth() + 1;
          screen.sys(calendar(y, m));
          return;
        }
        case "clock": {
          screen.sys(clockAscii());
          return;
        }
        case "ruler": {
          screen.sys(ruler(parseInt(arg, 10) || 40));
          return;
        }
        case "frame": {
          if (!arg) { screen.sys("Usage : /frame <texte>"); return; }
          screen.sys(frameText(arg));
          return;
        }
        case "center": {
          if (!arg) { screen.sys("Usage : /center <texte>"); return; }
          screen.sys(padCenter(arg, 40));
          return;
        }
        case "justify": {
          if (!arg) { screen.sys("Usage : /justify <texte>"); return; }
          screen.sys(arg.split(" ").join("   "));
          return;
        }
        case "wrap": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          const w = parseInt(parts.pop(), 10) || 40;
          const text = parts.join(" ");
          let line = "", out = "";
          for (const word of text.split(" ")) {
            if ((line + word).length > w) { out += line + "\n"; line = word; }
            else line += (line ? " " : "") + word;
          }
          out += line;
          screen.sys(out);
          return;
        }
        case "repeat": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          const n = parseInt(parts.pop(), 10) || 1;
          const text = parts.join(" ");
          screen.sys(text.repeat(n));
          return;
        }
        case "mirror": {
          if (!arg) { screen.sys("Usage : /mirror <texte>"); return; }
          screen.sys(mirror(arg));
          return;
        }
        case "flip": {
          if (!arg) { screen.sys("Usage : /flip <texte>"); return; }
          screen.sys(flip(arg));
          return;
        }
        case "strikethrough": {
          if (!arg) { screen.sys("Usage : /strikethrough <texte>"); return; }
          screen.sys(strikethrough(arg));
          return;
        }
        case "underline": {
          if (!arg) { screen.sys("Usage : /underline <texte>"); return; }
          screen.sys(underline(arg));
          return;
        }
        case "boxed": {
          if (!arg) { screen.sys("Usage : /boxed <texte>"); return; }
          screen.sys(frameText(arg, "═"));
          return;
        }
        case "sep": {
          const ch = arg || "─";
          screen.sys(ch.repeat(40));
          return;
        }
        case "whois": {
          if (!arg) { screen.sys("Usage : /whois <domaine>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await whoisLookup(arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "dnslookup": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (!parts[0]) { screen.sys("Usage : /dnslookup <domaine> [type]"); return; }
          screen.sys(parts[0] + " → " + dnsLookup(parts[0], parts[1] || "A"));
          return;
        }
        case "ssl": {
          if (!arg) { screen.sys("Usage : /ssl <domaine>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await sslInfo(arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "ping-multi": {
          if (!arg) { screen.sys("Usage : /ping-multi <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await pingMulti(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "extract-emails": {
          if (!arg) { screen.sys("Usage : /extract-emails <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await extractEmails(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "extract-links": {
          if (!arg) { screen.sys("Usage : /extract-links <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await extractLinksWeb(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "extract-images": {
          if (!arg) { screen.sys("Usage : /extract-images <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await extractImages(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "download-info": {
          if (!arg) { screen.sys("Usage : /download-info <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await downloadInfo(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "favicon": {
          if (!arg) { screen.sys("Usage : /favicon <domaine>"); return; }
          screen.sys(faviconUrl(arg));
          return;
        }
        case "robots": {
          if (!arg) { screen.sys("Usage : /robots <domaine>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await robotsTxt(arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "sitemap": {
          if (!arg) { screen.sys("Usage : /sitemap <domaine>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await sitemapXml(arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "wp-detect": {
          if (!arg) { screen.sys("Usage : /wp-detect <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await wpDetect(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "tech-detect": {
          if (!arg) { screen.sys("Usage : /tech-detect <url>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await techDetect(arg.startsWith("http") ? arg : "https://" + arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "url-encode": {
          if (!arg) { screen.sys("Usage : /url-encode <texte>"); return; }
          screen.sys(urlEncode(arg));
          return;
        }
        case "url-decode": {
          if (!arg) { screen.sys("Usage : /url-decode <texte>"); return; }
          screen.sys(urlDecode(arg));
          return;
        }
        case "html-encode": {
          if (!arg) { screen.sys("Usage : /html-encode <texte>"); return; }
          screen.sys(htmlEncode(arg));
          return;
        }
        case "html-decode": {
          if (!arg) { screen.sys("Usage : /html-decode <texte>"); return; }
          screen.sys(htmlDecode(arg));
          return;
        }
        case "jwt-decode": {
          if (!arg) { screen.sys("Usage : /jwt-decode <token>"); return; }
          screen.sys(jwtDecode(arg));
          return;
        }
        case "csv-to-json": {
          if (!arg) { screen.sys("Usage : /csv-to-json <texte CSV>"); return; }
          screen.sys(csvToJson(arg));
          return;
        }
        case "dice": {
          if (!arg) { screen.sys("Usage : /dice <faces>"); return; }
          screen.sys("Dé : " + diceRoll(parseInt(arg, 10) || 6));
          return;
        }
        case "coin": {
          screen.sys(coinFlip());
          return;
        }
        case "rand": {
          const parts = String(arg).split(/\s+/).filter(Boolean).map(Number);
          if (parts.length < 2) { screen.sys("Usage : /rand <min> <max>"); return; }
          screen.sys(randRange(parts[0], parts[1]));
          return;
        }
        case "flip-coin": {
          screen.sys(coinFlip());
          return;
        }
        case "dice-roll": {
          screen.sys("Dé : " + diceRoll(6));
          return;
        }
        case "lorem": {
          const n = parseInt(arg, 10) || 5;
          screen.sys(lorem(n));
          return;
        }
        case "password": {
          const len = parseInt(arg, 10) || 16;
          screen.sys(passwordGen(len));
          return;
        }
        case "color": {
          screen.sys(randomColor());
          return;
        }
        case "color-hex": {
          screen.sys(colorName(randomColor()) + " " + randomColor());
          return;
        }
        case "weather": {
          screen.sys("Météo : données non disponibles (clé API requise)");
          return;
        }
        case "currency": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 3) { screen.sys("Usage : /currency <montant> <de> <à>"); return; }
          screen.sys(convertCurrency(parts[0], parts[1], parts[2]));
          return;
        }
        case "conversion": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 3) { screen.sys("Usage : /conversion <de> <à> <montant>"); return; }
          screen.sys(convertCurrency(parts[2], parts[0], parts[1]));
          return;
        }
        case "tip": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 2) { screen.sys("Usage : /tip <montant> <pourcentage>"); return; }
          screen.sys(tipCalc(parts[0], parts[1]));
          return;
        }
        case "tax": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 2) { screen.sys("Usage : /tax <montant> <taux>"); return; }
          screen.sys(taxCalc(parts[0], parts[1]));
          return;
        }
        case "discount": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 2) { screen.sys("Usage : /discount <prix> <réduction>"); return; }
          screen.sys(discountCalc(parts[0], parts[1]));
          return;
        }
        case "loan": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 3) { screen.sys("Usage : /loan <montant> <taux> <mois>"); return; }
          screen.sys(loanCalc(parts[0], parts[1], parts[2]));
          return;
        }
        case "disk": {
          const d = diskUsage(process.cwd());
          screen.sys("Disque : " + Math.round(d.used / 1024 / 1024 / 1024 * 10) / 10 + " Go / " + Math.round(d.total / 1024 / 1024 / 1024 * 10) / 10 + " Go (" + d.pct + "% utilisé)");
          return;
        }
        case "cpu": {
          screen.sys(cpuInfo());
          return;
        }
        case "mem": case "ram": {
          const m = memInfo();
          screen.sys("RAM : " + Math.round(m.used / 1024 / 1024) + " Mo / " + Math.round(m.total / 1024 / 1024) + " Mo (" + m.pct + "% utilisé)");
          return;
        }
        case "uptime": {
          screen.sys("Démarré il y a : " + sysUptimeBoot());
          return;
        }
        case "env": {
          if (!arg) { screen.sys(envAll()); return; }
          screen.sys(arg + " = " + envVar(arg));
          return;
        }
        case "whoami": {
          screen.sys(whoami());
          return;
        }
        case "hostname": {
          screen.sys(hostname());
          return;
        }
        case "ip": {
          screen.sys(localIp());
          return;
        }
        case "pubip": {
          screen.busy = true; screen.render();
          try { screen.sys("IP publique : " + await publicIp()); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "netstat": {
          screen.sys(netIfaces());
          return;
        }
        case "ps": {
          screen.busy = true; screen.render();
          try { screen.sys(await psList()); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "kill": {
          if (!arg) { screen.sys("Usage : /kill <pid>"); return; }
          screen.busy = true; screen.render();
          try { screen.sys(await killPid(arg)); } catch (e) { screen.sys("Erreur : " + e.message); }
          screen.busy = false; screen.render();
          return;
        }
        case "which": {
          if (!arg) { screen.sys("Usage : /which <commande>"); return; }
          screen.sys(await whichCmd(arg));
          return;
        }
        case "path": {
          screen.sys(process.env.PATH || "");
          return;
        }
        case "hex": {
          if (!arg) { screen.sys("Usage : /hex <fichier>"); return; }
          screen.sys(hexDump(arg));
          return;
        }
        case "lines": {
          if (!arg) { screen.sys("Usage : /lines <fichier>"); return; }
          screen.sys(countLines(arg));
          return;
        }
        case "words": {
          if (!arg) { screen.sys("Usage : /words <fichier>"); return; }
          screen.sys(countWords(arg));
          return;
        }
        case "grep": {
          const parts = String(arg).split(/\s+/).filter(Boolean);
          if (parts.length < 2) { screen.sys("Usage : /grep <motif> <fichier>"); return; }
          screen.sys(grepFile(parts[0], parts.slice(1).join(" ")));
          return;
        }
        case "arch": {
          screen.sys(sysArch());
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
      denied: screen.denied || {},
      permit: (n) => { screen.permits = screen.permits || {}; screen.permits[n] = true; try { screen.saveRules && screen.saveRules(); } catch { /* ignore */ } },
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
        if (lockHit && aura13Locked() && !state.sandbox) {
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
  let args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) { console.log(`${PKG.version} (build ${buildId()})`); return; }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`AuraCode v${PKG.version}\n\nUsage:\n  auracode              Démarre l'assistant (intro + chat)\n  auracode setup          Écran d'installation pastel (clé, modèle, effort)\n  auracode login          Connexion VTH (navigateur localhost:3000)\n  auracode logout         Oublie la clé\n  auracode new            Nouvelle conversation\n  auracode update         Met à jour le .exe (Windows)
  auracode uninstall      Désinstalle (confirmation, tokens effacés)\n  auracode --model X      Modèle (aura-1.1, aura-1.2, aura-1.3, aura-1.1-code, aura-2)\n  auracode --effort X     Effort (low, middle, high, xhigh)\n  auracode "question"       Réponse unique sans ouvrir l'interface
  auracode -p "question" [--output-format=json]  Réponse directe scriptable (pipe/CI)
  auracode --sandbox       Sandbox admin Aura 1.3 (nouveau terminal via /admin-sandbox)
  Plein écran : /new /model /effort /lang /sessions /conv /resume /retry /bash /read /run /write /mkdir /touch /init /rewind /cost /skill /auto /permissions /admin-stats /admin-sandbox /reach /doctor /stats /quota /image /copy /export /theme /update /clear /help (/tape /help pour tout voir, !cmd = shell direct, Ctrl+O = switch conv)\n`);
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
  let printMode = false, outFormat = "text", sandboxMode = false;
  args = args.filter((a) => {
    if (a === "-p" || a === "--print") { printMode = true; return false; }
    if (a === "--sandbox") { sandboxMode = true; return false; }
    const m = /^--output-format=(.+)$/.exec(a);
    if (m) { outFormat = m[1] === "json" ? "json" : "text"; return false; }
    return true;
  });
  if (sandboxMode) model = "aura-1.3";

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
    if ((model === "aura-2" || (model === "aura-1.3" && aura13Locked())) && !sandboxMode) {
      console.log(unavailableText(model).join("\n"));
      return;
    }
    let key = getKey() || await vthAccess() || "";
    if (!key) { console.log("Pas connecté. Lance : auracode login"); return; }
    let sid = getSessionId();
    try {
      if (!sid) sid = await newSession(key, model);
      const d = await api("/api/chat", { message: q, session_id: sid, model, effort }, key);
      if (printMode && outFormat === "json") console.log(JSON.stringify({ model, effort, session_id: sid, answer: (d.reply || "").trim() }));
      else console.log("\n" + (d.reply || "").trim() + "\n");
    } catch (e) {
      const er = e.data || {};
      const lockHit = /aura 1\.3/i.test(String(er.hint || "") + " " + String(er.error || ""));
      if (lockHit && aura13Locked() && !sandboxMode) {
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
  const state = { key, model, effort, lang, theme: "pastel", sandbox: sandboxMode };
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
