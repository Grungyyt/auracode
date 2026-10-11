// Regénère cli/bin/auracode.js depuis cli/src/*.js — NE PAS ÉDITER bin/auracode.js À LA MAIN.
// Usage : node scripts/bundle.js  (ou `npm run build` dans cli/)
// La concaténation partage une seule portée (comme l'ancien monolithe) :
// aucun require() entre les morceaux, juste des builtins Node.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "cli");
const PARTS = ["shared.js", "backend.js", "ui.js", "main.js"];

const BANNER = [
  "#!/usr/bin/env node",
  "/* AuraCode — agent terminal connecté au cloud VTH (api.ia.vth-mc.fr).",
  " * Zéro dépendance, Node 18+. Stockage privé : sessions sur ton VPS.",
  " * FICHIER GÉNÉRÉ — ne pas éditer. Sources : cli/src/shared.js (commun),",
  " * backend.js (API/agent/outils/auth), ui.js (affichage terminal), main.js (commandes).",
  " * Régénérer : node scripts/bundle.js (ou `npm run build` dans cli/).",
  " */",
  "",
].join("\n");

let out = BANNER;
for (const p of PARTS) {
  const src = fs.readFileSync(path.join(ROOT, "src", p), "utf8").replace(/\s+$/, "");
  if (!src) throw new Error("morceau vide : " + p);
  out += src + "\n";
}
if (!out.endsWith("\n")) out += "\n";
fs.writeFileSync(path.join(ROOT, "bin", "auracode.js"), out);
console.log("OK: cli/bin/auracode.js régénéré depuis " + PARTS.join(", "));
