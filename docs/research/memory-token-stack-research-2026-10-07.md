# Memory + token-minimization landscape for a coding-agent orchestrator
Checked 2026-10-07 ~00:45 Istanbul time. Stars and licenses were scraped from github.com repo pages (`stargazerCount`, `license.spdxId`). Latest release name and date come from `github.com/OWNER/REPO/releases.atom` (newest entry). The unauthenticated api.github.com quota ran out partway through the run. Languages marked * were checked against `/languages`. The rest come from prior knowledge.

## Top 15 (sorted by stars)
| # | Repo | ★ | Latest release (date) | License | Lang | ONE key technique |
|---|---|---|---|---|---|---|
| 1 | [github/spec-kit](https://github.com/github/spec-kit) | 140,411 | Spec Kit 1.1.1 (2026-10-06) | MIT | Python* | Spec→plan→tasks markdown artifacts act as durable, re-loadable project memory (spec-driven dev) |
| 2 | [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 97,106 | v13.34.2 (2026-10-06) | Apache-2.0 | TypeScript* | Lifecycle hooks capture tool use, AI-compress it into observations, and inject only relevant context into the next session |
| 3 | [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 71,167 | v1.14.1 (2026-10-06) | MIT | TypeScript | Change proposals written as spec *deltas* against living specs, so the agent loads only what changed |
| 4 | [cline/cline](https://github.com/cline/cline) (Memory Bank) | 69,945 | sdk/shared v0.0.90 (2026-10-02) | Apache-2.0 | TypeScript | Memory Bank: fixed markdown files (projectbrief, activeContext, progress…) re-read at the start of each task |
| 5 | [mem0ai/mem0](https://github.com/mem0ai/mem0) | 66,677 | Python SDK v2.2.1 (2026-09-25) | Apache-2.0 | Python | LLM extracts, updates, and deletes salient facts; retrieves only the relevant ones (vector store + optional graph) instead of full history |
| 6 | [upstash/context7](https://github.com/upstash/context7) | 62,745 | ctx7@0.5.13 (2026-10-05) | MIT | TypeScript | MCP that returns version-specific doc snippets by library ID + topic, under a token cap |
| 7 | [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 53,859 | v6.12.1 (2026-10-04) | MIT (LICENSE file; GitHub shows "Other") | Python* | Role agents + sharded PRD/architecture into story files, so the dev agent loads one story, not the whole spec |
| 8 | [Aider-AI/aider](https://github.com/Aider-AI/aider) | 49,398 | v0.86.3.dev (2026-02-12) | Apache-2.0 | Python | Tree-sitter **repo map**: symbol graph ranked with PageRank and trimmed to a token budget |
| 9 | [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | 45,900 | v0.11.0 (2026-09-16) | MIT | C* | Persistent code **knowledge graph** (158 langs, single binary, sub-ms queries); claims "99% fewer tokens" |
| 10 | [getzep/graphiti](https://github.com/getzep/graphiti) | 31,492 | v0.30.2 (2026-09-08) | Apache-2.0 | Python | Bi-temporal knowledge graph built incrementally from episodes; hybrid (semantic+BM25+graph) retrieval |
| 11 | [topoteretes/cognee](https://github.com/topoteretes/cognee) | 31,488 | v1.6.2 (2026-09-30) | Apache-2.0 | Python | ECL pipeline turns docs/code into KG + vectors ("memify") for graph-RAG memory |
| 12 | [oraios/serena](https://github.com/oraios/serena) | 30,058 | tag "mit-final" (2026-09-14) | **GPL-3.0-or-later** (app); SolidLSP MIT | Python | LSP-based **semantic symbol retrieval and editing** (find_symbol/references) instead of whole-file reads |
| 13 | [yamadashy/repomix](https://github.com/yamadashy/repomix) | 28,729 | v1.18.1 (2026-09-21) | MIT | TypeScript | Packs a repo into one AI file; `--compress` keeps tree-sitter signatures only; per-file token counts |
| 14 | [letta-ai/letta](https://github.com/letta-ai/letta) (MemGPT) | 25,050 | v0.16.8 (2026-05-14) | Apache-2.0 | Python | **Hierarchical memory**: in-context core blocks + archival/recall storage, which the agent edits itself |
| 15 | [zilliztech/claude-context](https://github.com/zilliztech/claude-context) | 12,588 | v0.1.11 (2026-04-28) | MIT | TypeScript | AST-chunked hybrid (BM25+vector) code search over Milvus with Merkle-tree incremental re-index |

## Other candidates checked (ranked lower on relevance or stars)
| Repo | ★ | Latest release | License | Note |
|---|---|---|---|---|
| [microsoft/graphrag](https://github.com/microsoft/graphrag) | 36,236 | v3.2.0 (2026-09-24) | MIT | Hierarchical community summaries over a KG; heavy indexing cost |
| [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) | 28,174 | 0.43.1 (2026-03-31) | Other (MIT+Commons Clause, unverified) | PRD → dependency task graph; only the current task goes in context |
| [MemoriLabs/Memori](https://github.com/MemoriLabs/Memori) (ex GibsonAI) | 17,078 | 3.3.6 (2026-05-28) | Other | SQL-native agent memory |
| [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | 11,732 | v2.0.34 (2026-09-23) | Apache-2.0 | "Memory OS", hybrid retrieval + skill reuse; claims 35.24% token savings |
| [mufeedvh/code2prompt](https://github.com/mufeedvh/code2prompt) | 7,721 | v4.2.0 (2025-12-12) | MIT | Templated codebase→prompt with glob filters + token count |
| [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) | 6,730 | v0.2.2 (2024-04-09, stale) | MIT | Small-LM token-level prompt compression (LLMLingua-2) |
| [campfirein/cipher](https://github.com/campfirein/cipher) | 4,959 | ByteRover CLI 3.16.1 (2026-05-27) | Other | Coding-agent memory layer (now ByteRover) |
| [getzep/zep](https://github.com/getzep/zep) | 4,950 | zep-ingest v0.3.0 (2026-08-29) | Apache-2.0 | Graphiti-backed memory service (OSS part is limited) |
| [CaviraOSS/OpenMemory](https://github.com/CaviraOSS/OpenMemory) | 4,520 | Beta v1.3.0 (2025-12-20) | Apache-2.0 | Local cognitive memory (mem0's own "OpenMemory" MCP lives inside mem0 repo) |
| [basicmachines-co/basic-memory](https://github.com/basicmachines-co/basic-memory) | 4,106 | v0.23.2 (2026-08-25) | AGPL-3.0 | Markdown-file KG via MCP (Obsidian-compatible) |
| [memodb-io/memobase](https://github.com/memodb-io/memobase) | 2,922 | v0.0.42 (2026-01-11) | Apache-2.0 | User-profile + event memory |
| [doobidoo/mcp-memory-service](https://github.com/doobidoo/mcp-memory-service) | 1,987 | v11.15.0 (2026-10-03) | Apache-2.0 | MCP memory with consolidation |

## Token-saving tactics documented by the vendors
**Anthropic** ([prompt caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching), [context editing](https://docs.claude.com/en/docs/build-with-claude/context-editing))
- Prompt caching costs 1.25× base input for a 5-min write and 2× for a 1-h write. Reads cost 0.1× base (0.05× on Opus 5.5, 0.025× on Fable/Mythos 5.1). You get up to 4 breakpoints and a 20-block lookback. Cache order is tools→system→messages. The minimum prefix is 512–4,096 tokens depending on model. Automatic caching works with a single top-level `cache_control`. Cache hits don't count against rate limits (1-h TTL docs). `max_tokens:0` pre-warms the cache.
- Cache killers: changing tools, thinking/effort config, images, or `tool_choice`. Inject mid-conversation `role:"system"` messages (and `tool_addition` behind the `inline-tools-2026-09-15` beta) so the prefix stays intact.
- Context editing (beta `context-management-2025-06-27`):
  - `clear_tool_uses_20250919` defaults: trigger 100k, keep 3. Options: `clear_at_least`, `exclude_tools`, `clear_tool_inputs`.
  - `clear_thinking_20251015` sets how many thinking turns to `keep`.
  - Clearing breaks the cache. Use `clear_at_least` so a clear is big enough to be worth it.
- Memory tool `memory_20250818` is file-based memory on the client side. With context editing, Claude gets a warning before results are cleared so it can save them to memory first.
- Server-side compaction `compact_20260112` is the recommended primary strategy. SDK `compaction_control` is deprecated.

**OpenAI** ([prompt caching](https://platform.openai.com/docs/guides/prompt-caching))
- Caching is on by default. On GPT-5.6+, writes cost 1.25× and reads 0.1× (0.05× on GPT-6.1 Sol). Minimum prefix is 1,024 tokens, TTL is 30 min, and there are explicit `prompt_cache_breakpoint`s (up to 4 writes per request). `prompt_cache_options.prewarm` pre-warms. Earlier models use `prompt_cache_retention:"24h"` and a `prompt_cache_key` for routing.
- Keep tools stable. Use `allowed_tools` / `tool_choice:"none"` rather than removing tools, and tool search `defer_loading:true`.
- Change reasoning effort with a `configuration_update` item instead of the top-level param.
- Compaction (`context_management`) shrinks input but resets cache reuse. OpenAI says to compare total cost before and after.
- Cached tokens still count toward TPM.

## Recommendation: strongest stack
1. **Code context:** Serena (LSP symbol ops) is the main tool. Add codebase-memory-mcp or aider-style repo map for structure, and claude-context for semantic search. Use repomix `--compress` only for one-shot whole-repo briefs. Mind Serena's new GPL-3.0; SolidLSP is MIT if you need to embed it.
2. **Persistent memory:** two tiers.
   - (a) Human-readable spec/memory-bank files (spec-kit or OpenSpec deltas + Cline-style activeContext/progress). This is the source of truth, versioned in git.
   - (b) A retrievable fact/episode store: mem0 (simplest, Apache-2.0) or Graphiti (temporal KG) when "what changed when" matters. Use claude-mem's hook→compress→inject pattern to fill it automatically.
3. **Per-task loading:** BMAD/task-master-style sharding. Each sub-agent gets one story/task plus retrieved memories, never the full spec. Fetch docs on demand through context7.
4. **API layer:**
   - Stable prefix in the order tools→system→project memory, with explicit cache breakpoints and 1-h TTL for slow sub-agents.
   - Inject mid-conversation system messages instead of editing the prompt.
   - `clear_tool_uses` with `clear_at_least` plus the memory tool.
   - Server-side compaction as the fallback.
5. **Skip or defer:** LLMLingua (stale since 2024, and compression breaks caching), plus GraphRAG/cognee for code (high indexing cost). Track cache read/write tokens per sub-agent as the main efficiency metric.
