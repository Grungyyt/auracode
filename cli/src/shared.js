// cli/src/shared.js — constantes, helpers purs et petits moteurs (aucune dépendance métier).
// Bundlé dans cli/bin/auracode.js via `node scripts/bundle.js`.
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const net = require("net");
const { exec, execSync, spawn } = require("child_process");
const https = require("https");
const http = require("http");

const HOME = path.join(os.homedir(), ".auracode");
const CONFIG_FILE = path.join(HOME, "config.json");
const SESSIONS_FILE = path.join(HOME, "sessions.json");
const HIST_FILE = path.join(HOME, "history.json");

const PKG = { version: "1.4.0.0.16" };
const DISCORD_CLIENT_ID = "1560995251307552848";
let discordSock = null;
let discordReady = false;
let discordPending = [];
const DISCORD_START = Date.now();
let pipeIdx = 0;

function discordFrame(obj) {
  const str = JSON.stringify(obj);
  const len = Buffer.byteLength(str);
  const buf = Buffer.alloc(4 + len);
  buf.writeUInt32LE(len, 0);
  buf.write(str, 4);
  return buf;
}

function discordSendRaw(obj) {
  if (!discordSock || discordSock.destroyed) {
    discordPending.push(obj);
    return;
  }
  try { discordSock.write(discordFrame(obj)); } catch { /* ignore */ }
}

function discordTryPipe(i) {
  try {
    const s = net.createConnection(`\\\\.\\pipe\\discord-ipc-${i}`);
    let buf = Buffer.alloc(0);
    s.on("connect", () => {
      discordSock = s;
      pipeIdx = i;
      discordSendRaw({ v: 1, client_id: DISCORD_CLIENT_ID });
    });
    s.on("data", (chunk) => {
      try {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 4) {
          const len = buf.readUInt32LE(0);
          if (len <= 0 || len > 10485760) { buf = Buffer.alloc(0); break; }
          if (buf.length < 4 + len) break;
          let payload = null;
          try { payload = JSON.parse(buf.slice(4, 4 + len).toString("utf8")); } catch { buf = buf.slice(4 + len); continue; }
          buf = buf.slice(4 + len);
          if (payload && payload.evt === "READY") {
            discordReady = true;
            while (discordPending.length) discordSendRaw(discordPending.shift());
          }
        }
      } catch { /* ignore parse errors */ }
    });
    s.on("error", () => { try { s.destroy(); } catch { /* ignore */ } });
    s.on("close", () => {
      if (discordSock === s) { discordSock = null; discordReady = false; setTimeout(discordReconnect, 15000); }
    });
    return true;
  } catch { return false; }
}

function discordConnect() {
  if (discordSock) return;
  for (let i = 0; i < 10; i++) {
    if (discordTryPipe(i)) return;
  }
  setTimeout(discordConnect, 15000);
}

function discordReconnect() { discordConnect(); }

function discordPresence(state, details) {
  discordSendRaw({
    cmd: "SET_ACTIVITY",
    args: {
      pid: process.pid,
      activity: {
        name: "AuraCode",
        state: String(state || "").slice(0, 128),
        details: String(details || "").slice(0, 128),
        timestamps: { start: DISCORD_START },
        assets: { large_text: "AuraCode by VTH Group" },
        instance: false
      },
      nonce: String(Date.now())
    }
  });
}

function discordClear() {
  discordSendRaw({
    cmd: "SET_ACTIVITY",
    args: { pid: process.pid, activity: null, nonce: String(Date.now()) }
  });
}

function discordStatus() {
  return {
    connected: !!discordSock && !discordSock.destroyed,
    ready: discordReady,
    pipe: discordSock ? `discord-ipc-${pipeIdx}` : null,
    clientId: DISCORD_CLIENT_ID
  };
}

// ---------- Helpers HTTP / réseau ----------
const httpGet = (url, timeout = 10000) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      u,
      { timeout, headers: { "User-Agent": "AuraCode/1.4" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });

const httpPost = (url, body, timeout = 10000) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const req = lib.request(
      u,
      {
        method: "POST",
        timeout,
        headers: {
          "User-Agent": "AuraCode/1.4",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });

const resolveDns = (host) =>
  new Promise((resolve, reject) => {
    dns.lookup(host, (err, address, family) =>
      err ? reject(err) : resolve({ address, family: family === 4 ? "IPv4" : "IPv6" })
    );
  });

const dns = require("dns");

const hashStr = (algo, text) => crypto.createHash(algo).update(text).digest("hex");

const randPass = (len = 16) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

const b64enc = (t) => Buffer.from(t).toString("base64");
const b64dec = (t) => Buffer.from(t, "base64").toString("utf8");

const rot13 = (t) => t.replace(/[a-zA-Z]/g, (c) =>
  String.fromCharCode(((c <= "Z" ? 65 : 97) + ((c.toUpperCase().charCodeAt(0) - (c <= "Z" ? 65 : 97) + 13) % 26)))
);

const qrUrl = (text) => `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;

const pingUrl = async (url) => {
  const t0 = Date.now();
  try {
    const r = await httpGet(url, 5000);
    return { ok: true, ms: Date.now() - t0, status: r.status };
  } catch (e) { return { ok: false, ms: Date.now() - t0, error: e.message }; }
};

const calcBmi = (weightKg, heightCm) => {
  const h = heightKg ? heightKg / 100 : heightKg / 100;
  const bmi = weightKg / (h * h);
  return { bmi: Math.round(bmi * 10) / 10, label: bmi < 18.5 ? "maigreur" : bmi < 25 ? "normal" : bmi < 30 ? "surpoids" : "obésité" };
};

const calcAge = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const emojiList = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😮","😯","😲","😳","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😩","😫","😤","😠","😡","🤬","😈","👿","💀","💩","🤡","👹","👺","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😺","😸","😹","😻","😼","😽","🙀","😿","😾"];
const randomEmoji = () => emojiList[Math.floor(Math.random() * emojiList.length)];

const fortunes = [
  "La chance sourit aux audacieux.",
  "Une surprise agréable vous attend cette semaine.",
  "Ne craignez pas le changement, embrassez-le.",
  "Votre travail acharné portera bientôt ses fruits.",
  "L'amitié véritable est un trésor inestimable.",
  "Une opportunité inattendue se présente à vous.",
  "La patience est la clé du succès.",
  "Vous allez découvrir quelque chose d'extraordinaire.",
  "Écoutez votre intuition, elle ne vous trompe pas.",
  "Une rencontre marquante approche."
];
const randomFortune = () => fortunes[Math.floor(Math.random() * fortunes.length)];

// ---------- Mise en avant / présentation ----------
const boxChars = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" };
const padRight = (s, len) => s + " ".repeat(Math.max(0, len - s.length));
const padLeft = (s, len) => " ".repeat(Math.max(0, len - s.length)) + s;
const padCenter = (s, len) => {
  const p = Math.max(0, len - s.length);
  return " ".repeat(Math.floor(p / 2)) + s + " ".repeat(Math.ceil(p / 2));
};
const boxText = (lines) => {
  const w = Math.max(...lines.map((l) => l.length));
  const top = boxChars.tl + boxChars.h.repeat(w + 2) + boxChars.tr;
  const bot = boxChars.bl + boxChars.h.repeat(w + 2) + boxChars.br;
  const rows = lines.map((l) => boxChars.v + " " + padRight(l, w) + " " + boxChars.v);
  return [top, ...rows, bot].join("\n");
};
const frameText = (text, ch = "─") => {
  const w = Math.max(...text.split("\n").map((l) => l.length), 10);
  const top = ch.repeat(w + 2);
  const mid = text.split("\n").map((l) => ch + " " + padRight(l, w) + " " + ch).join("\n");
  return [top, mid, top].join("\n");
};
const vlen = (s) => stripAnsi(s).length;
const bannerFiglet = (text) => {
  const map = {
    "A":" ██╗   ██╗ ██████╗ ██████╗ \n ██║   ██║██╔═══██╗██╔══██╗\n  ██║ ██╔╝██║   ██║██████╔╝\n   █████╔╝██║   ██║██╔═══╝ \n    ██╔═╝ ██║   ██║██║     \n   ██║   ╚██████╔╝██████╗ \n   ╚═╝    ╚═════╝ ╚═════╝ ",
    "B":" ██████╗ ██████╗ \n ██╔══██╗██╔══██╗\n ██████╔╝██████╔╝\n ██╔══██╗██╔═══╝ \n ██║  ██║██████╔╝\n ╚═╝   ╚═╝╚═════╝ ",
    "C":"  ██████╗\n ██╔════╝\n ██║     \n ██║     \n ╚██████╗\n  ╚═════╝ ",
    "D":" ██████╗ \n ██╔══██╗\n ██████╔╝\n ██╔══██╗\n ██████╔╝\n ╚═════╝ ",
    "E":" ██████╗\n ██╔══██╗\n ██████╔╝\n ██╔═══╝ \n ██╔══██╗\n ██████╔╝",
    "F":" ██████╗\n ██╔══██╗\n ██████╔╝\n ██╔═══╝ \n ██║     \n ██║     ",
    "G":"  ██████╗\n ██╔═══██╗\n ██║     \n ██║   ██╗\n ╚██████╔╝\n  ╚═════╝ ",
    "H":" ██╗   ██╗\n ██║   ██║\n ███████║\n ██╔══██║\n ██║  ██║\n ╚═╝   ╚═╝",
    "I":"  ██████╗\n      ██║\n     ██║\n    ██║\n ██████╔╝\n ╚══════╝ ",
    "J":"        ██║\n        ██║\n ██╗   ██║\n ██║   ██║\n ╚██████╔╝\n  ╚═════╝ ",
    "K":" ██╗   ██╗\n ██║   ██║\n ███████║\n ██╔═██╗ \n ██║  ██╗\n ██║   ██╗",
    "L":" ██╗    \n ██║    \n ██║    \n ██║    \n ███████╗\n ╚══════╝",
    "M":" ██╗   ██╗ ██╗   ██╗\n ████████║ ████████║\n ██╔════██║ ██╔════██║\n ██║     ██║ ██║     ██║\n ██║     ██║ ███████║\n ╚═╝     ╚═╝ ╚══════╝",
    "N":" ██╗   ██╗\n ████ ██║\n ██ ████║\n ██╗ ██║\n ██║  ██║\n ╚═╝   ╚═╝",
    "O":"  ██████╗\n ██╔══██╗\n ███████║\n ██╔══██║\n ██████╔╝\n ╚═════╝ ",
    "P":" ██████╗ \n ██╔══██╗\n ██████╔╝\n ██╔═══╝ \n ██║     \n ██║     ",
    "Q":"  ██████╗\n ██╔══██╗\n ███████║\n ██╔══██║\n ██████╔╝\n ╚══════╝ ",
    "R":" ██████╗ \n ██╔══██╗\n ██████╔╝\n ██╔═██╗ \n ██║  ██╗\n ██║   ██╗",
    "S":" ███████╗\n ██╔════╝\n  ██████╗\n ╚════██║\n ███████║\n ╚══════╝",
    "T":" ████████╗\n     ██╔╝\n    ██╔╝\n   ██╔╝\n   ██║\n   ╚═╝",
    "U":" ██╗   ██╗\n ██║   ██║\n ██║   ██║\n ██║   ██║\n ╚██████╔╝\n  ╚═════╝ ",
    "V":" ██╗   ██╗\n ██║   ██║\n ██║   ██║\n ╚██╗ ██╔╝\n  ╚████╔╝\n   ╚══╝ ",
    "W":" ██╗   ██╗ ██╗   ██╗\n ██║   ██║ ██║   ██║\n ██║   ██║ ██║   ██║\n ██║   ██║ ██║   ██║\n ╚██████╔╝╚██████╔╝\n  ╚═════╝ ╚═════╝ ",
    "X":" ██╗ ██╗\n  ████╔╝\n   ██╔╝\n   ██╔╝\n  ████╗\n ██╗ ██╗",
    "Y":" ██╗   ██╗\n  █████╔╝\n   ████╔╝\n   ██╔╝\n   ██║\n   ██║",
    "Z":" ██████╗\n     ╚██╔╝\n    ██╔╝\n   ██╔╝\n  ██████╗"
  };
  return text.toUpperCase().split("").map((c) => map[c] || " ? ").join("   ");
};
const calendar = (year, month) => {
  const d = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const start = d.getDay();
  const rows = ["Lu Ma Me Je Ve Sa Di"];
  let line = "   ".repeat(start);
  for (let i = 1; i <= days; i++) {
    line += (i < 10 ? " " : "") + i + " ";
    if ((start + i) % 7 === 0 || i === days) { rows.push(line); line = ""; }
  }
  return rows.join("\n");
};
const clockAscii = () => {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  return ["┌─────────┐","│ " + padLeft(h,2) + ":" + padLeft(m,2) + " │","└─────────┘","  " + now.toLocaleTimeString()].join("\n");
};
const ruler = (len = 40) => "1234567890" + " ".repeat(len - 10) + "\n" + "----------|" + "-".repeat(len - 10);
const strikethrough = (t) => t.split("").map((c) => c + "\u0336").join("");
const underline = (t) => t.split("").map((c) => c + "\u0332").join("");
const mirror = (t) => t.split("").reverse().join("");
const flip = (t) => t.split("\n").map((l) => l.split("").reverse().join("")).join("\n");


const asciiFiglet = (text) => {
  const map = {
    "A":"  /\\  \n /__\\\n|    |",
    "B":"|--|\n|__|",
    "C":" ___\n|   \n|__ ",
    "D":"|--\n|__",
    "E":"|---\n|   \n|---",
    "F":"|---\n|   \n|  ",
    "G":" ___\n|   \n|__ ",
    "H":"| | \n|-- \n| | ",
    "I":"---\n | \n---",
    "J":"   |\n   |\n__| ",
    "K":"| |\n|--\n| | ",
    "L":"|  \n|  \n|__",
    "M":"| | | | \n| | | | \n| |_| |",
    "N":"|  |\n|   |\n|    |",
    "O":" ___\n/   \\\n\\___/",
    "P":"|--\n|--\n|  ",
    "Q":" ___\n/   \\\n\\__/ ",
    "R":"|--\n|--\n| \\ ",
    "S":" ___\n   \n ___",
    "T":"---\n | \n | ",
    "U":"| |\n| |\n|_| ",
    "V":"| |\n| | \n \\| ",
    "W":"| | |\n| | | \n|_|_|",
    "X":"| | \n| | \n \\| ",
    "Y":"| |\n| | \n |  ",
    "Z":"----\n   |\n----"
  };
  return text.toUpperCase().split("").map((c) => map[c] || c).join("\n");
};

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
