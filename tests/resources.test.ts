import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

const root = fileURLToPath(new URL("..", import.meta.url));

test("real Pi skill discovery accepts all three package skills without diagnostics", () => {
  const result = loadSkillsFromDir({ dir: resolve(root, "skills"), source: "package-test" });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.skills.map(s => s.name).sort(), ["codex-explore", "codex-plan", "codex-verify"]);
  for (const skill of result.skills) {
    assert.equal(skill.disableModelInvocation, false);
    assert.ok(skill.description.length > 20);
    assert.ok(existsSync(skill.filePath));
  }
});

test("manifest points at existing resources and does not bundle host runtime dependencies", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, "UNLICENSED");
  assert.deepEqual(manifest.pi.extensions, ["./extensions/index.ts"]);
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
  for (const path of [...manifest.pi.extensions, ...manifest.pi.skills]) assert.ok(existsSync(resolve(root, path)));
  for (const name of ["@earendil-works/pi-coding-agent", "typebox"]) {
    assert.equal(manifest.peerDependencies[name], "*");
    assert.equal(manifest.dependencies?.[name], undefined);
  }
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
});
