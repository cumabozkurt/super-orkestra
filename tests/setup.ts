// Testler kullanıcının gerçek ~/.orkestra'sına (ya da ORKESTRA_HOME'una) asla dokunmasın.
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const h = mkdtempSync(join(tmpdir(), "so-test-home-"));
process.env.HOME = process.env.USERPROFILE = h;
process.env.ORKESTRA_HOME = join(h, ".orkestra");
delete process.env.CODEX_HOME; // testler kendi HOME/.codex klasörünü kurar
