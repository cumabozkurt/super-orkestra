import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * İki katmanlı hafıza (araştırmanın vardığı en güçlü düzen):
 *  1) Git'te markdown "hafıza bankası" = doğruluk kaynağı (spec-kit / Cline Memory Bank / OpenSpec):
 *     project.md, decisions.md, progress.md, conventions.md
 *  2) Aranabilir olgu deposu: SQLite FTS5 (yerel, bağımlılıksız; node:sqlite). mem0 tarzı ekle/güncelle/sil.
 * Her işçiye sadece görevle ilgili, token bütçeli parçalar enjekte edilir; tüm spec asla gönderilmez.
 */
export class Memory {
  private db: DatabaseSync;
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
    for (const f of ["project.md", "decisions.md", "progress.md", "conventions.md"])
      if (!existsSync(join(dir, f))) writeFileSync(join(dir, f), `# ${f.replace(".md", "")}\n`);
    this.db = new DatabaseSync(join(dir, "facts.db"));
    this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS facts USING fts5(text, tags, ts UNINDEXED)`);
  }
  remember(text: string, tags: string[] = []) {
    // Yinelenen olguyu güncelle (mem0'ın UPDATE adımının ucuz karşılığı)
    const dup = this.db.prepare(`SELECT rowid FROM facts WHERE facts MATCH ? LIMIT 1`).get(quote(text.slice(0, 80))) as any;
    if (dup) this.db.prepare(`UPDATE facts SET text=?, tags=?, ts=? WHERE rowid=?`).run(text, tags.join(" "), Date.now(), dup.rowid);
    else this.db.prepare(`INSERT INTO facts(text, tags, ts) VALUES (?,?,?)`).run(text, tags.join(" "), Date.now());
  }
  forget(query: string) { this.db.prepare(`DELETE FROM facts WHERE facts MATCH ?`).run(quote(query)); }
  recall(query: string, maxTokens = 1500): string {
    const words = query.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) ?? [];
    const q = words.map(w => `"${w}"`).join(" OR ") || '""';
    const rows = this.db.prepare(`SELECT text FROM facts WHERE facts MATCH ? ORDER BY bm25(facts) LIMIT 30`).all(q) as any[];
    const conventions = readFileSync(join(this.dir, "conventions.md"), "utf8");
    let out = conventions.slice(0, maxTokens * 2) + "\n"; // ~4 karakter/token
    for (const r of rows) { if ((out.length + r.text.length) / 4 > maxTokens) break; out += `- ${r.text}\n`; }
    return out;
  }
  appendProgress(line: string) { const p = join(this.dir, "progress.md"); writeFileSync(p, readFileSync(p, "utf8") + `- ${new Date().toISOString()} ${line}\n`); }
  files() { return readdirSync(this.dir).filter(f => f.endsWith(".md")); }
}
const quote = (s: string) => `"${s.replace(/"/g, " ")}"`;
