import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentSession, discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

test("actual Pi loader resolves extension, schema and registrations in isolated directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-codex-loader-"));
  try {
    // Explicit empty cwd/agentDir avoid loading any user's extensions, settings or credentials.
    const entry = fileURLToPath(new URL("../extensions/index.ts", import.meta.url));
    const loaded = await discoverAndLoadExtensions([entry], root, join(root, "agent"));
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    const extension = loaded.extensions[0];
    assert.ok(extension.commands.has("codex-inspired"));
    assert.ok(extension.tools.has("codex_checkpoint"));
    const registered = extension.tools.get("codex_checkpoint")!;
    assert.equal(registered.definition.defaultActive, false);
    assert.equal(registered.definition.exposure, "deferred");
    // Pinned-host regression check: execute Pi's actual registration-activation predicate,
    // without constructing a session or accessing auth. Private API intentionally test-only.
    const host = Object.create(AgentSession.prototype);
    host._toolDefinitions = new Map([["codex_checkpoint", registered]]);
    assert.equal(host._isActivatedOnRegistration("codex_checkpoint"), false);
    host._toolDefinitions.set("codex_checkpoint", { ...registered, definition: { ...registered.definition, defaultActive: true, exposure: "direct" } });
    assert.equal(host._isActivatedOnRegistration("codex_checkpoint"), true);
    assert.deepEqual([...extension.handlers.keys()].sort(), ["before_agent_start", "context", "session_start", "session_tree"]);
    // Loading itself must not require an initialized session/model runtime.
    assert.equal(extension.flags.size, 0);
    assert.equal(extension.shortcuts.size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
