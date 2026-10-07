# super-orkestra-core

The engine behind [Super Orkestra](https://github.com/cumabozkurt/super-orkestra):

- conductor/worker routing;
- ACP and headless CLI workers (Claude Code, Codex, Gemini CLI, opencode) plus an OpenRouter worker;
- isolated git worktrees, and test gates with a test-tampering guard;
- persistent memory (markdown + SQLite FTS5);
- a tree-sitter repo map with PageRank;
- 5-hour/weekly limit tracking with automatic hand-off and resume;
- an MCP server.

> Most users want the [`super-orkestra`](https://github.com/cumabozkurt/super-orkestra/tree/main/packages/cli) CLI. Use this package to embed the orchestrator in your own tool.
> *Türkçe:* Çoğu kullanıcı için CLI yeterlidir. Bu paket orkestratörü kendi aracınıza gömmek içindir.

Requires **Node.js ≥ 22.16** (built-in `node:sqlite` with FTS5). ESM only.

## Usage

This mirrors what the CLI does in `packages/cli/src/index.ts`:

```ts
import { join } from "node:path";
import {
  Conductor, LlmPlanner, loadConfig, Memory, LimitTracker, ResumeScheduler, makeWorker, buildRepoMapAsync,
} from "super-orkestra-core";

const cwd = process.cwd();
const cfg = loadConfig(cwd);                                   // orkestra.config.json merged with defaults, validated
const memory = new Memory(join(cwd, cfg.memory.dir));
const limits = new LimitTracker(cfg.limits.pauseAtPercent);
const workers = new Map(cfg.workers.map(w => [w.id, makeWorker(w, cfg.providers)]));

let conductor: Conductor;
const scheduler = new ResumeScheduler(async job => {           // called when a paused task's limit has reset
  await conductor.runTask(job.brief, 0, [], { workerId: job.workerId, sessionId: job.sessionId, worktree: job.worktree });
});
conductor = new Conductor(cfg, new LlmPlanner(cfg, cwd), workers, memory, limits, scheduler, cwd);

conductor.on("assign", e => console.log(`${e.task} -> ${e.worker}`));
conductor.on("done", e => console.log(`done: ${e.task}`));

const goal = "fix the date parsing bug and add a regression test";
const results = await conductor.execute(goal, await buildRepoMapAsync(cwd, 1500, goal));
console.log(results); // { t1: "done" | "failed" | "paused", ... }
```

### Conductor events

| Event | Payload |
|---|---|
| `plan` | `TaskBrief[]` |
| `assign` | `{ task, worker, model, attempt, resumed }` |
| `carry` | `{ task, to, diffBytes }`: unfinished work handed to a worker |
| `gates` | `{ task, ok }` |
| `review` | `{ task, verdict, note }` |
| `handoff` | `{ task, from, to, reason: "limit" }` |
| `paused` | `{ task, until }` (epoch seconds) |
| `done` / `failed` | `{ task, worker }` / `{ task, note }` |
| `warn` | `string` |
| `finished` | `{ goal, results }` |

### Extension points

- **`Planner`**: implement `plan(goal, repoMap, memory)` and `review(brief, result, gateLog)` to plug in any planning model. `LlmPlanner` drives a headless agent CLI.
- **`Worker`**: implement `run(brief, { cwd, resumeSessionId?, signal? })` and return a `WorkResult`. Built in: `CliWorker`, `AcpWorker`, `OpenRouterWorker`. `makeWorker()` chooses one based on `agent` / `transport`.
- **`startMcp(conductor, memory, limits, repoMap, version)`**: serve the MCP tools over stdio.

Other exports include `pickWorker`, `runGates`, `detectLimit`, `nextWallClock`, `buildRepoMap` (sync, regex only), `createWorktree` / `worktreeDiff` / `mergeWorktree` / `removeWorktree`, `discoverAllModels`, `validateConfig` and `DEFAULT_CONFIG`.

## Documentation

- [Architecture](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/architecture.md)
- [Configuration](https://github.com/cumabozkurt/super-orkestra/blob/main/docs/configuration.md)

## License

MIT © Cuma Bozkurt
