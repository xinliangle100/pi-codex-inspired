import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverAndLoadExtensions, loadSkillsFromDir } from "@earendil-works/pi-coding-agent";
import { ADAPTER, PLAN, STATE_TYPE, isPlan } from "../extensions/mode.ts";
import extension from "../extensions/index.ts";
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
    assert.deepEqual([...result.extensions[0].commands.keys()], ["codex-plan"]);
    assert.deepEqual([...result.extensions[0].tools.keys()], ["codex_plan_request_user_input"]);
    const m = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(m.private, true); assert.equal(m.version, "0.2.0");
    assert.deepEqual(m.pi, { extensions: ["./extensions/index.ts"] });
    assert.equal(existsSync(join(root, "skills")), false);
    assert.deepEqual(loadSkillsFromDir({ dir, source: "test" }).skills, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function harness() {
  const handlers = new Map<string, Function>(); const commands = new Map<string, any>(); let tool: any;
  const branch: any[] = []; const selections: (string | undefined)[] = []; let selectedOptions: string[] = []; let input: string | undefined = "custom answer";
  const ctx = { hasUI: true, sessionManager: { getBranch: () => branch }, ui: {
    setStatus() {}, notify() {}, async select(_title: string, options: string[]) { selectedOptions = options; const value = selections.shift(); return value === "first" ? options[0] : value; }, async input() { return input; },
  } };
  extension({ registerCommand(name: string, value: any) { commands.set(name, value); }, registerTool(value: any) { tool = value; }, on(name: string, value: Function) { handlers.set(name, value); }, appendEntry(customType: string, data: unknown) { branch.push({ type: "custom", customType, data }); } } as any);
  return { handlers, commands, tool, branch, selections, ctx, options: () => selectedOptions, setInput: (v: string | undefined) => { input = v; } };
}
const questions = [{ id: "goal", header: "Goal", question: "Which scope?", options: [{ label: "Small (Recommended)", description: "Limited changes." }, { label: "Large", description: "Broad changes." }] }];
test("default off; exact template appended only after explicit on; branch state and off work", async () => {
  const h = harness(); const hook = h.handlers.get("before_agent_start")!;
  assert.equal(await hook({ systemPrompt: "Pi base" }, h.ctx), undefined);
  await h.commands.get("codex-plan").handler("on", h.ctx);
  assert.deepEqual(await hook({ systemPrompt: "Pi base", prompt: "implement now" }, h.ctx), { systemPrompt: "Pi base" + ADAPTER + PLAN });
  assert.equal(isPlan(h.branch), true);
  assert.equal(isPlan([]), false);
  assert.equal(isPlan([{ type: "custom", customType: STATE_TYPE, data: { enabled: "yes" } }]), false);
  await h.commands.get("codex-plan").handler("off", h.ctx);
  assert.equal(await hook({ systemPrompt: "Pi base" }, h.ctx), undefined);
  assert.equal(isPlan(h.branch.slice(0, 1)), true);
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
