import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { STATE_TYPE, PLAN, ADAPTER, isPlan } from "./mode.ts";

/** Only mode transport and human-input UI are adapted; no new planning workflow. */
export default function codexPlan(pi: ExtensionAPI): void {
  const enabled = (ctx: ExtensionContext) => isPlan(ctx.sessionManager.getBranch());
  const status = (ctx: ExtensionContext) => {
    if (ctx.hasUI) ctx.ui.setStatus("codex-plan", enabled(ctx) ? "Codex Plan prompt ON (not sandboxed)" : undefined);
  };
  pi.registerCommand("codex-plan", {
    description: "Explicit Codex Plan prompt adapter: on | off | status (default off)",
    async handler(args, ctx) {
      const action = args.trim() || "status";
      if (action !== "on" && action !== "off" && action !== "status") {
        ctx.ui.notify("Usage: /codex-plan on | off | status", "error"); return;
      }
      if (action !== "status") pi.appendEntry(STATE_TYPE, { enabled: action === "on" });
      status(ctx);
      ctx.ui.notify(`Codex Plan prompt: ${enabled(ctx) ? "ON; prompt-only mutation restriction, not a sandbox" : "OFF"}`, "info");
    },
  });
  pi.on("session_start", async (_event, ctx) => status(ctx));
  pi.on("session_tree", async (_event, ctx) => status(ctx));
  pi.on("before_agent_start", async (event, ctx) => {
    if (enabled(ctx)) return { systemPrompt: event.systemPrompt + ADAPTER + PLAN };
  });
  pi.registerTool({
    name: "codex_plan_request_user_input",
    label: "Codex Plan user input (Pi adapter)",
    description: "Request user input for one to three short questions and wait for the response. This tool is only available in Plan mode. Pi adapter: requires interactive UI; cancellation returns an error, never a default answer.",
    parameters: Type.Object({ questions: Type.Array(Type.Object({
      id: Type.String({ description: "Stable identifier for mapping answers (snake_case)." }),
      header: Type.String({ description: "Short header label shown in the UI (12 or fewer chars)." }),
      question: Type.String({ description: "Single-sentence prompt shown to the user." }),
      options: Type.Array(Type.Object({ label: Type.String({ description: "User-facing label (1-5 words)." }), description: Type.String({ description: "One short sentence explaining impact/tradeoff if selected." }) }, { additionalProperties: false }), {
        description: 'Provide 2-3 mutually exclusive choices. Put the recommended option first and suffix its label with "(Recommended)". Do not include an "Other" option in this list; the client will add a free-form "Other" option automatically.',
      }),
    }, { additionalProperties: false }), { description: "Questions to show the user. Prefer 1 and do not exceed 3" }) }, { additionalProperties: false }),
    async execute(_id, params, signal, _update, ctx) {
      if (!enabled(ctx)) throw new Error("request_user_input is unavailable in Default mode");
      if (!ctx.hasUI) throw new Error("Pi adapter requires interactive UI; no answer was collected. Do not invent an answer.");
      if (params.questions.some(q => q.options.length === 0)) throw new Error("request_user_input requires non-empty options for every question");
      const answers: Record<string, { answers: string[] }> = Object.create(null);
      for (const q of params.questions) {
        if (signal?.aborted) throw new Error("request_user_input was cancelled before receiving a response");
        const choices = q.options.map((o, i) => `${i + 1}. ${o.label} — ${o.description}`);
        const other = "Other (free-form answer)";
        const chosen = await ctx.ui.select(`${q.header}: ${q.question}`, [...choices, other], { signal });
        let answer: string | undefined;
        if (chosen === other) answer = await ctx.ui.input(q.question, "Your answer", { signal });
        else if (chosen !== undefined) answer = q.options[choices.indexOf(chosen)]?.label;
        if (answer === undefined || signal?.aborted) throw new Error("request_user_input was cancelled before receiving a response");
        answers[q.id] = { answers: [answer] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ answers }) }], details: { answers } };
    },
  });
}
