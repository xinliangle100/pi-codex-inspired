import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAndLoadExtensions, loadSkillsFromDir, ExtensionRunner, AgentSession } from "@earendil-works/pi-coding-agent";
import { ADAPTER, PLAN, BASE, DEFAULT, STATE_TYPE, isPlan } from "../extensions/mode.ts";
import extension from "../extensions/index.ts";
import { SELECTOR_TYPE, selection } from "../extensions/selector.ts";
const root = fileURLToPath(new URL("..", import.meta.url));

test("all vendored upstream bytes match pinned manifest", () => {
  const m = JSON.parse(readFileSync(join(root, "upstream/manifest.json"), "utf8"));
  assert.equal(m.commit, "970111f6cb62cc02fe36a82ea7d71b37a2889c97");
  assert.equal(m.files.length, 9);
  for (const f of m.files) assert.equal(createHash("sha256").update(readFileSync(join(root, "upstream/codex", f.path))).digest("hex"), f.sha256, f.path);
  assert.equal(PLAN, readFileSync(join(root, "upstream/codex/codex-rs/collaboration-mode-templates/templates/plan.md"), "utf8"));
});

test("real Pi loader accepts extension; old skills are not exported or discoverable", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-source-baseline-"));
  try {
    const result = await discoverAndLoadExtensions([join(root, "extensions/index.ts")], dir, join(dir, "agent"));
    assert.deepEqual(result.errors, []);
    assert.equal(result.extensions.length, 1);
    assert.deepEqual([...result.extensions[0].commands.keys()], ["codex-inspired", "codex-plan"]);
    assert.deepEqual([...result.extensions[0].tools.keys()], ["codex_plan_request_user_input"]);
    const m = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(m.private, true); assert.equal(m.version, "0.3.0");
    assert.deepEqual(m.pi, { extensions: ["./extensions/index.ts"] });
    assert.equal(existsSync(join(root, "skills")), false);
    assert.deepEqual(loadSkillsFromDir({ dir, source: "test" }).skills, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function harness(toolHost?: { getActiveToolNames(): string[]; setActiveToolsByName(names: string[]): void }) {
  const handlers = new Map<string, Function>(); const commands = new Map<string, any>(); let tool: any;
  const branch: any[] = []; const selections: (string | undefined)[] = []; let selectedOptions: string[] = []; let input: string | undefined = "custom answer";
  const ctx = { hasUI: true, sessionManager: { getBranch: () => branch }, ui: {
    setStatus() {}, notify() {}, async select(_title: string, options: string[]) { selectedOptions = options; const value = selections.shift(); return value === "first" ? options[0] : value; }, async input() { return input; },
  } };
  let active = ["read", "bash", "unrelated_pending_mcp"];
  const listeners = new Map<string, Function[]>();
  extension({ getActiveTools: () => toolHost ? toolHost.getActiveToolNames() : active, setActiveTools: (names: string[]) => { if (toolHost) toolHost.setActiveToolsByName(names); else active = names; }, events: { emit(name: string) { for (const fn of listeners.get(name) ?? []) fn(); }, on(name: string, fn: Function) { listeners.set(name, [...listeners.get(name) ?? [], fn]); } }, registerCommand(name: string, value: any) { commands.set(name, value); }, registerTool(value: any) { tool = value; }, on(name: string, value: Function) { handlers.set(name, value); }, appendEntry(customType: string, data: unknown) { branch.push({ type: "custom", customType, data }); } } as any);
  return { handlers, commands, tool, branch, selections, ctx, active: () => active, options: () => selectedOptions, setInput: (v: string | undefined) => { input = v; } };
}
const questions = [{ id: "goal", header: "Goal", question: "Which scope?", options: [{ label: "Small (Recommended)", description: "Limited changes." }, { label: "Large", description: "Broad changes." }] }];
test("default off; exact template appended only after explicit on; branch state and off work", async () => {
  const h = harness(); const hook = h.handlers.get("before_agent_start")!;
  assert.equal(await hook({ systemPrompt: "Pi base" }, h.ctx), undefined);
  await h.commands.get("codex-plan").handler("on", h.ctx);
  const options = { sections: {} as Record<string,string> };
  assert.equal(await hook({ systemPrompt: "Pi base", systemPromptOptions: options, prompt: "implement now" }, h.ctx), undefined);
  assert.equal(options.sections.codex_inspired_plan, ADAPTER + PLAN);
  assert.equal(isPlan(h.branch), true);
  assert.equal(isPlan([]), false);
  assert.equal(isPlan([{ type: "custom", customType: STATE_TYPE, data: { enabled: "yes" } }]), false);
  await h.commands.get("codex-plan").handler("off", h.ctx);
  assert.equal(await hook({ systemPrompt: "Pi base" }, h.ctx), undefined);
  assert.equal(isPlan(h.branch.slice(0, 2)), true);
});
test("input is rejected outside Plan, without UI, with empty options, or when cancelled", async () => {
  const h = harness(); const run = () => h.tool.execute("id", { questions }, undefined, undefined, h.ctx);
  await assert.rejects(run, /Default mode/);
  await h.commands.get("codex-plan").handler("on", h.ctx);
  h.ctx.hasUI = false; await assert.rejects(run, /interactive UI/); h.ctx.hasUI = true;
  await assert.rejects(() => h.tool.execute("id", { questions: [{ ...questions[0], options: [] }] }, undefined, undefined, h.ctx), /non-empty options/);
  await assert.rejects(run, /cancelled/);
  h.selections.push("Other (free-form answer)"); h.setInput(undefined); await assert.rejects(run, /cancelled/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => h.tool.execute("id", { questions }, controller.signal, undefined, h.ctx), /cancelled/);
});
test("UI retains option descriptions, adds Other and returns upstream response shape", async () => {
  const h = harness(); await h.commands.get("codex-plan").handler("on", h.ctx);
  h.selections.push("first");
  let r = await h.tool.execute("id", { questions }, undefined, undefined, h.ctx);
  assert.deepEqual(JSON.parse(r.content[0].text), { answers: { goal: { answers: ["Small (Recommended)"] } } });
  assert.match(h.options()[0], /Limited changes/); assert.equal(h.options().at(-1), "Other (free-form answer)");
  h.selections.push("Other (free-form answer)");
  r = await h.tool.execute("id", { questions }, undefined, undefined, h.ctx);
  assert.deepEqual(JSON.parse(r.content[0].text), { answers: { goal: { answers: ["custom answer"] } } });
});

test("selector is shared, branch-local, fail closed; master off clears manual Plan without affecting other owner", async () => {
  const h = harness(); const master = h.commands.get("codex-inspired"); const plan = h.commands.get("codex-plan");
  h.branch.push({ type: "custom", customType: STATE_TYPE, data: { enabled: true } });
  assert.equal(isPlan(h.branch), false, "old Plan flags require explicit new selection");
  await master.handler("on", h.ctx);
  assert.equal(selection(h.branch).mode, "master"); assert.equal(isPlan(h.branch), false);
  const count = h.branch.length; await master.handler("on", h.ctx); assert.equal(h.branch.length, count);
  await plan.handler("on", h.ctx); assert.equal(isPlan(h.branch), true);
  assert.equal(selection(h.branch).mode, "master");
  await plan.handler("off", h.ctx); assert.equal(selection(h.branch).mode, "master");
  await master.handler("off", h.ctx); assert.equal(selection(h.branch).owner, null);
  await plan.handler("on", h.ctx); assert.equal(selection(h.branch).mode, "manual");
  await master.handler("off", h.ctx); assert.equal(isPlan(h.branch), false);
  h.branch.push({ type: "custom", customType: SELECTOR_TYPE, data: { version: 1, owner: "claude", mode: "master" } });
  await master.handler("off", h.ctx); assert.equal(selection(h.branch).owner, "claude");
  h.branch.push({ type: "custom", customType: SELECTOR_TYPE, data: { version: 2, owner: "codex", mode: "master" } });
  assert.equal(selection(h.branch).owner, null);
});

test("real Pi runner restores fresh host prompt; exact source, live host contributions, and branch modes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-master-runner-"));
  try {
    const loaded = await discoverAndLoadExtensions([join(root, "extensions/index.ts")], dir, join(dir, "agent"));
    assert.deepEqual(loaded.errors, []);
    const branch: any[] = [];
    let active = ["read", "bash", "unrelated_mcp"];
    loaded.runtime.getActiveTools = () => active;
    loaded.runtime.setActiveTools = names => { active = names; };
    loaded.runtime.appendEntry = (customType: string, data: unknown) => { branch.push({ type: "custom", customType, data }); };
    const runner = new ExtensionRunner(loaded.extensions, loaded.runtime, dir, { getBranch: () => branch } as any, {} as any);
    const errors: unknown[] = []; runner.onError(e => errors.push(e));
    let rendered = "";
    loaded.extensions[0].handlers.get("before_agent_start")!.push(async (event: any) => { rendered = event.systemPrompt; });
    const context = { sessionManager: { getBranch: () => branch }, hasUI: false, ui: { notify() {}, setStatus() {} } } as any;
    const master = loaded.extensions[0].commands.get("codex-inspired")!;
    const plan = loaded.extensions[0].commands.get("codex-plan")!;
    const input = { cwd: dir, selectedTools: ["read", "bash"], toolSnippets: { read: "Read exact files" },
      toolGuidelines: { read: ["Preserve host tool guideline"] }, promptGuidelines: ["Keep extension guideline"],
      appendSystemPrompt: "User system addition", contextFiles: [{ path: "AGENTS.md", content: "Project rules survive" }],
      skills: [{ name: "test", description: "Test skill", filePath: "/test/SKILL.md", baseDir: "/test", sourceInfo: { path: "/test/SKILL.md", source: "test", scope: "user" as const, origin: "top-level" as const }, disableModelInvocation: false }],
      sections: { sibling: "Other extension contribution" } };
    const run = async (options = input) => runner.emitBeforeAgentStart({ messageType: "user", prompt: "task" }, options);
    await run(); const original = rendered;
    await master.handler("on", context);
    let result = await run(); assert.equal(result.systemPromptOptions.customPrompt, BASE + (await import("../extensions/mode.ts")).BASE_ADAPTER);
    assert.equal(result.systemPromptOptions.sections.codex_inspired_default, DEFAULT);
    assert.ok(rendered.startsWith(BASE));
    for (const text of ["Read exact files", "Preserve host tool guideline", "Keep extension guideline", "Project rules survive", "User system addition", "Other extension contribution", "/test/SKILL.md"]) assert.ok(rendered.includes(text), text);
    assert.deepEqual(input.sections, { sibling: "Other extension contribution" }, "runner clones turn options");
    const saved = branch.slice();
    await plan.handler("on", context); result = await run(); assert.equal(result.systemPromptOptions.sections.codex_inspired_plan, ADAPTER + PLAN);
    await master.handler("off", context); await run(); assert.equal(rendered, original);
    const changed = { ...input, appendSystemPrompt: "Changed live host setting" }; await run(changed); assert.ok(rendered.includes("Changed live host setting")); assert.ok(!rendered.includes(BASE));
    await master.handler("on", context); await run(); assert.ok(rendered.startsWith(BASE));
    branch.splice(0, branch.length); await run(); assert.equal(rendered, original, "branch without selector is off");
    branch.push(...saved); await run(); assert.ok(rendered.startsWith(BASE), "branch resume restores selector");
    await runner.emitBeforeAgentStart({ messageType: "user", prompt: "task" }, { ...input, forceSystemPrompt: "Opaque other plugin prompt" }); assert.equal(rendered, "Opaque other plugin prompt");
    await runner.emitBeforeAgentStart({ messageType: "user", prompt: "task" }, { ...input, customPrompt: "User custom prefix" }); assert.ok(rendered.startsWith("User custom prefix")); assert.ok(!rendered.includes(BASE));
    const unusual = { ...input, sections: { ...input.sections, rules: "Custom host rules", tools: "Custom tools survive", docs: "Custom docs survive" } };
    await runner.emitBeforeAgentStart({ messageType: "user", prompt: "task" }, unusual);
    for (const text of ["Custom host rules", "Custom tools survive", "Custom docs survive"]) assert.ok(rendered.includes(text));
    assert.ok(!rendered.includes(BASE), "unseparable custom section ordering fails closed");
    assert.deepEqual(errors, []);
    assert.equal(loaded.extensions[0].tools.get("codex_plan_request_user_input")!.definition.exposure, "deferred");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("master off cancels pending UI and never returns a default answer", async () => {
  const h = harness(); await h.commands.get("codex-plan").handler("on", h.ctx);
  let signal: AbortSignal | undefined;
  h.ctx.ui.select = (async (_title: string, _options: string[], options: { signal: AbortSignal }) => {
    signal = options.signal;
    return new Promise(resolve => options.signal.addEventListener("abort", () => resolve(undefined), { once: true }));
  }) as any;
  const pending = h.tool.execute("id", { questions }, undefined, undefined, h.ctx);
  assert.ok(signal);
  await h.commands.get("codex-inspired").handler("off", h.ctx);
  assert.equal(signal.aborted, true);
  assert.deepEqual(h.tool.prepareLoadout(), { hiddenDeclarations: ["codex_plan_request_user_input"] });
  assert.deepEqual(h.active(), ["read", "bash", "unrelated_pending_mcp", "codex_plan_request_user_input"]);
  await assert.rejects(pending, /cancelled/);
});

test("real Pi loadout/projection hides disabled tool and preserves pending MCP activation", async () => {
  // Exercise real host algorithms with isolated state, no user files or model credentials.
  const session: any = Object.create(AgentSession.prototype);
  session.agent = { state: { tools: [{ name: "read" }, { name: "unrelated" }] } };
  session._pendingToolNames = new Set(["mcp_delayed_server_tool"]);
  session._toolRegistry = new Map(session.agent.state.tools.map((t: any) => [t.name, t]));
  session._toolDefinitions = new Map(); session._toolPromptGuidelines = new Map();
  session._getToolExposure = () => "direct"; session._isActivatable = () => true;
  session._getCallableTools = () => [...session._toolRegistry.values()];
  session._rebuildSystemPrompt = () => {};
  session._extensionRunner = { emitError(error: unknown) { throw error; } };
  session._hiddenDeclarations = new Set();
  session._installHiddenDeclarationsProjection();
  const h = harness(session);
  session._toolRegistry.set(h.tool.name, h.tool);
  session._toolDefinitions.set(h.tool.name, { definition: h.tool, sourceInfo: { path: "test" } });
  await h.commands.get("codex-plan").handler("on", h.ctx);
  assert.equal(session._hiddenDeclarations.size, 0);
  const messages = [{ role: "system", toolsAdded: [...session.agent.state.tools], timestamp: 0 }];
  assert.equal((await session.agent.transformContext(messages))[0].toolsAdded.length, 3);
  await h.commands.get("codex-inspired").handler("off", h.ctx);
  assert.deepEqual(session.getActiveToolNames(), ["read", "unrelated", h.tool.name]);
  assert.deepEqual([...session._pendingToolNames], ["mcp_delayed_server_tool"]);
  assert.deepEqual((await session.agent.transformContext(messages))[0].toolsAdded.map((t: any) => t.name), ["read", "unrelated"]);
  await assert.rejects(() => h.tool.execute("id", { questions }, undefined, undefined, h.ctx), /unavailable/);
  await h.commands.get("codex-plan").handler("on", h.ctx);
  assert.equal((await session.agent.transformContext(messages))[0].toolsAdded.length, 3);
  await h.handlers.get("before_agent_start")!({ systemPrompt: "opaque", systemPromptOptions: { forceSystemPrompt: "opaque", sections: {} } }, h.ctx);
  assert.ok(session._hiddenDeclarations.has(h.tool.name));
  await assert.rejects(() => h.tool.execute("id", { questions }, undefined, undefined, h.ctx), /blocked/);
});
