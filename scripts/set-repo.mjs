#!/usr/bin/env node
// Kullanım: npm run set-repo -- <github-kullanıcı-veya-org>
// package.json, README ve diğer belgelerdeki "OWNER" yer tutucusunu gerçek GitHub sahibiyle değiştirir.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const owner = process.argv[2];
if (!owner || !/^[A-Za-z0-9-]+$/.test(owner)) { console.error("Kullanım: npm run set-repo -- <github-kullanıcı-adı>"); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["package.json", "packages/core/package.json", "packages/cli/package.json", "packages/vscode/package.json",
  "README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "packages/cli/README.md", "packages/core/README.md", "packages/vscode/README.md"];
let n = 0;
for (const f of files) {
  const p = join(root, f); let s; try { s = readFileSync(p, "utf8"); } catch { continue; }
  const t = s.replaceAll("github.com/OWNER/", `github.com/${owner}/`).replaceAll("OWNER/super-orkestra", `${owner}/super-orkestra`);
  if (t !== s) { writeFileSync(p, t); n++; console.log("güncellendi:", f); }
}
console.log(n ? `Tamam: ${n} dosya → github.com/${owner}/super-orkestra` : "Değiştirilecek yer tutucu bulunamadı (zaten ayarlanmış olabilir).");
