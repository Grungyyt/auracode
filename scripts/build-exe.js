// Build auracode.exe via Node SEA (Single Executable Application).
// Usage (sur Windows) : node scripts/build-exe.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "cli");
const pkg = require(path.join(ROOT, "package.json"));

// Garde-fou : version synchronisée entre package.json et le binaire.
const binSrc = fs.readFileSync(path.join(ROOT, "bin", "auracode.js"), "utf8");
if (!binSrc.includes(`version: "${pkg.version}"`)) {
  console.error(`Version mismatch: package.json=${pkg.version}, mets à jour APP PKG.version dans bin/auracode.js`);
  process.exit(1);
}

const dist = path.join(ROOT, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// Trouve le VRAI node.exe (>50 Mo). process.execPath peut être un
// shim (Chocolatey/Scoop) dans lequel postject ne trouve pas le sentinel.
function findRealNode() {
  const cands = new Set([process.execPath]);
  try {
    const out = require("child_process").execSync("where.exe node", { encoding: "utf8" });
    out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((p) => cands.add(p));
  } catch { /* ignore */ }
  cands.add("C:\\Program Files\\nodejs\\node.exe");
  let best = null;
  for (const p of cands) {
    try {
      const st = fs.statSync(p);
      if (st.isFile() && st.size > 50 * 1024 * 1024 && (!best || st.size > best.size)) {
        best = { path: p, size: st.size };
      }
    } catch { /* ignore */ }
  }
  if (!best) {
    throw new Error("node.exe réel introuvable (que des shims). Réinstalle Node via nodejs.org.");
  }
  console.log(`node.exe réel : ${best.path} (${(best.size / 1048576).toFixed(0)} Mo)`);
  return best.path;
}

fs.writeFileSync(
  path.join(ROOT, "sea-config.json"),
  JSON.stringify({
    main: "./bin/auracode.js",
    output: "./dist/sea-prep.blob",
    disableExperimentalSEAWarning: true,
  })
);
execSync("node --experimental-sea-config sea-config.json", { cwd: ROOT, stdio: "inherit" });
const exePath = path.join(dist, "auracode.exe");
fs.copyFileSync(findRealNode(), exePath);
// Garde-fou : si le binaire ne contient pas le sentinel, postject échouera.
// (ex: Node 24 local). Dans ce cas, laisse la CI construire avec Node 20.
const binBuf = fs.readFileSync(exePath);
if (!binBuf.includes(Buffer.from("NODE_SEA_FUSE", "utf8"))) {
  throw new Error(
    "Ce node.exe ne contient pas le sentinel SEA. " +
    "Pousse le tag et laisse la CI construire le .exe avec Node 20."
  );
}
execSync(
  `npx --yes postject ${exePath} NODE_SEA_BLOB ${path.join(dist, "sea-prep.blob")} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e840d43aa3013196`,
  { stdio: "inherit" }
);
console.log("OK: " + path.join(dist, "auracode.exe"));
