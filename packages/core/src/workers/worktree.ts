import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, appendFileSync, symlinkSync, readdirSync, rmdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { orkHome } from "../types.js";

/**
 * İşçi başına izole git worktree (claude-squad / nimbalyst deseni).
 * İşçiler birbirinin dosyasını ezmez; şef kabul ederse dal ana dala birleştirilir, reddederse atılır.
 */
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export interface Worktree { path: string; branch: string; base: string }

export function isGitRepo(cwd: string) { try { git(cwd, "rev-parse", "--is-inside-work-tree"); return true; } catch { return false; } }

export function createWorktree(repo: string, taskId: string, workerId: string): Worktree {
  const base = git(repo, "rev-parse", "HEAD");
  const branch = `orkestra/${taskId}-${workerId}-${Date.now().toString(36)}`.replace(/[^\w/.-]/g, "-");
  // Repo DIŞINDA tutulur: bazı ajanlar (ör. opencode) iç içe dizinde ana repoyu proje kökü sanıp oraya yazıyor.
  const id = `${basename(repo)}-${createHash("sha1").update(repo).digest("hex").slice(0, 8)}`;
  const dir = join(orkHome(), "worktrees", id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, branch.split("/").pop()!);
  git(repo, "worktree", "add", "-b", branch, path, base);
  // Bağımlılıkları yeniden kurmamak için (kapılar test koşabilsin) ana repodaki node_modules / .venv paylaşılır.
  for (const dep of ["node_modules", ".venv", "venv"]) {
    if (existsSync(join(repo, dep)) && !existsSync(join(path, dep))) try { symlinkSync(join(repo, dep), join(path, dep), "junction"); } catch {}
  }
  return { path, branch, base };
}

/** İşçinin yaptığı değişiklikleri (commit'li + commit'siz) tek diff olarak verir. */
export function worktreeDiff(wt: Worktree): string {
  git(wt.path, "add", "-A", "--", ".", ":!node_modules", ":!.venv", ":!venv");
  return git(wt.path, "diff", "--cached", wt.base);
}

export function mergeWorktree(repo: string, wt: Worktree, message: string): { ok: boolean; conflict?: string } {
  git(wt.path, "add", "-A", "--", ".", ":!node_modules", ":!.venv", ":!venv");
  try { git(wt.path, "commit", "-m", message, "--no-verify"); } catch { /* değişiklik yok */ }
  try { git(repo, "merge", "--no-ff", "-m", `orkestra: ${message}`, wt.branch); return { ok: true }; }
  catch (e: any) { try { git(repo, "merge", "--abort"); } catch {} return { ok: false, conflict: String(e.stderr ?? e.message).slice(0, 2000) }; }
}

export function removeWorktree(repo: string, wt: Worktree) {
  try { git(repo, "worktree", "remove", "--force", wt.path); } catch {}
  try { git(repo, "branch", "-D", wt.branch); } catch {}
  try { git(repo, "worktree", "prune"); } catch {}
  // ~/.orkestra/worktrees/<repo-id> boş kaldıysa onu da kaldır (boş klasör birikmesin)
  try { const d = dirname(wt.path); if (existsSync(d) && !readdirSync(d).length) rmdirSync(d); } catch {}
}

export function ensureIgnored(repo: string) {
  const ex = join(repo, ".git", "info", "exclude");
  if (existsSync(ex)) { const s = readFileSync(ex, "utf8"); if (!s.includes(".orkestra/")) appendFileSync(ex, "\n.orkestra/\n"); }
}
