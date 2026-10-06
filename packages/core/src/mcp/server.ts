import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { Conductor } from "../router/conductor.js";
import type { Memory } from "../memory/memory.js";
import type { LimitTracker } from "../limits/tracker.js";

/**
 * Orkestra'yı MCP sunucusu olarak açar -> Claude Code, Codex, Gemini, opencode, Cline, Continue, Kilo, Copilot
 * hepsi eklentisiz kullanabilir:  claude mcp add super-orkestra -- npx -y super-orkestra mcp
 */
export async function startMcp(c: Conductor, mem: Memory, limits: LimitTracker, repoMap: (focus?: string) => string | Promise<string>, version = "0.0.0") {
  const s = new McpServer({ name: "super-orkestra", version });
  s.registerTool("orkestra_delegate", { description: "Bir hedefi şef modele ver; o planlar, işçilere dağıtır, denetler.",
    inputSchema: { goal: z.string() } }, async ({ goal }) => { const r = await c.execute(goal, await repoMap(goal)); return { content: [{ type: "text", text: JSON.stringify(r) }] }; });
  s.registerTool("memory_recall", { description: "Proje hafızasından ilgili olguları getir (token bütçeli).",
    inputSchema: { query: z.string(), maxTokens: z.number().optional() } }, async ({ query, maxTokens }) => ({ content: [{ type: "text", text: mem.recall(query, maxTokens) }] }));
  s.registerTool("memory_remember", { description: "Kalıcı olgu kaydet.", inputSchema: { text: z.string(), tags: z.array(z.string()).optional() } },
    async ({ text, tags }) => { mem.remember(text, tags); return { content: [{ type: "text", text: "Kaydedildi." }] }; });
  s.registerTool("repo_map", { description: "İmza düzeyinde repo haritası.", inputSchema: {} }, async () => ({ content: [{ type: "text", text: await repoMap() }] }));
  s.registerTool("limits_status", { description: "Abonelik limitlerinin anlık durumu.", inputSchema: {} },
    async () => { limits.refresh(); return { content: [{ type: "text", text: JSON.stringify(limits.snapshot()) }] }; });
  await s.connect(new StdioServerTransport());
}
