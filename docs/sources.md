# Source map: facts, adapters, and unsupported runtime

All Codex links below use immutable commit `970111f6cb62cc02fe36a82ea7d71b37a2889c97`. `upstream/manifest.json` records the exact copied files and hashes. The repository snapshot is evidence, not a claim about every deployed Codex configuration.

## Executable subset: Sol base, Default and Plan

**Source facts**

- [`models.json`](../upstream/codex/codex-rs/models-manager/models.json) → `models[slug=gpt-6.1-sol].model_messages.instructions_template` and `.collaboration_modes.default` provide the exact runtime ordinary guidance and Default text. Other nested model fields are not implicitly included.

- [`builtin_collaboration_mode_presets`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/models-manager/src/collaboration_mode_presets.rs) obtains bundled collaboration messages, places Plan text in `developer_instructions`, and sets Plan reasoning effort Medium.
- [`plan.md`](../upstream/codex/codex-rs/collaboration-mode-templates/templates/plan.md) is the actual three-phase prompt: environment → intent → implementation; distinguish discoverable facts from preferences, preserve material clarification, decision-complete final plan, no automatic execution. It says mode ends only by developer message, not ordinary user imperative. This is prompt behavior, not a compiled architecture evaluator.
- [`RequestUserInputHandler::handle_call`](../upstream/codex/codex-rs/core/src/tools/handlers/request_user_input.rs) checks root thread and allowed mode, parses/normalizes input, sets `is_blocking = mode == Plan`, waits for `session.request_user_input`, serializes accepted answers. Guardian answer retention later in that function is not ported.
- [`create_request_user_input_tool` / `normalize_request_user_input_tool_args`](../upstream/codex/codex-rs/core/src/tools/handlers/request_user_input_spec.rs) define questions/options, demand non-empty options, set free-form Other. “1–3 questions / 2–3 options” are schema descriptions, not numerical min/max restrictions in this source. This adapter preserves that distinction, rather than inventing hard quotas.
- [`PlanHandler::handle_call`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/handlers/plan.rs) rejects checklist updates in Plan mode; update_plan is not the Plan-mode architecture process. This package does not implement it.

**Pi adapter call chain (0.3)**

`/codex-inspired on|off` → `appendEntry(pi-inspired-selector/v1, {version:1, owner, mode})` → `selection(getBranch())` → `before_agent_start` → `replacePreamble` → exact Sol base text plus explicitly labeled compatibility layer. Default mode uses the exact `model_messages.collaboration_modes.default` string; Plan substitutes the unchanged bundled Plan template in its own section.

`/codex-plan on|off` additionally writes `codex-plan-mode-v1 {enabled}`. `isPlan` requires both a selected Codex owner and the Plan flag. Last valid-schema selector entry on the branch controls one owner; a malformed latest selector fails closed. Legacy flags alone never activate it. Turning a different package on suppresses this package. Master off also clears Plan; Plan off alone keeps an existing Codex master on. The shared event bus with the same selector name updates indicators and aborts pending package input; persisted branch entries, not bus messages, are authoritative.

Pi 1.4 `ExtensionRunner.emitBeforeAgentStart` normalizes/clones current options, exposes a live `systemPrompt` getter, and applies mutable `systemPromptOptions`. Its renderer `buildSystemPromptSections` suppresses generated tools/rules/docs when `customPrompt` is set. `extensions/prompt.ts::replacePreamble` uses a temporary marker through those public APIs to discover the exact suppressed text; it restores the probe in `finally`, verifies the known Pi 1.4 prefix and suffix, preserves generated sections verbatim, and only then writes the new prefix. No internal Pi renderer is imported. Unknown/custom/opaque prompt structures are left untouched and reported blocked. Remaining current options are not replaced or cached. With the selector off, the hook does nothing, so subsequent requests use fresh host configuration.

Upstream `request_user_input` maps to deferred `codex_plan_request_user_input` → mode/UI validation → Pi `ui.select` (label + description + Other) / `ui.input` → `{answers:{id:{answers:[answer]}}}`. No answer on cancellation/abort/no UI; mode is rechecked after the interaction. Switching modes aborts the pending UI signal. Questions appear sequentially, not in one combined form. Plan adds this tool to the existing active names. Off hides its declaration via prepareLoadout and reprojects the same active names; it never removes a name, which avoids clearing unrelated pending MCP tools in Pi 1.4. Execution remains guarded even if called through discovery/codemode. Root/subagent detection, Guardian verification and secret-input extension are not ported.

The session state stores controls only, not an architectural decision ledger or compaction replacement. The package never changes the host model, reasoning level, settings or credential sources.

## Additional source material and boundaries

- [`ReviewTask::run` → `start_review_conversation`](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tasks/review.rs) starts review under explicit task invocation, sets `base_instructions = REVIEW_PROMPT` and `initial_history = None`. The original [rubric](../upstream/codex/codex-rs/prompts/templates/review/rubric.md) is preserved but **not exported as a same-session skill**; that would not reproduce an independent review task. No automatic architecture review or testing gate is asserted.
- [Compaction prompt](../upstream/codex/codex-rs/prompts/templates/compact/prompt.md) is a source artifact only. This package does not run Codex local/remote compaction, retain encrypted server state, rewrite Pi summaries, or guarantee lossless context.
- [`models.json`](../upstream/codex/codex-rs/models-manager/models.json) preserves the complete bundled model metadata, including the `gpt-6.1-sol` entry. Only the exact Sol instructions_template and Default string are used at runtime, accompanied by explicit Pi capability mappings; other model metadata remains reference-only. Bundled metadata is not proof that every deployment uses the same final prompt; configuration/model metadata resolution matters.

## Explicitly NOT ported

Codex model resolution, full system/developer instruction assembly, AGENTS.md search/budget/trust rules, tool router and concurrency locks, approval/sandbox policy, hooks, independent review task, review-target resolution, automatic validation gates, test runner, update_plan checklist, server/local compaction, multi-agent runtime, Codex plan rendering, model/reasoning selection.

Pi's existing behavior for these areas remains in effect. The adapter does not rebrand homemade substitutes as Codex features.

## Interpretation rather than fact

It is plausible that upstream Plan's exploration and clarification phases reduce premature architectural commitments; that is a hypothesis, not a measured result of this package. Whether the model actually reads enough files, understands the architecture, asks the right question, or produces maintainable code depends on model capability, task, tool access, and adherence. No code here proves a plan is decision complete or that an answer is architecturally correct.
