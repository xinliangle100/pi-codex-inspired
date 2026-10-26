# 初版验证记录

日期：2026-10-26。版本：0.1.0。测试环境：Node.js 24.22.1、Pi 1.4.0、TypeScript 5.9.3、typebox 1.3.27。用户实际安装版本未检查。

## 已执行

- `npm run typecheck`：通过。
- `npm test`：19 项通过，0 失败。包含默认关闭、独立开关、不调用活动工具名单 API、状态完整替换与逻辑清除、分支恢复、无效快照 fail-closed、长度限制、常见凭据形状拒绝、取消不保存、保持原始提示词与其他上下文。
- 使用真实 Pi `discoverAndLoadExtensions`，在独立临时 cwd/agentDir 加载 Extension：通过，无用户设置或认证访问，无模型调用。
- 使用真实 Pi `loadSkillsFromDir`：3 个 Skills 均发现，0 条诊断。
- 使用 Pi 的实际工具默认激活判定，确认 `defaultActive:false` 不自动把检查点工具暴露给模型；包含正向对照。
- 三个 Skill 通过 skill-creator 的 frontmatter/name 检查。
- `npm pack --dry-run --ignore-scripts`：通过；打包列表无 node_modules、用户配置、SSH 密钥或本地 Git 元数据。

## 独立复核及修复

独立审查发现第一版虽然在工具执行处拒绝关闭状态调用，却仍默认将检查点工具加入模型工具列表。初步修复又触及 Pi 的名单 setter：移除一个工具可能清掉其他尚未注册工具的恢复队列。最终采用 `exposure: deferred` 和 `defaultActive:false`，完全不调用活动工具名单 setter，并提供显式 JSON 命令备用入口；因此不把宿主的这个边缘行为带入本包。关闭检查点功能时，发现工具不等于能成功保存。对应默认激活、无工具名单调用及命令入口的回归测试均已通过。

## 一次合成行为冒烟

独立 Agent 只获得三个 Skill、一个小型 Node 导出工具及 CSV 功能需求，没有获得评分标准或预期实现。它检查实际入口、registry 和已有 formatter 后，新增一个 sibling renderer 并注册，未改 service/plain 或加入依赖。

- 基准测试：2/2 通过。
- 改动后：8/8 通过，覆盖逗号、双引号、换行转义及原有行为。
- 改动后验证完成，没有再修改样本。

这是在可丢弃样本中的一次独立 Agent 冒烟，不是通过用户 Pi 模型/provider 运行的配对实验，也不是证明减少返工。标量/nullish 行为有未明确要求的兼容性推断，已在结果中注明。

## 未验证

- 用户真实项目、真实 Pi 配置及旧版 API 兼容。
- 模型驱动的真实 compaction 质量和长期任务效果。单元测试使用模拟压缩形状的历史；实际 loader 测试不等于运行完整会话。
- 与原始 Pi、Codex 产品或 Claude Code 产品的性能优劣。
- 自动测试执行门禁、强制只读模式、权限沙箱；这些并未实现。
- GitHub 远程创建/推送、npm 发布或用户环境安装；这些不是本地包检查的一部分。

下一步使用 `evaluation.md` 的相同任务起点、模型、思考等级和验收标准做重复对照。不得把本记录中的通过项升级描述为“架构正确”“无损记忆”或“与 Codex 等效”。
