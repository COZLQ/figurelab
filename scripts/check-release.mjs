import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".local", ".next", "node_modules", "out", "coverage", "test-results", ".pnpm-store"]);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".mp4", ".ico", ".webp"]);
const violations = [];

function walk(directory = root, prefix = "") {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) result.push(...walk(path.join(directory, entry.name), relative + "/"));
    } else if (entry.name !== ".env.example" && (entry.name.startsWith(".env") || /\.(?:log|pid|pem|key|tsbuildinfo)$/.test(entry.name))) {
      continue;
    } else result.push(relative);
  }
  return result;
}

let files;
try {
  const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (fs.realpathSync(top).toLowerCase() !== fs.realpathSync(root).toLowerCase()) throw new Error("Different repository");
  files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\0").filter(Boolean);
} catch { files = walk(); }
files = [...new Set(files.map(file => file.replaceAll("\\", "/")))].sort();

const required = ["README.md", "README.zh-CN.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", ".env.example", "pnpm-lock.yaml", ".github/workflows/ci.yml", "docs/assets/demo.gif", "docs/assets/demo.mp4"];
for (const file of required) if (!files.includes(file)) violations.push(`${file}: required publication file is missing or ignored`);

const secretPatterns = [
  ["possible provider key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["possible GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["private-key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["machine-specific home path", /[A-Za-z]:[\\/]Users[\\/][^\\/\s"']+[\\/]/],
];
const manifest = [];
for (const file of files) {
  const basename = path.posix.basename(file);
  if (file.split("/").some(segment => ignoredDirectories.has(segment)) || (basename.startsWith(".env") && basename !== ".env.example") || /\.(?:pem|key|log|pid|tsbuildinfo)$/.test(file)) {
    violations.push(`${file}: local or private payload must not be published`); continue;
  }
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) { violations.push(`${file}: invalid source path`); continue; }
  if (fs.lstatSync(absolute).isSymbolicLink()) { violations.push(`${file}: review symlink before publication`); continue; }
  const bytes = fs.readFileSync(absolute);
  if (bytes.length > 50 * 1024 * 1024) violations.push(`${file}: file exceeds the source-release size budget`);
  manifest.push({ path: file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  if (binaryExtensions.has(path.extname(file).toLowerCase())) continue;
  const text = bytes.toString("utf8");
  for (const [label, expression] of secretPatterns) if (expression.test(text)) violations.push(`${file}: ${label}`);
  if (file === ".env.example") {
    for (const line of text.split(/\r?\n/)) {
      if (/^(?:FIGURELAB_AI_API_KEY|DEEPSEEK_API_KEY)\s*=\s*\S/.test(line)) violations.push(`${file}: example key must be empty`);
    }
  }
  if (file.endsWith(".md")) {
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim().split(/\s+"/)[0].replace(/^<|>$/g, "");
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      target = target.split("#")[0]; if (!target) continue;
      try { target = decodeURIComponent(target); } catch { violations.push(`${file}: invalid local link encoding`); continue; }
      const resolved = path.resolve(path.dirname(absolute), target);
      if (!(resolved === root || resolved.startsWith(root + path.sep)) || !fs.existsSync(resolved)) violations.push(`${file}: broken local link to ${target}`);
    }
  }
}

if (violations.length) {
  console.error("Publication checks failed:");
  for (const issue of violations) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  const total = manifest.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`Publication checks passed: ${manifest.length} files, ${(total / 1024 / 1024).toFixed(2)} MiB.`);
  console.log("Checked source exclusions, common credential patterns, required materials, and local Markdown links.");
  if (process.argv.includes("--manifest")) {
    fs.mkdirSync(path.join(root, ".local", "release"), { recursive: true });
    fs.writeFileSync(path.join(root, ".local", "release", "manifest.json"), JSON.stringify({ version: "0.1.0", generatedAt: new Date().toISOString(), totalBytes: total, files: manifest }, null, 2) + "\n");
    console.log("Wrote the local source manifest.");
  }
}
