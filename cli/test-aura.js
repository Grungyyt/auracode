// cli/test-aura.js — tests unitaires des helpers purs (shared + backend, sans TUI ni réseau).
// Usage (depuis la racine du repo) : node cli/test-aura.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = __dirname;
const sharedSrc = fs.readFileSync(path.join(ROOT, "src", "shared.js"), "utf8");
const backendSrc = fs.readFileSync(path.join(ROOT, "src", "backend.js"), "utf8");
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.log("  FAIL " + label); }
};
const tests = `
;(function runTests() {
  // --- skillParse ---
  const s1 = skillParse("# Ma Comp\\n> Fait des trucs\\ncorps ici");
  ok(s1.name === "Ma Comp", "skillParse: nom via #");
  ok(s1.desc === "Fait des trucs", "skillParse: desc via >");
  const s2 = skillParse("juste une ligne");
  ok(s2.name === "juste une ligne", "skillParse: repli première ligne");

  // --- listSkills ---
  const skDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-sk-"));
  fs.writeFileSync(path.join(skDir, "b.md"), "# Bee\\n> fait b\\nxxx");
  fs.writeFileSync(path.join(skDir, "a.md"), "# Aye\\n> fait a\\nyyy");
  fs.writeFileSync(path.join(skDir, "skip.txt"), "ignoré");
  const sk = listSkills(skDir);
  ok(sk.length === 2, "listSkills: 2 md (txt ignoré)");
  ok(sk[0].id === "a" && sk[1].id === "b", "listSkills: triées par id");
  ok(sk[0].desc === "fait a", "listSkills: desc lue");

  // --- backupList ---
  const bkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aura-bk-"));
  const w = (name, time) => fs.writeFileSync(path.join(bkRoot, name),
    JSON.stringify({ file: "/x/" + name, rel: name, time, session: "s", existed: true, content: "c" }));
  w("old.bak.json", 1000);
  w("new.bak.json", 2000);
  fs.writeFileSync(path.join(bkRoot, "note.txt"), "ignoré");
  const bl = backupList(bkRoot);
  ok(bl.length === 2, "backupList: 2 backups (.txt ignoré)");
  ok(bl[0].time === 2000 && bl[0].n === 1, "backupList: plus récent d'abord, n=1");
  ok(bl[1].n === 2, "backupList: numérotation");

  // --- snapshotFile ---
  const snapRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aura-sn-"));
  const target = path.join(snapRoot, "doc.txt");
  fs.writeFileSync(target, "v1");
  const fp1 = snapshotFile(target, "sess1", snapRoot);
  ok(typeof fp1 === "string" && fs.existsSync(fp1), "snapshotFile: backup créé");
  const m1 = JSON.parse(fs.readFileSync(fp1, "utf8"));
  ok(m1.existed === true && m1.content === "v1", "snapshotFile: contenu précédent gardé");
  const fp2 = snapshotFile(path.join(snapRoot, "neuf.txt"), "sess1", snapRoot);
  const m2 = JSON.parse(fs.readFileSync(fp2, "utf8"));
  ok(m2.existed === false && m2.content === null, "snapshotFile: fichier nouveau marqué");
  fs.mkdirSync(path.join(snapRoot, "sub"), { recursive: true });
  for (let i = 0; i < 55; i++) fs.writeFileSync(path.join(snapRoot, "sub", "f" + i + ".bak.json"),
    JSON.stringify({ file: target, rel: "doc.txt", time: 1000 + i, session: "s", existed: true, content: "v" + i }));
  snapshotFile(target, "sess1", snapRoot);
  ok(backupList(snapRoot).length === 50, "snapshotFile: prune à 50");

  // --- sessionSpend (miroir barre de statut) ---
  const msgs = [
    { role: "user", text: "abcdefgh", meta: {} },
    { role: "assistant", text: "x".repeat(40), meta: { tok: 25 } },
    { role: "system", text: "y".repeat(100) },
  ];
  ok(sessionSpend(msgs) === 2 + 25, "sessionSpend: meta.tok sinon len/4, système ignoré");

  // --- denyHit / DENY_MSG ---
  ok(denyHit({ denied: { exec: true } }, "exec") === true, "denyHit: refus détecté");
  ok(denyHit({}, "exec") === false, "denyHit: pas de règle");
  ok(denyHit(null, "exec") === false, "denyHit: ui nul");
  ok(String(DENY_MSG("exec")).includes("exec"), "DENY_MSG: nomme l'outil");

  // --- formatAdminStats ---
  const fake = { days: 14, totals: { requests: 100, tokens: 5000, errors: 2, users_active: 3, users_total: 5, locked_now: 1, avg_latency_ms: 42.5 }, per_model: [{ model: "aura-1.1", requests: 90, tokens: 4000, errors: 1 }], per_day: [{ day: "2026-10-11", requests: 10, tokens: 500, users: 2 }], top_users: [{ user_id: "vth:1", requests: 50, tokens: 3000, images: 2 }] };
  const fs1 = formatAdminStats(fake);
  ok(fs1.includes("100") && fs1.includes("aura-1.1"), "formatAdminStats: totaux + modele");
  ok(fs1.includes("vth:1") && fs1.includes("2026-10-11"), "formatAdminStats: top + jours");
  ok(typeof formatAdminStats(null) === "string", "formatAdminStats: robuste au vide");

  // --- sandboxSpawnArgs ---
  const sb = sandboxSpawnArgs();
  ok(sb.launcher === "cmd.exe", "sandbox: launcher cmd.exe");
  ok(sb.args[0] === "/c" && sb.args[1] === "start", "sandbox: start nouveau terminal");
  ok(sb.args.includes("--sandbox") && sb.args.includes("/k"), "sandbox: flag + /k");
  ok(sb.args.some((a) => String(a).includes("Sandbox")), "sandbox: titre fenetre");

  // --- unavailableText ---
  const u1 = unavailableText("aura-1.3");
  ok(Array.isArray(u1) && u1.join(" ").includes("préparons Aura 1.3"), "unavailable: 1.3 annonce la préparation");
  const u2 = unavailableText("aura-2");
  ok(u2.join(" ").includes("préparons Aura 2"), "unavailable: Aura 2 annoncée");

  // --- auraFile ---
  ok(typeof auraFile() === "string", "auraFile: retourne une string (vide si absent)");
})();
`;
eval(sharedSrc + "\n" + backendSrc + "\n" + tests);
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
