# Validation boundary

`npm run check` runs TypeScript checking and offline tests:

- Every vendored file matches its fixed SHA-256 manifest; Plan used by the adapter equals the archived template.
- The real Pi 1.4.0 extension loader resolves the TypeScript module and registers the actual command/tool in isolated temporary directories, without reading user credentials or loading user extensions.
- No old Skill directory remains; manifest exports only this extension. Empty-resource discovery confirms there are no invented skills in the isolated test root.
- Default-off, explicit-on/off, current-branch restoration, unchanged base prompt and exact appended Plan text.
- Question handling rejects Default mode, absent UI, empty options, cancellation and aborted requests; preserves option descriptions, Other, and upstream JSON response shape.

These are local integration/unit tests. UI interactions in behavior tests are mocked; a real terminal/model end-to-end conversation has not been measured. The real Pi loader test does not imply an actual LLM obeyed the prompt. Tests do not establish architecture quality, fewer rewrites, absence of mutation, or compaction fidelity.

For manual use, test in a disposable repository: enter Plan, request implementation, confirm it keeps planning; answer a material clarification; inspect final tags; explicitly switch off then implement. A failure to obey is a model/prompt/runtime limitation, not evidence of a sandbox bypass (there is no sandbox here).

For later tuning, compare this frozen baseline to unmodified Pi on the same repository, model, reasoning level and task. Record initial-plan defects, architecture violations, unneeded refactors, test outcomes and human corrections. Do not advertise superiority without such evidence. No tuning rules or gates from this suggested evaluation are injected by the package.
