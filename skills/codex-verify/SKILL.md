---
name: codex-verify
description: Verify a coding change against the requested behavior, project conventions, and current working state before reporting completion. Select meaningful checks, distinguish actual results from untested claims, and identify material remaining risks without forcing exhaustive testing for every edit.
---

# Close the loop with evidence

Verify the change the user requested, not an imagined larger project. This skill does not authorize new fixes, infrastructure changes, publication, or actions outside the user's scope.

## Inspect what changed

Use the current diff or equivalent change evidence and the relevant project instructions. Check for unrelated edits and preserve other people's work. Compare the implementation with the accepted approach and nearby patterns, especially responsibility boundaries, registration points, interface compatibility, and state/data ownership when affected.

A different implementation is not automatically a defect. Explain a concrete violated requirement, invariant, or affected caller before asking for rework. Avoid style-only findings unless style violates an applicable rule or obscures behavior.

## Select and run proportionate checks

- Start with the smallest check that exercises the changed behavior or reproduces the bug. Inspect the test entry point so a successful command is not mistaken for coverage of unrelated code.
- Run required project checks when applicable. Expand coverage for failures, wider dependencies, boundary changes, or unresolved risks, not simply to accumulate green commands.
- Include meaningful failure paths when the change affects them, such as invalid inputs, retries, cancellation, concurrent state changes, or compatibility.
- Use builds, static checks, manual inspection, or existing tests as appropriate. Do not install a framework, add dependencies, or perform external mutations merely to satisfy a checklist.
- Before running a check, consider whether it modifies snapshots, databases, external services, or tracked files and whether those effects are authorized. "Test" is not synonymous with read-only.

Record the command or action, its scope, observed result, and the state it verified. A process that is still running has not passed. An exit code of zero alone does not establish sufficient behavioral coverage. Do not claim tests passed because source code looks correct or because the model expects a command to succeed.

If relevant code changes after verification, invalidate the affected result and re-run the appropriate check. A fixed HEAD commit is insufficient when uncommitted files changed; use a content/diff identity or explicitly track which working state was checked. Account for checks that mutate the working state themselves.

## Resolve or report limitations

When a check fails, distinguish a regression from a pre-existing or environmental failure using available evidence. Fix and re-check only within the authorized task. Do not silently repair unrelated failures or call the whole change verified because an unrelated suite was skipped.

Use precise outcome labels: **passed**, **failed**, **not run**, or **blocked**. For a blocked check, state the reason, what can still be concluded, and the smallest next action. Do not retry indefinitely or create monitoring without a request.

An independent review can help for consequential changes, but is optional. Give it the requirement and actual changed code, ask for actionable source-backed findings, and verify those findings before changing the implementation. A reviewer's confidence score or an empty findings list is not proof of correctness.

## Completion summary

Report briefly:

- What behavior changed and where it fits in the existing design.
- Which checks actually completed and what they cover.
- Remaining failures, unverified behavior, or material risks.

Keep routine details concise and avoid claiming a broader assurance than the evidence supports. If the user requested verification only, report findings without modifying code. If this completes authorized implementation, finish without inventing another approval gate.

This skill is advisory. It cannot block an agent from finishing or enforce test evidence without a separately implemented and enabled runtime mechanism.
