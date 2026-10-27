import type { NormalizedBuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";

/** Pi 1.4.0's exact default prefix. Unknown host shapes fail closed, never sliced heuristically. */
export const PI_14_PREAMBLE = "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.";
const HOST_SECTION = "codex_inspired_host";
const MARKER = "PI_CODEX_RENDER_PROBE_7b706584";
type PromptEvent = { readonly systemPrompt: string; systemPromptOptions: NormalizedBuildSystemPromptOptions };

/** Uses only the public live renderer and mutable options; no private Pi imports. */
export function replacePreamble(event: PromptEvent, source: string): string | undefined {
  const options = event.systemPromptOptions;
  if (options.forceSystemPrompt !== undefined || options.customPrompt !== undefined)
    return "custom/opaque host prompt cannot be safely replaced; host left unchanged";
  if (Object.hasOwn(options.sections, HOST_SECTION))
    return "owned host section already exists; host left unchanged";
  const before = event.systemPrompt;
  let probe: string;
  try {
    options.customPrompt = MARKER;
    probe = event.systemPrompt;
  } catch {
    return "host live prompt renderer unavailable; host left unchanged";
  } finally {
    options.customPrompt = undefined;
  }
  if (!probe.startsWith(MARKER) || !before.startsWith(PI_14_PREAMBLE))
    return "unsupported Pi prompt shape (requires Pi 1.4.0); host left unchanged";
  const suffix = probe.slice(MARKER.length);
  if (!before.endsWith(suffix)) return "host section order cannot be preserved; host left unchanged";
  const end = suffix.length ? before.length - suffix.length : before.length;
  const generated = before.slice(PI_14_PREAMBLE.length, end);
  if (before !== PI_14_PREAMBLE + generated + suffix ||
      !generated.startsWith("\n\n<tools>\n") || !generated.endsWith("</docs>"))
    return "host generated sections differ from Pi 1.4.0; host left unchanged";
  options.customPrompt = source;
  // customPrompt suppresses Pi's generated sections. Preserve their exact rendered bytes,
  // not a reimplementation of tool guidance, and leave all other live options intact.
  options.sections[HOST_SECTION] = generated;
  return undefined;
}
