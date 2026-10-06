import { exec } from "node:child_process";
import { promisify } from "node:util";
const sh = promisify(exec);
const GATE_TIMEOUT = () => Number(process.env.ORKESTRA_GATE_TIMEOUT_MS ?? 10 * 60_000);
export async function runGates(cmds: string[], cwd: string) {
  let log = "";
  for (const c of cmds) {
    // CI=1: vitest/jest gibi koşucular izleme (watch) moduna girip sonsuza dek beklemesin; ayrıca süre sınırı.
    try { const { stdout, stderr } = await sh(c, { cwd, maxBuffer: 1 << 24, timeout: GATE_TIMEOUT(), env: { ...process.env, CI: process.env.CI ?? "1" } });
      log += `$ ${c}\nOK\n${(stdout + stderr).slice(-500)}\n`; }
    catch (e: any) { const why = e.killed ? `\n(zaman aşımı: ${GATE_TIMEOUT() / 1000} sn)` : "";
      log += `$ ${c}\nFAIL${why}\n${((e.stdout ?? "") + (e.stderr ?? "")).slice(-6000)}\n`; return { ok: false, log }; }
  }
  return { ok: true, log };
}
