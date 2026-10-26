# pi-codex-inspired · source baseline 0.2

**先忠实学习，再单独微调。** 这版不是“我设计的一套 Codex 风格工作流”，而是一个有明确边界的 Pi package：运行 **Codex 原版 Plan 提示词**，加上必要的模式切换与问答 UI 适配。不是完整 Codex Harness，不保证比原生 Pi 更好。

上游固定为 [`openai/codex@970111f`](https://github.com/openai/codex/tree/970111f6cb62cc02fe36a82ea7d71b37a2889c97)。`upstream/codex/` 中所有文件均逐字节复制，来源及 SHA-256 在 [`upstream/manifest.json`](upstream/manifest.json)。这里的“忠实”指**原文和明确标注的子集语义**，不是跨宿主运行时等价。

## 安装与使用

需要已安装的 Pi（适配测试版本 `@earendil-works/pi-coding-agent@1.4.0`），Node >=22.19。

```sh
pi install git:github.com/xinliangle100/pi-codex-inspired
```

重新启动 Pi；对已有安装，可运行 `pi update git:github.com/xinliangle100/pi-codex-inspired` 后重启。无需为本包提供 GitHub token，也没有独立模型/API key；继续使用你已经配置的 Pi 模型授权。

```text
/codex-plan status
/codex-plan on
```

然后提出任务。模板按原顺序要求：先探索环境，再聊意图，再补足实现决策，最后输出 `<proposed_plan>`。保持原文中的提问条件、未答偏好时的默认规则及不自动执行规则；包本身不替用户填答案。完成计划后，由用户显式执行：

```text
/codex-plan off
```

再要求 Pi 实现。**不因“开始写代码”而自行退出 Plan，也不在最终计划末尾追加我们自创的确认流程。** 退出只停止后续模板注入，不清除已有聊天历史。

默认 Plan 关闭；不追加指导、不改模型/High设置。加载包仍会注册一个问答工具的 schema，关闭时调用会报错，并非完全零上下文开销。只有一个模式开关，没有 `codex-explore` / `codex-verify` 技能，也没有决策台账。

## 哪些是原文，哪些是适配

| 层 | 内容 |
|---|---|
| 原样源文件 | Plan、Review rubric、Compaction prompt、models.json、问答工具实现/规格和模式 preset；LICENSE/NOTICE。见 manifest。 |
| 可执行原文子集 | 仅 Plan 模板，在开启时每轮附加到现有 Pi system prompt，模板字节及阶段顺序不改。 |
| 必要 Pi 适配 | `/codex-plan on/off`、会话分支上的布尔模式状态、`before_agent_start` 注入、Pi 交互 UI 问答。`extensions/` 是本包代码，不是上游。 |
| 工具名映射 | 上游 `request_user_input` → `codex_plan_request_user_input`，在模板之外明确说明，避免覆盖其他扩展工具。选项与说明显示于 Pi select，自动追加 Other/free-form，结果用原响应结构返回。 |
| 仅供学习 | Review、Compaction、模型模板没有注册成执行技能或注入。不能把同会话读 rubric 宣称为独立 ReviewTask。 |

**重要限制：** Pi 没有这里所需的 Codex developer-channel 模式传输；使用 Pi system prompt 尾部附加，明确不完全等价。没有移植 read-only sandbox：已有 bash/write/edit 仍可用，禁止修改只是上游提示词约束。不要在不可接受误修改的工作区把它当安全边界。无 UI 的打印模式不能完成交互问答；取消/中止返回错误，不自动选择第一项。无 Codex 特殊计划渲染，XML 标记只是文字。不会设置 Codex preset 的 Medium 推理档，保留你的 Pi 配置。

## 阅读与验证

- [源码路径、调用关系与实现边界](docs/sources.md)
- [测试范围与尚未验证内容](docs/validation.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

本地开发验证（不需要模型密钥，不安装到用户 Pi）：

```sh
npm ci --ignore-scripts
npm run check
npm pack --dry-run
```

0.1 中“查相似实现”的独立 explore 流程、自动指导、决策 checkpoint/ledger 和 verify 技能属于先前的自定义提炼，已全部移除。旧版保存在 `archive/adapted-v0.1`。本版不引入 Claude Code 规则；将来任何调优必须与这份基线分离并注明来源。
