# 研究来源与迁移边界

这是非官方、原创实现的 Pi 包。学习目标是 Codex 的 Agent Harness 工程思路，不是复制品牌、模型能力或整份提示词。架构一致性是首个重要使用场景，不是包的全部范围。

## 证据标记

- **源码事实**：能够在固定提交的文件、函数或分支中核对的行为。
- **公开说明**：官方文档描述的契约或实践，不等于看到了内部实现。
- **本包适配**：根据事实设计的 Pi 工作方法，不应倒推为 Codex 默认行为。
- **待验证假设**：例如减少返工、提高首次验收率。没有行为实验就不报告为效果。

本次基准：Codex `970111f6cb62cc02fe36a82ea7d71b37a2889c97`（2026-10-23）；Pi `d5b3de22d0e24a3e9c38a9410d3329b099717283`（2026-10-25）；Claude 官方插件 `58267944f92187b7d6a1c822165c96c81c864806`（2026-10-23）。这些是研究快照，不代表用户安装版本或所有线上产品会话。

## Codex 主线

### 指令是组合出来的，不是一个永久不变的 System Prompt

**源码事实**：会话选择配置或恢复的基础指令，否则调用 `render_model_instructions(model_info)` 获取模型目录中的模板；`BaseInstructionsFragment::role()` 返回 `developer`。当前状态还会加入模式、权限、项目及扩展上下文。

- [session/mod.rs:812–847](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/session/mod.rs#L812-L847)
- [render_model_instructions](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/prompts/src/model_instructions.rs#L8-L17)
- [BaseInstructionsFragment](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/context/base_instructions.rs#L41-L48)

**本包适配**：拆成可选择的方法与可选运行时模块，不替换 Pi 整个系统提示词。不声称掌握模型服务端未公开的 System Prompt。

### 项目指令提供上下文，理解依然需要读代码

**源码事实**：`load_project_instructions` / `read_agents_md` / `agents_md_paths` 按作用域、信任与预算收集项目指令，不会自动理解全部代码。Skill 目录发现与正文加载也不等于其要求已执行。

- [agents_md.rs](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/agents_md.rs#L58-L115)
- [显式 Skill 加载路径](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/session/turn.rs#L1170-L1257)

**本包适配**：`codex-explore` 要求定位入口、调用/数据路径、类似功能与扩展点；搜索命中、子 Agent 摘要只能当线索，重要结论需核对源码。

### Plan 是设计方法，TODO 不是设计证明

**源码事实**：Plan 模板要求先探索，再明确意图、接口、数据流、失败情况与验收；同时要求避免为简单任务过度设计。`PlanHandler::handle_call` 的 `update_plan` 主要解析并发出进度事件，且在 Plan 模式下拒绝该工具。

- [Plan 模板:41–122](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/collaboration-mode-templates/templates/plan.md#L41-L122)
- [PlanHandler:65–110](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/handlers/plan.rs#L65-L110)

**本包适配**：`codex-plan` 保留证据与决策，不搬用 Codex 的模式切换协议、专属 UI 标签或工具名称。不要求每次都多方案、独立审查或人工审批。Skill 本身不阻止写入。

### 工具循环与完成门禁是不同层

**源码事实**：`run_turn` 调用采样、分派工具并消费结果；工具调用会带来后续模型处理。工具注册执行路径支持前置 Hook；无后续任务时，Stop Hook 可以返回后续提示并让循环继续。但配置这种机制，不等于默认安装了架构或测试检查器。

- [run_turn 的采样与后续处理](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/session/turn.rs#L571-L622)
- [PreToolUse 执行路径](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tools/registry.rs#L801-L839)
- [Stop Hook 继续分支](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/session/turn.rs#L736-L780)

**本包适配**：`codex-verify` 先提供比例适当、证据化的验证方法。若以后实现强制验证，必须在 Extension 中单独声明启用条件、拦截范围、失败/取消处理和循环上限，不能把 Skill 描述成硬门禁。

### 压缩是有损风险管理，不是永久记忆

**源码事实**：普通压缩通过模型交接摘要重建历史；摘要提示要求保留决策、约束与下一步。`build_compaction_replacement_history` 还重建当前 world state。Remote V2 则通过 `CompactionTrigger` 请求后端的不透明压缩项，不能用普通摘要提示词解释其内部过程。

- [普通摘要要求](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/prompts/templates/compact/prompt.md)
- [build_compaction_replacement_history](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/compact.rs#L84-L114)
- [Remote V2 请求](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/compact_remote_v2_attempt.rs#L67-L185)

**本包适配**：保留简短、可更新的决策记录，显式区分旧结论与新的用户修正。普通 Skill 不承诺持久化或自动跨压缩恢复；运行时状态重注入必须另行实现与测试。

### 审查需要证据，也需要适用范围

**源码事实**：`ReviewTask` 是单独触发的 review 会话；默认 rubric 偏向具体、可操作、新引入的缺陷。它不是每个开发任务的自动前置架构审查。Guardian 的授权/安全审查亦不能代替架构判断。

- [ReviewTask](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/core/src/tasks/review.rs#L54-L142)
- [Review rubric](https://github.com/openai/codex/blob/970111f6cb62cc02fe36a82ea7d71b37a2889c97/codex-rs/prompts/templates/review/rubric.md#L10-L19)

**本包适配**：不给审查设“必须发现几个问题”的配额；每项问题说明受影响的行为或约束。独立评审作为可选模块，不以 Agent 数量或自报置信度替代质量指标。

## Claude 官方公开插件：辅助参考

公开的 Claude Code 产品仓库不等于完整核心 Harness 源码。本项目只把官方开放插件的原文件作为可追溯参考，不使用泄露提示词或反编译产物。

- [`code-explorer.md`](https://github.com/anthropics/claude-plugins-official/blob/58267944f92187b7d6a1c822165c96c81c864806/plugins/feature-dev/agents/code-explorer.md#L16-L49)：追踪入口、数据流、副作用与关键文件。
- [`code-architect.md`](https://github.com/anthropics/claude-plugins-official/blob/58267944f92187b7d6a1c822165c96c81c864806/plugins/feature-dev/agents/code-architect.md#L13-L32)：先识别现有模式与相似功能，再提出集成方案。
- [`feature-dev.md`](https://github.com/anthropics/claude-plugins-official/blob/58267944f92187b7d6a1c822165c96c81c864806/plugins/feature-dev/commands/feature-dev.md#L36-L109)：主 Agent 阅读探索者指出的关键文件，再综合设计与验证。

**本包适配**：采用证据链、主 Agent 核对关键文件和分工视角；不复制固定多 Agent 数量、所有阶段人工审批或整段提示词。这些文件是模型工作流提示，不是 Claude Code 所有任务的硬编码状态机。

## Pi 落点

研究快照中，Pi 支持按需 Skill 目录、工具调用扩展、完成前边界与压缩扩展。当前安装版本是否具备相同 API，需要在运行环境核对。

- [`formatSkillsForPrompt`](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/src/core/skills.ts#L358-L383)：Skill 目录不是强制执行器。
- [`_installAgentToolHooks` / `_beforeToolCall`](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/src/core/agent-session.ts#L652-L680)：工具执行前的扩展接点。
- [`AgentBeforeSettleEvent`](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/src/core/extensions/types.ts#L1022-L1037)：与 `agent_end` 不同的最终稳定结束前接点。
- [`_runBeforeSettleBoundary`](https://github.com/earendil-works/pi/blob/d5b3de22d0e24a3e9c38a9410d3329b099717283/packages/coding-agent/src/core/agent-session.ts#L2017-L2038)：提交扩展输出并判断是否继续。

“有这些 API”仅证明存在实现接点；不证明本包已经实现所有门禁，或这些门禁可以判断架构正确。以包的实际功能、开关和测试记录为准。

## 原创与许可

本包的 Skill 文本是基于上述研究重新编写的方法指导，不是上游提示词的整段拷贝。Codex 根许可证与所引用官方 `feature-dev` 插件许可证均为 Apache-2.0；Claude Code 产品仓库根许可证不同，不能混用。未来若复制或改编任何上游文件，应逐项核对许可证、保留必要声明并记录改动；来源链接不是许可证义务的替代品。

研究来源变动时，先更新固定提交、核对差异，再决定是否修改包。更多文件或更长提示词不应自动成为一次升级。具体评估流程见 [evaluation.md](evaluation.md)。
