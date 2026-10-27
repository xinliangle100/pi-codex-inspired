import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { STATE_TYPE, PLAN, ADAPTER, BASE, DEFAULT, BASE_ADAPTER, isPlan } from "./mode.ts";
import { SELECTOR_TYPE, NONE, selection, type Selection } from "./selector.ts";
import { replacePreamble } from "./prompt.ts";

/** Upstream source text plus explicitly requested Pi controls; no new coding workflow. */
export default function codexInspired(pi: ExtensionAPI): void {
  const enabled = (ctx: ExtensionContext) => isPlan(ctx.sessionManager.getBranch());
  const selected = (ctx: ExtensionContext) => selection(ctx.sessionManager.getBranch());
  let lastContext: ExtensionContext | undefined;
  let blocked: string | undefined;
  let visible = false;
  const toolName = "codex_plan_request_user_input";
  const updateTools = (ctx: ExtensionContext) => {
    lastContext = ctx;
    visible = enabled(ctx) && !blocked;
    const active = pi.getActiveTools();
    // Add or reproject the SAME names, never remove: Pi preserves unrelated pending MCP tools.
    pi.setActiveTools(visible ? [...new Set([...active, toolName])] : active);
  };
  const pendingInputs = new Set<AbortController>();
  const status = (ctx: ExtensionContext) => {
    lastContext = ctx;
    const state = selected(ctx);
    const master = state.owner === "codex" && state.mode === "master";
    const text = `Codex master: ${master ? "ON" : "OFF"}; mode: ${state.owner === "codex" ? state.mode : "off"}; Plan: ${enabled(ctx) ? "ON (prompt-only)" : "OFF"}; model: ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "not selected"}${blocked ? `; blocked: ${blocked}` : ""}`;
    if (ctx.hasUI) ctx.ui.setStatus("codex-inspired", state.owner === "codex" ? text : undefined);
    return text;
  };
  const select = (ctx: ExtensionContext, next: Selection) => {
    const current = selected(ctx);
    if (current.owner !== next.owner || current.mode !== next.mode) {
      pi.appendEntry(SELECTOR_TYPE, next);
      pi.events.emit(SELECTOR_TYPE, next);
    }
  };
  pi.events.on(SELECTOR_TYPE, () => {
    for (const controller of pendingInputs) controller.abort();
    blocked = undefined; if (lastContext) { updateTools(lastContext); status(lastContext); }
  });
  pi.registerCommand("codex-inspired", {
    description: "Codex coding guidance: on | off | status (default off; current model)",
    async handler(args, ctx) {
      const action = args.trim() || "status";
      if (!["on", "off", "status"].includes(action)) {
        ctx.ui.notify("Usage: /codex-inspired on | off | status", "error"); return;
      }
      if (action !== "status") blocked = undefined;
      if (action === "on") {
        if (selected(ctx).owner !== "codex") pi.appendEntry(STATE_TYPE, { enabled: false });
        select(ctx, { version: 1, owner: "codex", mode: "master" });
      }
      if (action === "off") {
        pi.appendEntry(STATE_TYPE, { enabled: false });
        if (selected(ctx).owner === "codex") select(ctx, NONE);
      }
      if (action !== "status") updateTools(ctx);
      ctx.ui.notify(status(ctx), "info");
    },
  });
  pi.registerCommand("codex-plan", {
    description: "Explicit Codex Plan prompt adapter: on | off | status (retained standalone)",
    async handler(args, ctx) {
      const action = args.trim() || "status";
      if (!["on", "off", "status"].includes(action)) {
        ctx.ui.notify("Usage: /codex-plan on | off | status", "error"); return;
      }
      if (action !== "status") blocked = undefined;
      if (action === "on") {
        const current = selected(ctx);
        select(ctx, { version: 1, owner: "codex", mode: current.owner === "codex" && current.mode === "master" ? "master" : "manual" });
        pi.appendEntry(STATE_TYPE, { enabled: true });
      }
      if (action === "off") {
        pi.appendEntry(STATE_TYPE, { enabled: false });
        if (selected(ctx).owner === "codex" && selected(ctx).mode === "manual") select(ctx, NONE);
      }
      if (action !== "status") pi.events.emit(SELECTOR_TYPE, selected(ctx));
      if (action !== "status") updateTools(ctx);
      ctx.ui.notify(status(ctx), "info");
    },
  });
  const refresh = async (_event: unknown, ctx: ExtensionContext) => {
    for (const controller of pendingInputs) controller.abort();
    blocked = undefined; updateTools(ctx); status(ctx);
  };
  pi.on("session_start", refresh);
  pi.on("session_tree", refresh);
  pi.on("before_agent_start", async (event, ctx) => {
    const state = selected(ctx);
    if (state.owner !== "codex") { blocked = undefined; updateTools(ctx); return; }
    blocked = undefined;
    if (!event.systemPromptOptions || event.systemPromptOptions.forceSystemPrompt !== undefined) {
      blocked = "host structured prompt unavailable or opaque override; guidance not applied";
    } else if (state.mode === "master") {
      blocked = replacePreamble(event, BASE + BASE_ADAPTER);
    }
    if (blocked) { updateTools(ctx); status(ctx); ctx.ui.notify(blocked, "warning"); return; }
    if (enabled(ctx)) event.systemPromptOptions.sections.codex_inspired_plan = ADAPTER + PLAN;
    else if (state.mode === "master") event.systemPromptOptions.sections.codex_inspired_default = DEFAULT;
    updateTools(ctx);
    status(ctx);
  });
  pi.registerTool({
    name: "codex_plan_request_user_input",
    label: "Codex Plan user input (Pi adapter)",
    exposure: "deferred",
    defaultActive: false,
    prepareLoadout: () => visible ? undefined : { hiddenDeclarations: [toolName] },
    description: "Request user input for one to three short questions and wait for the response. This tool is only available in Plan mode. Pi adapter: requires interactive UI; cancellation returns an error, never a default answer.",
    parameters: Type.Object({ questions: Type.Array(Type.Object({
      id: Type.String({ description: "Stable identifier for mapping answers (snake_case)." }),
      header: Type.String({ description: "Short header label shown in the UI (12 or fewer chars)." }),
      question: Type.String({ description: "Single-sentence prompt shown to the user." }),
      options: Type.Array(Type.Object({ label: Type.String({ description: "User-facing label (1-5 words)." }), description: Type.String({ description: "One short sentence explaining impact/tradeoff if selected." }) }, { additionalProperties: false }), {
        description: 'Provide 2-3 mutually exclusive choices. Put the recommended option first and suffix its label with "(Recommended)". Do not include an "Other" option in this list; the client will add a free-form "Other" option automatically.',
      }),
    }, { additionalProperties: false }), { description: "Questions to show the user. Prefer 1 and do not exceed 3" }) }, { additionalProperties: false }),
    async execute(_id, params, externalSignal, _update, ctx) {
      if (!enabled(ctx) || blocked) throw new Error("request_user_input is unavailable in Default mode or while prompt adaptation is blocked");
      if (!ctx.hasUI) throw new Error("Pi adapter requires interactive UI; no answer was collected. Do not invent an answer.");
      if (params.questions.some(q => q.options.length === 0)) throw new Error("request_user_input requires non-empty options for every question");
      const controller = new AbortController();
      pendingInputs.add(controller);
      const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;
      try {
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
        if (!enabled(ctx) || blocked) throw new Error("Codex Plan was disabled or blocked while waiting for user input");
        return { content: [{ type: "text", text: JSON.stringify({ answers }) }], details: { answers } };
      } finally { pendingInputs.delete(controller); }
    },
  });
}
