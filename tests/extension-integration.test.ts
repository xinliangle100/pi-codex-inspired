import test from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension from "../extensions/index.ts";
import { STATE_TYPE, CONTEXT_TYPE, defaultState, GUIDANCE, DECISIONS_HINT } from "../extensions/state.ts";

/** Event-contract smoke tests, not a real model run or proof of improved decisions. */
function harness() {
  const events = new Map<string, (...args: any[]) => any>();
  const commands = new Map<string, any>();
  const tools = new Map<string, any>();
  let branch: any[] = [];
  let active = ["read", "grep", "other_extension_tool"];
  const toolsetWrites: string[][] = [];
  const notices: string[] = [];
  const api = {
    on: (name: string, fn: (...args: any[]) => any) => events.set(name, fn),
    registerCommand: (name: string, def: any) => commands.set(name, def),
    registerTool: (def: any) => tools.set(def.name, def),
    appendEntry: (customType: string, data: unknown) => branch.push({ type: "custom", customType, data: structuredClone(data) }),
    getActiveTools: () => { throw new Error("Global loadout API must not be called"); },
    setActiveTools: () => { throw new Error("Global loadout API must not be called"); },
  };
  const ctx = {
    hasUI: true,
    sessionManager: { getBranch: () => branch },
    ui: { notify: (text: string) => notices.push(text), setStatus: () => undefined },
  };
  extension(api as unknown as ExtensionAPI);
  return {
    events, commands, tools, ctx, notices,
    active: () => active, toolsetWrites,
    setActive: (names: string[]) => { active = [...names]; },
    branch: () => branch,
    setBranch: (value: any[]) => { branch = value; },
    command: (value: string) => commands.get("codex-inspired").handler(value, ctx),
  };
}

function record() {
  return {
    goal: "Keep export code consistent", constraints: ["No new API"],
    decision: "Reuse registry", rationale: "Existing JSON exporter is analogous",
    openQuestions: [], verification: "Not run", references: ["src/exports.ts:register"],
  };
}

test("extension loads with only registration APIs, defaults inert and preserves unrelated messages", async () => {
  const h = harness();
  await h.events.get("session_start")!({}, h.ctx);
  assert.equal(await h.events.get("before_agent_start")!({ systemPrompt: "ORIGINAL" }, h.ctx), undefined);
  const input = [{ role: "user", content: "task", timestamp: 1 }, { role: "custom", customType: "other", content: "keep", timestamp: 2 }];
  const result = await h.events.get("context")!({ messages: input }, h.ctx);
  assert.deepEqual(result.messages, input);
  assert.equal(h.branch().length, 0);
  await assert.rejects(() => h.tools.get("codex_checkpoint").execute("id", { action: "replace", checkpoint: record() }, undefined, undefined, h.ctx), /off/);
});

test("deferred tool stays inactive; toggles and branch restore never touch global loadouts", async () => {
  const h = harness();
  const original = [...h.active()];
  assert.equal(h.tools.get("codex_checkpoint").defaultActive, false);
  assert.equal(h.tools.get("codex_checkpoint").exposure, "deferred");
  await h.events.get("session_start")!({}, h.ctx);
  assert.equal(h.toolsetWrites.length, 0);
  await h.command("guidance on");
  assert.deepEqual(h.active(), original);
  await h.command("decisions on");
  assert.deepEqual(h.active(), original);
  const enabledBranch = structuredClone(h.branch());
  await h.command("decisions off");
  assert.deepEqual(h.active(), original);
  h.setBranch(enabledBranch);
  await h.events.get("session_tree")!({}, h.ctx);
  assert.deepEqual(h.active(), original);
  // Another extension narrows available tools: never restore those unrelated names.
  h.setActive(["read"]);
  await h.events.get("before_agent_start")!({ systemPrompt: "host" }, h.ctx);
  assert.deepEqual(h.active(), ["read"]);
  h.setBranch([]);
  await h.events.get("session_start")!({ reason: "new" }, h.ctx);
  assert.deepEqual(h.active(), ["read"]);
});

test("guidance appends to original system prompt only when opted in", async () => {
  const h = harness();
  await h.command("guidance on");
  const event = { systemPrompt: "HOST + OTHER EXTENSION" };
  const result = await h.events.get("before_agent_start")!(event, h.ctx);
  assert.equal(result.systemPrompt, event.systemPrompt + GUIDANCE);
  await h.command("guidance off");
  assert.equal(await h.events.get("before_agent_start")!(event, h.ctx), undefined);
});

test("checkpoint persistence, replacement, compaction-like history and branch navigation", async () => {
  const h = harness();
  await h.command("decisions on");
  const tool = h.tools.get("codex_checkpoint");
  await tool.execute("one", { action: "replace", checkpoint: record() }, undefined, undefined, h.ctx);
  const firstBranch = structuredClone(h.branch());
  const existing = { role: "custom", customType: CONTEXT_TYPE, content: "stale", timestamp: 1 };
  const summarized = { role: "compactionSummary", summary: "compressed", tokensBefore: 200, timestamp: 2 };
  let result = await h.events.get("context")!({ messages: [existing, summarized] }, h.ctx);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0], summarized);
  assert.match(result.messages[1].content, /Reuse registry/);
  await tool.execute("two", { action: "replace", checkpoint: { ...record(), decision: "New explicit correction" } }, undefined, undefined, h.ctx);
  result = await h.events.get("context")!({ messages: result.messages }, h.ctx);
  assert.equal(result.messages.filter((m: any) => m.customType === CONTEXT_TYPE).length, 1);
  assert.match(result.messages[1].content, /New explicit correction/);
  h.setBranch(firstBranch);
  await h.events.get("session_tree")!({}, h.ctx);
  result = await h.events.get("context")!({ messages: [] }, h.ctx);
  assert.match(result.messages[0].content, /Reuse registry/);
  assert.doesNotMatch(result.messages[0].content, /New explicit correction/);
  h.setBranch([]);
  await h.events.get("session_start")!({ reason: "new" }, h.ctx);
  assert.deepEqual((await h.events.get("context")!({ messages: result.messages }, h.ctx)).messages, []);
});

test("disabled state suppresses persisted checkpoint and cancellation never writes", async () => {
  const h = harness();
  await h.command("on");
  const tool = h.tools.get("codex_checkpoint");
  const controller = new AbortController(); controller.abort();
  const size = h.branch().length;
  await assert.rejects(() => tool.execute("id", { action: "replace", checkpoint: record() }, controller.signal, undefined, h.ctx), /cancelled/);
  assert.equal(h.branch().length, size);
  await tool.execute("id", { action: "replace", checkpoint: record() }, undefined, undefined, h.ctx);
  await h.command("off");
  assert.deepEqual((await h.events.get("context")!({ messages: [] }, h.ctx)).messages, []);
  await h.command("clear");
  assert.equal(h.branch().at(-1).data.checkpoint, null);
  assert.match(h.notices.at(-1)!, /not secure erasure/);
});

test("invalid saved state fails closed and command errors do not write", async () => {
  const h = harness();
  h.setBranch([{ type: "custom", customType: STATE_TYPE, data: { ...defaultState(), version: 100 } }]);
  await h.command("status");
  assert.match(h.notices.at(-1)!, /guidance=off, decisions=off/);
  await h.command("on everything forever");
  assert.equal(h.branch().length, 1);
  assert.match(h.notices.at(-1)!, /Usage/);
});


test("decisions-only hint preserves prompt and manual JSON recording preserves case", async () => {
  const h = harness();
  const data = { ...record(), decision: "Keep PascalCase API and JSON Values" };
  await h.command("checkpoint " + JSON.stringify(data));
  assert.equal(h.branch().length, 0);
  assert.match(h.notices.at(-1)!, /off/);
  await h.command("decisions on");
  const result = await h.events.get("before_agent_start")!({ systemPrompt: "ORIGINAL" }, h.ctx);
  assert.equal(result.systemPrompt, "ORIGINAL" + DECISIONS_HINT);
  await h.command("checkpoint " + JSON.stringify(data));
  assert.deepEqual(h.branch().at(-1).data.checkpoint, data);
  const count = h.branch().length;
  for (const arg of ["checkpoint {", "checkpoint {}", "checkpoint null", "checkpoint"]) await h.command(arg);
  assert.equal(h.branch().length, count);
  await h.command("off");
  assert.equal(await h.events.get("before_agent_start")!({ systemPrompt: "ORIGINAL" }, h.ctx), undefined);
});
