import { readFileSync } from "node:fs";
import { selection } from "./selector.ts";
export const STATE_TYPE = "codex-plan-mode-v1";
export const PLAN = readFileSync(new URL("../upstream/codex/codex-rs/collaboration-mode-templates/templates/plan.md", import.meta.url), "utf8");
/** Adapter only; the upstream text below is never rewritten. */
export const ADAPTER = `\n\n[Pi transport adapter, NOT upstream Codex instructions]\nThe following unchanged Codex Plan template is active because the user explicitly enabled /codex-plan on. Pi has no equivalent developer-message collaboration-mode transport: the user's /codex-plan off or /codex-inspired off command, or switching to the other inspired package, ends this adapter mode; ordinary requests to execute do not. The upstream tool name request_user_input maps exclusively to codex_plan_request_user_input, this package's blocking Pi UI adapter; call that prefixed tool instead, avoiding collisions with other extensions. The Pi adapter activates its declaration for Plan and hides it when Plan ends. update_plan is not implemented; do not call it. <proposed_plan> is plain text in Pi, not a special rendered widget. Existing Pi tools remain available: this is a prompt constraint, NOT a read-only sandbox.\n[End Pi transport adapter; unchanged upstream template follows]\n\n`;
export function isPlan(entries: readonly { type: string; customType?: string; data?: unknown }[]): boolean {
  let enabled = false;
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === STATE_TYPE && typeof entry.data === "object" && entry.data !== null && "enabled" in entry.data && typeof entry.data.enabled === "boolean") enabled = entry.data.enabled;
  }
  return enabled && selection(entries).owner === "codex";
}

const modelData = JSON.parse(readFileSync(new URL("../upstream/codex/codex-rs/models-manager/models.json", import.meta.url), "utf8"));
export const DEFAULT: string = modelData.models.find((m: { slug: string }) => m.slug === "gpt-6.1-sol").model_messages.collaboration_modes.default;
export const BASE: string = modelData.models.find((m: { slug: string }) => m.slug === "gpt-6.1-sol").model_messages.instructions_template;
export const BASE_ADAPTER = `

[Pi compatibility layer — not upstream Codex]
The preceding text is the exact pinned Codex gpt-6.1-sol instructions_template, used as coding guidance in Pi. Its Codex/GPT identity describes the source, not the actual current model. Keep the host model and thinking level. Pi's existing tool, project, and extension instructions remain authoritative for their actual capabilities. Codex commentary/final channels map to ordinary Pi progress and final messages; Codex developer-role transport is not available. Use only the tools actually declared by Pi: shell operations through the available shell tool and file operations through available read/edit/write tools. functions.exec, functions.request_user_input_async, orchestrator skills, tool_search, Apps, remote environments and auto-review are not supplied by this package; do not invent their availability. Use Pi's existing skill and tool discovery mechanisms where provided. No Codex sandbox, approvals engine, automatic review, compaction, multi-agent runtime or model routing is installed. Mode transport is controlled by the user’s /codex-inspired and /codex-plan commands and the shared active-package selector, not actual developer messages. In Plan mode, only request_user_input maps to codex_plan_request_user_input as described separately. Outside Plan that tool is unavailable.
[End Pi compatibility layer]
`;
