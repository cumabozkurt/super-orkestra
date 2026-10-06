import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

/**
 * Aider tarzı repo haritası (tree-sitter, yoksa regex):
 *  1) Her dosyadan tanım satırlarını (imza) çıkar.
 *  2) Tanımlanan sembollerin diğer dosyalarda kaç kez anıldığını say -> dosyalar arası referans grafiği.
 *  3) Grafikte PageRank (20 iterasyon) -> en merkezi dosyalar önce; hedefte geçen kelimeler kişiselleştirme vektörü.
 *  4) Token bütçesine kes. Şef ASLA tam dosya okumaz.
 */
const EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".cc", ".hpp", ".py", ".go", ".rs", ".java", ".kt", ".cs", ".rb", ".php", ".swift", ".c", ".cpp", ".h"]);
const DEF = /^\s*(?:export\s+)?(?:default\s+)?(?:pub(?:\(crate\))?\s+)?(?:async\s+)?(?:def|class|function|interface|type|struct|enum|trait|fn|func|impl|const|let|var|public|private|protected|static)\s+([A-Za-z_][\w]*)/;

export interface FileDefs { sigs: string[]; syms: string[]; refs?: string[] }

function listFiles(cwd: string): string[] {
  try { return execFileSync("git", ["ls-files"], { cwd, encoding: "utf8", maxBuffer: 64 << 20 }).split("\n")
    .filter(f => EXT.has(extname(f)) && !/node_modules|dist\/|vendor\/|\.min\./.test(f)); } catch { return []; }
}
function readSources(cwd: string, files: string[]) {
  const src = new Map<string, string>();
  for (const f of files) { try { if (statSync(join(cwd, f)).size > 400_000) continue; src.set(f, readFileSync(join(cwd, f), "utf8")); } catch {} }
  return src;
}
export function regexDefs(s: string): FileDefs {
  const sigs: string[] = [], syms: string[] = [];
  for (const line of s.split("\n")) { const m = line.match(DEF); if (m && m[1].length > 2) { sigs.push(line.trim().slice(0, 110)); syms.push(m[1]); } }
  return { sigs, syms };
}

/** Aider'ın tree-sitter tags yaklaşımı: dile özgü sorgu ile tanımlar, tanımlayıcı düğümleriyle referanslar. */
const TS_LANG: Record<string, string> = { ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python", ".go": "go", ".rs": "rust", ".java": "java", ".cs": "c-sharp", ".rb": "ruby", ".php": "php", ".c": "cpp", ".h": "cpp", ".cpp": "cpp", ".cc": "cpp", ".hpp": "cpp" };
const JS_Q = `(class_declaration name: (_) @d) (function_declaration name: (_) @d) (generator_function_declaration name: (_) @d) (method_definition name: (_) @d)
  (variable_declarator name: (identifier) @d value: [(arrow_function) (function_expression) (class)])`;
const TS_Q = `${JS_Q} (abstract_class_declaration name: (_) @d) (interface_declaration name: (_) @d) (type_alias_declaration name: (_) @d) (enum_declaration name: (_) @d) (abstract_method_signature name: (_) @d)`;
const TS_QUERY: Record<string, string> = {
  javascript: JS_Q, typescript: TS_Q, tsx: TS_Q,
  python: `(class_definition name: (identifier) @d) (function_definition name: (identifier) @d)`,
  go: `(function_declaration name: (identifier) @d) (method_declaration name: (field_identifier) @d) (type_spec name: (type_identifier) @d)`,
  rust: `(function_item name: (identifier) @d) (struct_item name: (type_identifier) @d) (enum_item name: (type_identifier) @d) (trait_item name: (type_identifier) @d) (function_signature_item name: (identifier) @d) (type_item name: (type_identifier) @d)`,
  java: `(class_declaration name: (identifier) @d) (interface_declaration name: (identifier) @d) (enum_declaration name: (identifier) @d) (method_declaration name: (identifier) @d) (record_declaration name: (identifier) @d)`,
  "c-sharp": `(class_declaration name: (identifier) @d) (interface_declaration name: (identifier) @d) (struct_declaration name: (identifier) @d) (enum_declaration name: (identifier) @d) (method_declaration name: (identifier) @d) (record_declaration name: (identifier) @d)`,
  ruby: `(class name: (_) @d) (module name: (_) @d) (method name: (_) @d) (singleton_method name: (_) @d)`,
  php: `(class_declaration name: (name) @d) (interface_declaration name: (name) @d) (trait_declaration name: (name) @d) (function_definition name: (name) @d) (method_declaration name: (name) @d)`,
  cpp: `(function_definition declarator: (function_declarator declarator: (_) @d)) (class_specifier name: (type_identifier) @d body: (_)) (struct_specifier name: (type_identifier) @d body: (_)) (enum_specifier name: (type_identifier) @d body: (_))`,
};

let tsMod: Promise<any> | undefined; const tsLangs = new Map<string, Promise<{ lang: any; query: any } | null>>();
/** @vscode/tree-sitter-wasm isteğe bağlı: yoksa veya bir dil yüklenemezse o dil regex ile çıkarılır. */
function treeSitter(): Promise<any> {
  return tsMod ??= (async () => { try {
    const req = createRequire(import.meta.url); const TS = req("@vscode/tree-sitter-wasm"); await TS.Parser.init();
    return { TS, dir: req.resolve("@vscode/tree-sitter-wasm").replace(/tree-sitter\.js$/, "") };
  } catch { return null; } })();
}
async function tsLang(name: string) {
  if (!tsLangs.has(name)) tsLangs.set(name, (async () => { const m = await treeSitter(); if (!m) return null;
    try { const lang = await m.TS.Language.load(join(m.dir, `tree-sitter-${name}.wasm`)); return { lang, query: new m.TS.Query(lang, TS_QUERY[name]) }; } catch { return null; } })());
  return tsLangs.get(name)!;
}
export async function treeSitterDefs(file: string, s: string): Promise<FileDefs | null> {
  const name = TS_LANG[extname(file)]; if (!name) return null;
  const L = await tsLang(name); const m = await treeSitter(); if (!L || !m) return null;
  const parser = new m.TS.Parser(); parser.setLanguage(L.lang);
  const tree = parser.parse(s); if (!tree) return null;
  try {
    const lines = s.split("\n"); const sigs: string[] = [], syms: string[] = []; const seen = new Set<string>();
    for (const c of L.query.captures(tree.rootNode)) {
      const sym = c.node.text; const row = c.node.startPosition.row;
      const key = `${row}:${sym}`; if (sym.length < 2 || seen.has(key)) continue; seen.add(key);
      syms.push(sym); sigs.push(lines[row].trim().slice(0, 110));
    }
    // referanslar: tüm tanımlayıcı yaprakları (yorum ve dizgeler hariç; regex sürümünden daha az gürültü)
    const refs: string[] = []; const cur = tree.walk(); let down = true;
    for (;;) {
      if (down && /identifier$|^constant$|^name$/.test(cur.nodeType) && cur.nodeText?.length > 2) refs.push(cur.nodeText);
      if (down && !/comment|string/.test(cur.nodeType) && cur.gotoFirstChild()) continue;
      if (cur.gotoNextSibling()) { down = true; continue; }
      if (!cur.gotoParent()) break; down = false;
    }
    return { sigs, syms, refs };
  } finally { tree.delete(); parser.delete(); }
}

function rankAndRender(defs: Map<string, FileDefs>, src: Map<string, string>, maxTokens: number, focus: string): string {
  const owner = new Map<string, string>();
  for (const [f, d] of defs) for (const s of d.syms) if (!owner.has(s)) owner.set(s, f);
  // kenarlar: f (kullanan) -> g (tanımlayan)
  const out = new Map<string, Map<string, number>>();
  for (const [f, d] of defs) {
    const words = d.refs ?? src.get(f)!.match(/[A-Za-z_]\w{2,}/g) ?? [];
    const m = new Map<string, number>();
    for (const w of words) { const g = owner.get(w); if (g && g !== f) m.set(g, (m.get(g) ?? 0) + 1); }
    out.set(f, m);
  }
  const focusWords = new Set((focus.toLowerCase().match(/[a-z_]\w{2,}/g) ?? []));
  const nodes = [...defs.keys()]; const N = nodes.length || 1;
  const pers = new Map(nodes.map(n => [n, 1 + ([...focusWords].some(w => n.toLowerCase().includes(w)) ? 5 : 0) + (defs.get(n)!.syms.some(s => focusWords.has(s.toLowerCase())) ? 5 : 0)]));
  const ps = [...pers.values()].reduce((a, b) => a + b, 0);
  let rank = new Map(nodes.map(n => [n, 1 / N]));
  for (let i = 0; i < 20; i++) {
    const next = new Map(nodes.map(n => [n, 0.15 * pers.get(n)! / ps]));
    for (const f of nodes) {
      const edges = out.get(f)!; const tot = [...edges.values()].reduce((a, b) => a + b, 0);
      if (!tot) continue;
      for (const [g, w] of edges) next.set(g, next.get(g)! + 0.85 * rank.get(f)! * w / tot);
    }
    rank = next;
  }
  const ordered = nodes.filter(n => defs.get(n)!.sigs.length).sort((a, b) => rank.get(b)! - rank.get(a)!);
  let map = ""; let shown = 0;
  for (const f of ordered) {
    const block = `${f}\n${defs.get(f)!.sigs.slice(0, 25).map(s => "  " + s).join("\n")}\n`;
    if ((map.length + block.length) / 4 > maxTokens) break;
    map += block; shown++;
  }
  if (shown < ordered.length) map += `… +${ordered.length - shown} dosya (bütçe ${maxTokens} token)\n`;
  return map;
}

/** Eşzamanlı, bağımlılıksız sürüm (regex tanımları). */
export function buildRepoMap(cwd: string, maxTokens = 1500, focus = ""): string {
  const src = readSources(cwd, listFiles(cwd)); if (!src.size) return "";
  return rankAndRender(new Map([...src].map(([f, s]) => [f, regexDefs(s)])), src, maxTokens, focus);
}

/** Tercih edilen sürüm: tree-sitter (16 dil), desteklenmeyen/yüklenemeyen dosyada regex'e düşer. */
export async function buildRepoMapAsync(cwd: string, maxTokens = 1500, focus = ""): Promise<string> {
  const src = readSources(cwd, listFiles(cwd)); if (!src.size) return "";
  const defs = new Map<string, FileDefs>();
  for (const [f, s] of src) defs.set(f, (await treeSitterDefs(f, s).catch(() => null)) ?? regexDefs(s));
  return rankAndRender(defs, src, maxTokens, focus);
}
