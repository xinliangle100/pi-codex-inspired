---
name: codex-plan
description: Turn a nontrivial coding request into an evidence-grounded implementation approach with clear boundaries, tradeoffs, risks, and acceptance checks. Useful for cross-module features, new abstractions, interface changes, or uncertain implementation placement; keep straightforward edits lightweight.
---

# Plan the decisions that matter

Clarify enough of the task to avoid expensive wrong turns, without making planning a separate bureaucracy. A plan is a reasoning aid; a checklist is not evidence of correctness or completion.

## Ground the decision

Inspect relevant project instructions, entry points, an analogous implementation, and the proposed integration point before making claims about the codebase. If exploration was already performed, reuse its results but verify the decisive source locations yourself. Re-read evidence when the repository or requirement has changed; do not restart unrelated completed work.

Capture the goal, non-goals, acceptance conditions, and material constraints. Separate code facts from assumptions and user preferences. Investigate discoverable facts; ask only for unresolved choices that materially change the outcome or require authorization. Continue independent authorized work while a decision is pending.

## Fit the implementation to the problem

- Prefer established responsibility boundaries and extension points when they meet the requirement. Explain which existing path the new behavior follows and what is added or changed.
- For a new abstraction, parallel implementation, or moved responsibility, state why the current design is insufficient. Prefer a local adjustment over unrelated restructuring when both meet the requirement.
- Compare alternatives only when there is a real consequential tradeoff. Do not invent a second design for a routine change. For a tradeoff, explain the differing consequences and recommend one.
- Resolve the decisions that would otherwise force the implementer to guess: affected interfaces, state/data ownership, integration points, and important failure behavior. Include concurrency, compatibility, migration, or rollback only when relevant.
- Identify the riskiest unverified assumption and a cheap way to test it before substantial implementation. A narrow probe may be better than a longer plan.
- Define acceptance in terms of observable behavior, including meaningful failure cases, then select suitable checks. Do not require a new test framework or exhaustive testing by default.

Avoid both extremes: do not preserve a broken convention merely for consistency, and do not use a small feature as permission to redesign the project. A stable structure supports expected changes; it cannot guarantee that future requirements never require refactoring.

## Record a decision, not just tasks

For nontrivial work, keep a compact decision summary in the conversation:

- Goal and relevant constraints.
- Chosen approach and source-backed integration points.
- Important alternatives rejected and why, if any.
- Remaining assumptions and what would trigger reconsideration.
- Implementation order and behavioral acceptance checks.

Keep evidence locations and the distinction between verified and assumed information. Preserve this summary through handoffs or compaction using the tools actually available, but do not claim lossless retention. Do not create a persistent decision file or change session configuration without authorization. Supersede old decisions explicitly when new user direction or code evidence invalidates them.

## Continue at the right boundary

If the user asked for a plan or read-only analysis, deliver that and do not implement. If implementation is already authorized, a complete-enough plan is not a reason to stop for another generic "shall I proceed?" Ask only where the actual permission rules or unresolved material choice require it. Never treat silence as approval.

During implementation, revise the plan if evidence changes the approach. Mark tasks complete from work and checks actually performed, not from intention. Keep the user informed of material changes rather than replaying the full plan.

This skill does not enter Codex Plan mode, enforce a read-only sandbox, or install an automatic architecture reviewer.
