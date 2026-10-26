# Source map: facts, adapters, and unsupported runtime

All Codex links below use immutable commit `970111f6cb62cc02fe36a82ea7d71b37a2889c97`. `upstream/manifest.json` records the exact copied files and hashes. The repository snapshot is evidence, not a claim about every deployed Codex configuration.

## Executable subset: Plan

**Source facts**

- [`builtin_collaboration_mode_presets`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/models-manager/src/collaboration_mode_presets.rs) obtains bundled collaboration messages, places Plan text in `developer_instructions`, and sets Plan reasoning effort Medium.
- [`plan.md`](../upstream/codex/codex-rs/collaboration-mode-templates/templates/plan.md) is the actual three-phase prompt: environment → intent → implementation; distinguish discoverable facts from preferences, preserve material clarification, decision-complete final plan, no automatic execution. It says mode ends only by developer message, not ordinary user imperative. This is prompt behavior, not a compiled architecture evaluator.
- [`RequestUserInputHandler::handle_call`](../upstream/codex/codex-rs/core/src/tools/handlers/request_user_input.rs) checks root thread and allowed mode, parses/normalizes input, sets `is_blocking = mode == Plan`, waits for `session.request_user_input`, serializes accepted answers. Guardian answer retention later in that function is not ported.
- [`create_request_user_input_tool` / `normalize_request_user_input_tool_args`](../upstream/codex/codex-rs/core/src/tools/handlers/request_user_input_spec.rs) define questions/options, demand non-empty options, set free-form Other. “1–3 questions / 2–3 options” are schema descriptions, not numerical min/max restrictions in this source. This adapter preserves that distinction, rather than inventing hard quotas.
- [`PlanHandler::handle_call`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/handlers/plan.rs) rejects checklist updates in Plan mode; update_plan is not the Plan-mode architecture process. This package does not implement it.

**Pi adapter call chain**

`/codex-plan on|off` → `appendEntry(codex-plan-mode-v1, {enabled})` → `isPlan(getBranch())` → `before_agent_start` → existing Pi prompt + separate adapter notice + unchanged Plan template.

The boolean entry stores mode only. It is not a decisions ledger or a replacement compaction algorithm. Reading the active branch prevents a separate branch's mode entry from being blindly reused. Existing Pi session history/compaction handling remains Pi's responsibility.

Upstream `request_user_input` maps to namespaced `codex_plan_request_user_input` → mode/UI validation → sequential Pi `ui.select` (label + description + Other) / `ui.input` → `{answers:{id:{answers:[answer]}}}`. Cancellation/aborted signal/no UI errors, no fabricated answer. Unlike upstream client UI, questions appear sequentially, not in one combined form. No nonblocking Default-mode question flow, root/subagent detection, Guardian verification, or secret-input extension is implemented. This tool is registered on package load and rejects execution while mode is off; no global tool allowlist is changed.

The upstream template is not a Pi Skill because skill invocation cannot faithfully establish a persistent collaboration-mode transport. The package exposes only the explicit extension command.

## Reference-only material: do not confuse with a port

- [`ReviewTask::run` → `start_review_conversation`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tasks/review.rs) starts review under explicit task invocation, sets `base_instructions = REVIEW_PROMPT` and `initial_history = None`. The original [rubric](../upstream/codex/codex-rs/prompts/templates/review/rubric.md) is preserved but **not exported as a same-session skill**; that would not reproduce an independent review task. No automatic architecture review or testing gate is asserted.
- [Compaction prompt](../upstream/codex/codex-rs/prompts/templates/compact/prompt.md) is a source artifact only. This package does not run Codex local/remote compaction, retain encrypted server state, rewrite Pi summaries, or guarantee lossless context.
- [`models.json`](../upstream/codex/codex-rs/models-manager/models.json) preserves the complete bundled model metadata, including the `gpt-6.1-sol` entry. It is not injected: it assumes Codex tools and environment. Bundled metadata is not proof that every deployment uses the same final prompt; configuration/model metadata resolution matters.

## Explicitly NOT ported

Codex model resolution, full system/developer instruction assembly, AGENTS.md search/budget/trust rules, tool router and concurrency locks, approval/sandbox policy, hooks, independent review task, review-target resolution, automatic validation gates, test runner, update_plan checklist, server/local compaction, multi-agent runtime, Codex plan rendering, model/reasoning selection.

Pi's existing behavior for these areas remains in effect. The adapter does not rebrand homemade substitutes as Codex features.

## Interpretation rather than fact

It is plausible that upstream Plan's exploration and clarification phases reduce premature architectural commitments; that is a hypothesis, not a measured result of this package. Whether the model actually reads enough files, understands the architecture, asks the right question, or produces maintainable code depends on model capability, task, tool access, and adherence. No code here proves a plan is decision complete or that an answer is architecturally correct.
