# Validation boundary · 0.3

`npm run check` runs TypeScript checking and offline tests using Pi 1.4.0:

- All nine vendored files retain their pinned SHA-256; exact source Plan/base/default text is used.
- The real Pi extension loader resolves imports and registers both commands and the deferred question tool in isolated temporary directories, without user credentials or user extensions.
- The real Pi `ExtensionRunner.emitBeforeAgentStart` drives the public live prompt renderer, not a mocked prompt builder: on/off/on, fresh host settings after off, current-branch restore, Default/Plan transitions and untouched parent input options.
- Host tool snippets/guidelines, extension guidelines, user addendum, project context, skills and sibling sections survive the replacement. Custom/opaque prompts and unusual conflicting host-section order fail closed.
- Shared selector ignores stale 0.2 flags, is branch-local, rejects malformed latest entries, makes repeated master on idempotent, and does not let an inactive package's off disable its sibling.
- The real Pi `AgentSession` loadout, active-tool setter and hidden-declaration projection run against isolated state: disabling hides the package declaration while preserving unrelated tools and delayed MCP pending names. This is a host-algorithm regression test, not a network MCP connection test.
- Questions preserve descriptions/Other/response shape and reject off/no UI/empty options/cancellation/abort. Master off aborts a pending UI and never supplies a default answer.

No host model/settings mutation APIs are used. Tool activation is add-only; off reprojects identical active names and hides only the package declaration. Tests retain unrelated active names while disabling a previously activated package tool. Commands report the current model rather than selecting one. The package does not read or write user credentials/configuration. Real loader/runner tests do not establish actual model obedience or terminal rendering; UI selection behavior tests use mocked UI. A real LLM end-to-end comparison has not been measured.

Manual disposable-repository check: enable master and request a small implementation; inspect status; toggle Plan and answer a clarification; turn Plan off and implement; change host settings; turn master off and verify the next request uses the new host behavior. Repeat after tree navigation/resume. With both packages loaded, switch flavors and verify only the selected one guides future tasks. Unknown/custom host prompt should report blocked without replacing it.

No architecture quality, reduced rework, safety sandbox, lossless compaction, or parity with Codex is claimed. A later controlled comparison should hold model, reasoning level, repository and task fixed and record initial-plan defects, unneeded refactors, tests and human corrections. Those evaluation suggestions are not injected workflow rules.
