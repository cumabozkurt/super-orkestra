import { describe, it, expect } from "vitest";
import { pickWorker } from "../packages/core/src/router/classifier.js";
import { detectLimit } from "../packages/core/src/limits/detect.js";
const ws = [
  { id: "w1", agent: "claude-code" as const, model: "sonnet", strengths: ["refactor"] },
  { id: "w2", agent: "codex" as const, model: "gpt", strengths: ["tests"] },
  { id: "w3", agent: "openrouter" as const, model: "auto", strengths: ["docs"] }];
const b = (complexity: any, tags: string[]) => ({ id: "t", goal: "", files: [], context: "", acceptance: [], complexity, tags });
describe("router", () => {
  it("dokümanı ucuz işçiye verir", () => expect(pickWorker(b("trivial", ["docs"]), ws).worker.id).toBe("w3"));
  it("zor refactor'u güçlü işçiye verir", () => expect(pickWorker(b("hard", ["refactor"]), ws).worker.id).toBe("w1"));
  it("limitteki işçiyi atlar", () => expect(pickWorker(b("hard", ["refactor"]), ws, ["w1"]).worker.id).not.toBe("w1"));
});
describe("limit", () => {
  it("eski epoch formatı", () => expect(detectLimit("Claude AI usage limit reached|1791234567", "c")?.resetsAt).toBe(1791234567));
  it("429", () => expect(detectLimit("HTTP 429 rate_limit_exceeded", "x")).toBeTruthy());
  it("normal çıktı", () => expect(detectLimit("all good", "x")).toBeUndefined());
});
