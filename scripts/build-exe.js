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

fs.writeFileSync(
  path.join(ROOT, "sea-config.json"),
  JSON.stringify({
    main: "./bin/auracode.js",
    output: "./dist/sea-prep.blob",
    disableExperimentalSEAWarning: true,
  })
);
execSync("node --experimental-sea-config sea-config.json", { cwd: ROOT, stdio: "inherit" });
fs.copyFileSync(process.execPath, path.join(dist, "auracode.exe"));
execSync(
  `npx --yes postject ${path.join(dist, "auracode.exe")} NODE_SEA_BLOB ${path.join(dist, "sea-prep.blob")} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e840d43aa3013196`,
  { stdio: "inherit" }
);
console.log("OK: " + path.join(dist, "auracode.exe"));
