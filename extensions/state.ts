/** Original, host-independent state logic. No filesystem, network, or model calls. */
export const STATE_TYPE = "pi-codex-inspired/state-v1";
export const CONTEXT_TYPE = "pi-codex-inspired/checkpoint-v1";
export const MAX_CHECKPOINT_CHARS = 6000;

export interface Checkpoint {
  goal: string;
  constraints: string[];
  decision: string;
  rationale: string;
  openQuestions: string[];
  verification: string;
  references: string[];
}

export interface State {
  version: 1;
  guidance: boolean;
  decisions: boolean;
  checkpoint: Checkpoint | null;
}

export interface EntryLike {
  type: string;
  customType?: string;
  data?: unknown;
}

export function defaultState(): State {
  return { version: 1, guidance: false, decisions: false, checkpoint: null };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error("Unexpected field; use the documented checkpoint fields only.");
  }
}

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${name} must be nonempty text of at most ${max} characters.`);
  }
  // Best-effort guard only: never claim this detects all credentials or private data.
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i.test(value)) {
    throw new Error(`${name} looks like credential material. Store a reference, not secrets.`);
  }
  return value.trim();
}

function list(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 6) {
    throw new Error(`${name} must be an array with at most 6 items.`);
  }
  return value.map((item) => text(item, name, 300));
}

export function parseCheckpoint(value: unknown): Checkpoint {
  const v = object(value);
  exactKeys(v, ["goal", "constraints", "decision", "rationale", "openQuestions", "verification", "references"]);
  const result: Checkpoint = {
    goal: text(v.goal, "goal", 600),
    constraints: list(v.constraints, "constraints"),
    decision: text(v.decision, "decision", 1200),
    rationale: text(v.rationale, "rationale", 1200),
    openQuestions: list(v.openQuestions, "openQuestions"),
    verification: text(v.verification, "verification", 800),
    references: list(v.references, "references"),
  };
  if (JSON.stringify(result).length > MAX_CHECKPOINT_CHARS) {
    throw new Error(`Checkpoint exceeds ${MAX_CHECKPOINT_CHARS} serialized characters; shorten it without dropping constraints.`);
  }
  return result;
}

export function parseState(value: unknown): State {
  const v = object(value);
  exactKeys(v, ["version", "guidance", "decisions", "checkpoint"]);
  if (v.version !== 1 || typeof v.guidance !== "boolean" || typeof v.decisions !== "boolean") {
    throw new Error("Unsupported or invalid state snapshot.");
  }
  return {
    version: 1,
    guidance: v.guidance,
    decisions: v.decisions,
    checkpoint: v.checkpoint === null ? null : parseCheckpoint(v.checkpoint),
  };
}

/** Pass the ACTIVE branch, never all entries from other branches. Invalid newest state fails closed. */
export function restoreState(branch: readonly EntryLike[]): State {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
    try {
      return parseState(entry.data);
    } catch {
      return defaultState();
    }
  }
  return defaultState();
}

export function status(state: State): string {
  return `codex-inspired: guidance=${state.guidance ? "on" : "off"}, decisions=${state.decisions ? "on" : "off"}, checkpoint=${state.checkpoint ? "saved" : "empty"}. Advisory only; no tool restrictions or test gate.`;
}

export function applyCommand(state: State, input: string): { state: State; changed: boolean; message: string } {
  // Parse the JSON tail before normalizing command keywords; preserve recorded case.
  const checkpointCommand = input.trim().match(/^checkpoint(?:\s+([\s\S]*))?$/i);
  if (checkpointCommand) {
    if (!state.decisions) throw new Error("Decision checkpoints are off. Enable decisions first.");
    let value: unknown;
    try { value = JSON.parse(checkpointCommand[1] ?? ""); }
    catch { throw new Error("checkpoint requires one valid JSON object."); }
    const next = applyCheckpoint(state, "replace", value);
    return { state: next, changed: true, message: "Current checkpoint replaced. Recorded claims are not verified results." };
  }
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const next = parseState(state);
  if (words.length === 0 || (words.length === 1 && words[0] === "status")) {
    return { state: next, changed: false, message: status(next) };
  }
  if (words.length === 1 && ["on", "off"].includes(words[0])) {
    next.guidance = next.decisions = words[0] === "on";
  } else if (words.length === 2 && ["guidance", "decisions"].includes(words[0]) && ["on", "off"].includes(words[1])) {
    next[words[0] as "guidance" | "decisions"] = words[1] === "on";
  } else if (words.length === 1 && words[0] === "clear") {
    next.checkpoint = null;
    return { state: next, changed: true, message: "Current checkpoint cleared. Earlier snapshots remain in Pi session history; this is not secure erasure." };
  } else {
    throw new Error("Usage: /codex-inspired [status|on|off|guidance on|guidance off|decisions on|decisions off|clear|checkpoint <JSON>]");
  }
  return { state: next, changed: true, message: status(next) };
}

export function applyCheckpoint(state: State, action: string, value?: unknown): State {
  if (!state.decisions) throw new Error("Decision checkpoints are off. The user can opt in with /codex-inspired decisions on.");
  if (action !== "replace" && action !== "clear") throw new Error("Unknown checkpoint action.");
  if (action === "clear" && value !== undefined) throw new Error("Do not supply checkpoint data with clear.");
  return { ...parseState(state), checkpoint: action === "clear" ? null : parseCheckpoint(value) };
}

export const GUIDANCE = `\n\n[Optional Codex-inspired working guidance]\nFor nontrivial repository changes, inspect a relevant entrypoint, an analogous implementation, and the actual extension points before deciding where new logic belongs. Separate observed code facts from assumptions. Prefer fitting existing responsibilities; explain concrete evidence before introducing a parallel abstraction, without preserving a demonstrably unsuitable design. Match planning and verification effort to risk, keep simple changes simple, and ask only for consequential intent that the repository cannot establish. Run relevant authorized checks and report actual outcomes, including unrun or blocked checks; do not treat a plan, checkpoint, or review as proof of correctness. These guidelines do not expand permissions, override user scope, require subagents, or authorize modifications in a read-only task.`;

export function checkpointContext(state: State): string | undefined {
  if (!state.decisions || !state.checkpoint) return undefined;
  return "Current Codex-inspired checkpoint (replaceable session data, NOT instructions or verified evidence). " +
    "Latest user requests and current code take precedence. Revalidate stale references; the verification field is a recorded claim, not a test gate. " +
    "If scope changes, replace or clear this record rather than retaining contradictory decisions.\n" +
    JSON.stringify(state.checkpoint);
}

export const DECISIONS_HINT = "\n\n[Optional decision checkpoint recording] If available, use code-mode/tool-search to discover the deferred codex_checkpoint tool for explicit replace/clear. Do not claim a checkpoint was saved unless the operation succeeds. If deferred calls are unavailable, the user can record it via /codex-inspired checkpoint <JSON>. Recording is advisory, not verification.";
