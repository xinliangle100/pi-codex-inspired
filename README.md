# pi-codex-inspired · source baseline 0.3

**先忠实学习，再单独微调。** 本包在 Pi 中使用固定版本 Codex 的原版普通指导与 Plan 模板，提供用户要求的总开关。不是完整 Codex Harness，也没有“架构审查必过”或优于原生 Pi 的保证。

上游固定为 [`openai/codex@970111f`](https://github.com/openai/codex/tree/970111f6cb62cc02fe36a82ea7d71b37a2889c97)。`upstream/codex/` 原文件逐字节保留，[manifest](upstream/manifest.json) 记录 SHA-256。0.3 更新的是 **Pi 适配基线**，没有把上游固定版本伪称为实时最新版。

## 安装

需要 Pi **1.4.0**（`@earendil-works/pi-coding-agent`）和 Node >=22.19。其他 Pi 版本未验证；提示词结构不匹配会停止应用并报告 blocked。

```sh
pi install git:github.com/xinliangle100/pi-codex-inspired
```

已有安装：`pi update git:github.com/xinliangle100/pi-codex-inspired`，然后重启 Pi。沿用 Pi 已配置的模型与授权，无需本包专用 token/API key。

## 总开关

```text
/codex-inspired on
/codex-inspired status
/codex-inspired off
```

- **on**：启用普通开发指导，替换 Pi 1.4 默认开场部分，使用 `models.json` 中 `gpt-6.1-sol.model_messages.instructions_template` 原文；未开启 Plan 时，另用原版 Default 模式文本。之后直接聊天开发，不必每项任务输入小命令。
- **off**：停止本包后续提示词替换，并关闭手动 Plan；后续请求使用当时的原 Pi 提示词及其他扩展贡献，不恢复旧快照、不改配置。已发生的聊天、工具结果和代码更改不会被清除。
- **status**：仅查看 master/manual/Plan 状态、当前 Pi 模型及最近一次提示词适配阻塞原因，不启动任务。

默认关闭。状态随当前会话分支保存，恢复分支恢复该分支状态，新会话默认关闭。模型和 thinking level 完全沿用 Pi 当前设置，不强制 Sol/High/Medium。原文中的 Codex/GPT 身份是来源描述，不代表实际正在调用那个模型。

同时安装 Claude 包时，两包共用分支选择器；一次只激活一种。启用另一种会停止本包的后续指导和问答。对未激活的一方执行 off，不关闭正在使用的另一方。没有全局默认开关。

### 保留的小命令

```text
/codex-plan on
/codex-plan status
/codex-plan off
```

可单独开启原版 Plan，不要求先开总开关。总开关已开启时，Plan 是其可选模式；`/codex-plan off` 回到普通 Codex 指导。总开关关闭时单独启用 Plan，退出 Plan 后回到原 Pi。普通“开始实现”请求不自行退出 Plan。旧 0.2 会话中的 Plan 布尔值不会自行激活 0.3，需显式重新开启。

原 Plan 模板保持环境探索 → 意图澄清 → 实现决策 → `<proposed_plan>` 的原始内容，没有添加自创的相似实现检查、架构门禁或验证流程。

## 替换边界与适配

Pi 1.4 的 `before_agent_start.systemPromptOptions.customPrompt` 会同时隐藏内建工具说明。适配器先通过该事件的公开实时 renderer 对比，保留消失的原工具/rules/docs 文本，再替换默认开场。工具说明、项目 AGENTS.md、技能、用户附加提示词、其他扩展 section 均保留；规则段内 Pi 原有的简洁/路径提示也保留。探测使用精确版本前缀，不使用整段 prompt 正则改写。

**已有自定义 `customPrompt`、不透明 `forceSystemPrompt` 或无法安全分离的结构时，总开关请求保持记录，但当轮不应用指导并显示 blocked；不会覆盖用户或其他扩展的完整提示词。** 后执行的其他扩展仍可修改提示词，无法保证其兼容性。特别是后加载扩展若再修改 toolGuidelines / promptGuidelines，这些晚到的自动生成规则可能不会进入本包已保留的 host 文本；该加载组合需要单独验证，不能声称对所有插件透明兼容。普通独立 section 仍保留。off 不会撤销其他扩展的变更。

| 原文或能力 | 运行情况 |
|---|---|
| Sol instructions_template、Default 模式 | 总开关开启后使用精确原文，Pi system 层承载；并非完整 Codex System/Developer 组装。 |
| Plan 模板 | Plan 开启时使用精确原文；禁止修改是提示词约束，**没有只读沙箱**。 |
| request_user_input | 显式映射为 `codex_plan_request_user_input`；Pi select/input 显示选项说明与 Other，返回原答案结构，取消/无 UI 报错。 |
| 工具暴露 | 问答工具以 deferred 注册，初始不激活；Plan 开启时只追加本包工具。关闭时用 prepareLoadout 隐藏其模型声明，执行守卫仍拒绝调用；不删除工具名、不影响其他工具或待连接 MCP。历史工具声明/工具发现记录不能被擦除。 |
| Codex channels / functions.exec / async input / orchestrator skills / Apps | 不提供原工具；外置适配说明将沟通映射到 Pi 消息、文件与 shell 操作映射到实际已有工具。不伪造缺失工具。 |
| Review / Compaction / approvals / multi-agent / update_plan | 保留相关学习材料；没有移植这些运行时或自动质量门禁。 |

源模板逐字保留，适配说明单独标识；没有移植 Codex 的权限、审批、安全边界或特殊 Plan UI。无头打印模式无法完成交互问答。开关不会改变已在执行的任意第三方工具；本包等待中的问答会在切换时中止。模型是否理解代码库、是否遵守指导，仍取决于模型与任务，不能由原文复用保证。

## 阅读与验证

- [来源、关键函数、调用关系](docs/sources.md)
- [验证范围](docs/validation.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

```sh
npm ci --ignore-scripts
npm run check
npm pack --dry-run
```

旧自定义 0.1 保存在 `archive/adapted-v0.1`；0.2 原 Plan 基线保存在 `archive/source-baseline-v0.2`。0.3 的开关与宿主兼容层是用户要求的适配，不宣称来自 Codex。将来的方法调优应与原文基线分开标记。
