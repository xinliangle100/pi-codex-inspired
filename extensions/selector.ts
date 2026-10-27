/** Shared with pi-claude-code-inspired. Branch entries, never global configuration. */
export const SELECTOR_TYPE = "pi-inspired-selector/v1";
export type Selection = { version: 1; owner: "codex" | "claude" | null; mode: "master" | "manual" | null };
export type Entry = { type: string; customType?: string; data?: unknown };
export const NONE: Selection = { version: 1, owner: null, mode: null };
export function selection(entries: readonly Entry[]): Selection {
  let selected: Selection = NONE;
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== SELECTOR_TYPE) continue;
    const d = entry.data as Partial<Selection> | null;
    selected = d?.version === 1 && ((d.owner === null && d.mode === null) ||
      ((d.owner === "codex" || d.owner === "claude") && (d.mode === "master" || d.mode === "manual"))) ? d as Selection : NONE;
  }
  return selected;
}
