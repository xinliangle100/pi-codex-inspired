import { readFileSync } from "node:fs";
export const STATE_TYPE = "codex-plan-mode-v1";
export const PLAN = readFileSync(new URL("../upstream/codex/codex-rs/collaboration-mode-templates/templates/plan.md", import.meta.url), "utf8");
/** Adapter only; the upstream text below is never rewritten. */
export const ADAPTER = `\n\n[Pi transport adapter, NOT upstream Codex instructions]\nThe following unchanged Codex Plan template is active because the user explicitly enabled /codex-plan on. Pi has no equivalent developer-message collaboration-mode transport: only the user's /codex-plan off command ends this adapter mode; ordinary requests to execute do not. The upstream tool name request_user_input maps exclusively to codex_plan_request_user_input, this package's blocking Pi UI adapter; call that prefixed tool instead to avoid collisions with other extensions. update_plan is not implemented; do not call it. <proposed_plan> is plain text in Pi, not a special rendered widget. Existing Pi tools remain available: this is a prompt constraint, NOT a read-only sandbox.\n[End Pi transport adapter; unchanged upstream template follows]\n\n`;
export function isPlan(entries: readonly { type: string; customType?: string; data?: unknown }[]): boolean {
  let enabled = false;
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === STATE_TYPE && typeof entry.data === "object" && entry.data !== null && "enabled" in entry.data && typeof entry.data.enabled === "boolean") enabled = entry.data.enabled;
  }
  return enabled;
}
