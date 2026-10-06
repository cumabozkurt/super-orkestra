import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";
import "./style.css";

/**
 * Super Orkestra masaüstü (Tauri 2). Çekirdek mantık CLI'da: `orkestra` komutu (npm i -g super-orkestra; `super-orkestra` ile aynı) alt süreç olarak çağrılır.
 * Sekmeler: Görev (canlı akış) · Kullanım (token/önbellek) · Limitler (5 saat / haftalık) · Hafıza · Modeller
 */
type Tab = "run" | "usage" | "limits" | "memory" | "models";
/**
 * CLI çağrısı. Windows'ta npm global kurulumu `orkestra.cmd` üretir; Rust'ın Command'ı .cmd'yi PATHEXT ile çözmez,
 * bu yüzden orada `cmd /d /c orkestra <alt komut>` kullanılır. Kullanıcı metni (hedef, sorgu) ASLA argüman olarak
 * geçmez: ORKESTRA_INPUT ortam değişkeniyle gider (`-` argümanı), böylece cmd.exe kaçış/enjeksiyon sorunu oluşmaz.
 * İzin kapsamı (capabilities/default.json) yalnızca bu sabit alt komutlara izin verir.
 */
const WIN = /Windows/i.test(navigator.userAgent);
type Sub = "run" | "recall" | "remember" | "limits" | "usage" | "models";
const ork = (sub: Sub, opts: { cwd?: string; input?: string } = {}) => {
  const args = opts.input !== undefined ? [sub, "-"] : [sub];
  const o = { ...(opts.cwd ? { cwd: opts.cwd } : {}), ...(opts.input !== undefined ? { env: { ORKESTRA_INPUT: opts.input } } : {}) };
  return WIN ? Command.create(opts.input !== undefined ? "orkestra-win-input" : "orkestra-win", ["/d", "/c", "orkestra", ...args], o)
             : Command.create(opts.input !== undefined ? "orkestra-input" : "orkestra", args, o);
};
async function json(sub: Sub, cwd?: string) { const r = await ork(sub, { cwd }).execute(); try { return JSON.parse(r.stdout); } catch { return { hata: r.stderr || r.stdout }; } }

function App() {
  const [tab, setTab] = useState<Tab>("run");
  const [cwd, setCwd] = useState(localStorage.getItem("cwd") ?? "");
  const [goal, setGoal] = useState(""); const [log, setLog] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<any>({}); const [limits, setLimits] = useState<any>({}); const [models, setModels] = useState<any[]>([]);
  const [q, setQ] = useState(""); const [mem, setMem] = useState("");

  useEffect(() => { localStorage.setItem("cwd", cwd); }, [cwd]);
  useEffect(() => {
    const tick = async () => { setLimits(await json("limits")); if (cwd) setUsage(await json("usage", cwd)); };
    tick(); const t = setInterval(tick, 60_000); return () => clearInterval(t);
  }, [cwd]);

  const pickDir = async () => { const d = await open({ directory: true }); if (typeof d === "string") setCwd(d); };
  const run = async () => {
    if (!cwd || !goal.trim()) return; setBusy(true); setLog([]);
    const c = ork("run", { cwd, input: goal });
    c.stdout.on("data", l => setLog(x => [...x, l])); c.stderr.on("data", l => !/ExperimentalWarning|trace-warnings/.test(l) && setLog(x => [...x, l]));
    c.on("close", async () => { setBusy(false); setUsage(await json("usage", cwd)); });
    await c.spawn();
  };

  const totals = useMemo(() => {
    const w = Object.values<any>(usage.byWorker ?? {}); const c = usage.conductor ?? {};
    const inp = w.reduce((a, x) => a + x.input, 0) + (c.input ?? 0), cache = w.reduce((a, x) => a + x.cacheRead, 0) + (c.cacheRead ?? 0);
    return { inp, out: w.reduce((a, x) => a + x.output, 0) + (c.output ?? 0), cache, hit: inp + cache ? Math.round(100 * cache / (inp + cache)) : 0 };
  }, [usage]);

  return (<div className="app">
    <header><h1>🎼 Super Orkestra</h1>
      <div className="dir"><button onClick={pickDir}>Proje klasörü</button><code>{cwd || "seçilmedi"}</code></div>
      <nav>{(["run", "usage", "limits", "memory", "models"] as Tab[]).map(t =>
        <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ run: "Görev", usage: "Kullanım", limits: "Limitler", memory: "Hafıza", models: "Modeller" }[t]}</button>)}</nav>
    </header>
    {tab === "run" && <section>
      <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3} placeholder="Ne yapılsın? Şef planlar, en uygun işçiye verir, testlerle denetler." />
      <button disabled={busy || !cwd} onClick={run}>{busy ? "Çalışıyor…" : "Şefe ver"}</button>
      <pre className="log">{log.map(l => l.endsWith("\n") ? l : l + "\n").join("")}</pre>
    </section>}
    {tab === "usage" && <section>
      <div className="cards"><Card k="Girdi token" v={totals.inp} /><Card k="Çıktı token" v={totals.out} /><Card k="Önbellekten" v={totals.cache} /><Card k="Önbellek oranı" v={`%${totals.hit}`} /></div>
      <table><thead><tr><th>İşçi</th><th>Çalışma</th><th>Girdi</th><th>Çıktı</th><th>Önbellek</th></tr></thead><tbody>
        {Object.entries<any>(usage.byWorker ?? {}).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.runs}</td><td>{v.input}</td><td>{v.output}</td><td>{v.cacheRead}</td></tr>)}
        {usage.conductor && <tr><td>şef</td><td>—</td><td>{usage.conductor.input}</td><td>{usage.conductor.output}</td><td>{usage.conductor.cacheRead}</td></tr>}
      </tbody></table>
    </section>}
    {tab === "limits" && <section>
      {Object.keys(limits).length === 0 && <p>Henüz limit verisi yok. Claude için statusline betiğini kurun; Codex oturum dosyalarından otomatik okunur.</p>}
      {Object.entries<any>(limits).filter(([k]) => k !== "hata").map(([agent, ws]) => <div key={agent} className="limit"><h3>{agent}</h3>
        {(ws as any[]).map((w, i) => <div key={i}><div className="bar"><div style={{ width: `${Math.min(100, w.usedPct)}%` }} /></div>
          <small>%{Math.round(w.usedPct)} · sıfırlanma {new Date(w.resetsAt * 1000).toLocaleString()}</small></div>)}</div>)}
    </section>}
    {tab === "memory" && <section>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Hafızada ara" />
      <button disabled={!cwd} onClick={async () => setMem((await ork("recall", { cwd, input: q }).execute()).stdout)}>Getir</button>
      <pre className="log">{mem}</pre>
    </section>}
    {tab === "models" && <section>
      <button onClick={async () => setModels(await json("models"))}>Modelleri keşfet (opencode + OpenRouter)</button>
      <table><thead><tr><th>Sağlayıcı</th><th>Model</th><th>Ücretsiz</th></tr></thead><tbody>
        {models.slice(0, 300).map(m => <tr key={m.provider + m.id}><td>{m.provider}</td><td>{m.id}</td><td>{m.free ? "✓" : ""}</td></tr>)}</tbody></table>
    </section>}
  </div>);
}
const Card = ({ k, v }: { k: string; v: any }) => <div className="card"><small>{k}</small><b>{typeof v === "number" ? v.toLocaleString() : v}</b></div>;
createRoot(document.getElementById("root")!).render(<App />);
