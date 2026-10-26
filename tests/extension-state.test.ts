import test from "node:test";
import assert from "node:assert/strict";
import {
  STATE_TYPE, MAX_CHECKPOINT_CHARS, defaultState, parseCheckpoint, restoreState,
  applyCommand, applyCheckpoint, checkpointContext, type Checkpoint,
} from "../extensions/state.ts";

const checkpoint = (): Checkpoint => ({
  goal: "Add CSV export using existing report handlers",
  constraints: ["Keep tenant filtering in the repository layer"],
  decision: "Add a handler to the existing export registry",
  rationale: "JSON export uses this extension point; no second router needed",
  openQuestions: ["Confirm maximum export size"],
  verification: "Not run; plan tenant-isolation and CSV escaping tests",
  references: ["src/export/registry.ts:register", "src/export/json.ts:exportJson"],
});
const entry = (data: unknown) => ({ type: "custom", customType: STATE_TYPE, data });

test("default state is off and no checkpoint is injected", () => {
  const s = defaultState();
  assert.equal(s.guidance, false);
  assert.equal(s.decisions, false);
  assert.equal(checkpointContext(s), undefined);
  assert.throws(() => applyCheckpoint(s, "replace", checkpoint()), /off/);
});

test("feature switches are independent, status is read-only, invalid commands do not alter state", () => {
  const initial = defaultState();
  const one = applyCommand(initial, "guidance on");
  assert.equal(one.state.guidance, true);
  assert.equal(one.state.decisions, false);
  assert.deepEqual(initial, defaultState());
  assert.equal(applyCommand(one.state, "status").changed, false);
  assert.throws(() => applyCommand(one.state, "guidance maybe"), /Usage/);
  const all = applyCommand(one.state, "on").state;
  assert.equal(all.decisions, true);
  assert.deepEqual(applyCommand(all, "off").state, defaultState());
});

test("replacement drops superseded decision and clear removes current context", () => {
  const on = applyCommand(defaultState(), "on").state;
  const first = applyCheckpoint(on, "replace", checkpoint());
  const corrected = { ...checkpoint(), decision: "Use async export jobs instead", rationale: "Confirmed exports exceed request timeout" };
  const next = applyCheckpoint(first, "replace", corrected);
  assert.equal(next.checkpoint?.decision, corrected.decision);
  assert.ok(!checkpointContext(next)?.includes(first.checkpoint!.decision));
  assert.equal(applyCheckpoint(next, "clear").checkpoint, null);
  assert.throws(() => applyCheckpoint(next, "clear", checkpoint()), /Do not supply/);
  assert.throws(() => applyCheckpoint(next, "append", checkpoint()), /Unknown/);
});

test("turning decisions off suppresses but preserves checkpoint; clear works while off", () => {
  const s = applyCheckpoint(applyCommand(defaultState(), "on").state, "replace", checkpoint());
  const off = applyCommand(s, "decisions off").state;
  assert.ok(off.checkpoint);
  assert.equal(checkpointContext(off), undefined);
  assert.ok(checkpointContext(applyCommand(off, "decisions on").state));
  assert.equal(applyCommand(off, "clear").state.checkpoint, null);
});

test("resume follows only current branch, empty branch defaults off, snapshots are not mutated", () => {
  const on = applyCommand(defaultState(), "on").state;
  const parent = entry(on);
  const branchA = [parent, entry(applyCheckpoint(on, "replace", checkpoint()))];
  const branchB = [parent, entry(applyCommand(on, "off").state)];
  assert.ok(restoreState(branchA).checkpoint);
  assert.equal(restoreState(branchB).decisions, false);
  assert.deepEqual(restoreState([]), defaultState());
  const restored = restoreState(branchA);
  restored.checkpoint!.constraints.push("new");
  assert.equal(restoreState(branchA).checkpoint!.constraints.length, 1);
});

test("malformed or future latest snapshot fails closed instead of resurrecting stale enabled state", () => {
  const on = entry(applyCommand(defaultState(), "on").state);
  assert.deepEqual(restoreState([on, entry({ version: 99, guidance: true })]), defaultState());
  assert.deepEqual(restoreState([on, entry({ ...defaultState(), checkpoint: {} })]), defaultState());
  assert.equal(restoreState([on, { type: "custom", customType: "unrelated", data: {} }]).guidance, true);
});

test("reject missing fields, wrong types, extra properties and oversized records", () => {
  assert.throws(() => parseCheckpoint({ goal: "only one field" }));
  assert.throws(() => parseCheckpoint({ ...checkpoint(), references: "not an array" }));
  assert.throws(() => parseCheckpoint({ ...checkpoint(), enabled: true }), /Unexpected/);
  assert.throws(() => parseCheckpoint({ ...checkpoint(), decision: "x".repeat(1201) }), /1200/);
  assert.throws(() => parseCheckpoint({ ...checkpoint(), references: Array(7).fill("x") }), /6/);
  const large = { ...checkpoint(), goal: "a".repeat(600), decision: "b".repeat(1200), rationale: "c".repeat(1200),
    constraints: Array(6).fill("d".repeat(300)), openQuestions: Array(6).fill("e".repeat(300)) };
  assert.throws(() => parseCheckpoint(large), new RegExp(String(MAX_CHECKPOINT_CHARS)));
});

test("common secret-shaped text rejected without promising general secret detection", () => {
  assert.throws(() => parseCheckpoint({ ...checkpoint(), rationale: "-----BEGIN OPENSSH PRIVATE KEY-----" }), /credential/);
  assert.throws(() => parseCheckpoint({ ...checkpoint(), references: ["github_pat_ExampleValueNotARealToken"] }), /credential/);
  assert.doesNotThrow(() => parseCheckpoint({ ...checkpoint(), references: ["config.env.example (variable names only)"] }));
});

test("context is bounded and describes verification as claims, not proof", () => {
  const s = applyCheckpoint(applyCommand(defaultState(), "on").state, "replace", checkpoint());
  const context = checkpointContext(s)!;
  assert.ok(context.length < MAX_CHECKPOINT_CHARS + 600);
  assert.match(context, /NOT instructions or verified evidence/);
  assert.match(context, /Latest user requests and current code take precedence/);
});
