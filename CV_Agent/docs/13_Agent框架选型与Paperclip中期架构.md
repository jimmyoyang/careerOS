# Agent 框架选型与 Paperclip 中期架构

版本：0.1；日期：2026-10-09；状态：已决策，待本地验证。

## 1. 决策结论

`CV_Agent` 采用分层架构，不把所有职责压到一个 Agent 框架中：

```text
短期：Codex + 任务卡/结果包 + Git Worktree + 独立 QA
中期：Paperclip + Codex + MCP Policy + Git Worktree + Git/CI
后续：在确有复杂状态机需求时，再增加 LangGraph
```

用户已明确希望直接进入中期，减少自己作为消息中转站的负担。因此 Paperclip 是中期优先建设项，但“选定”不等于“已部署”：当前尚未启动 Paperclip、连接外部模型、读取招聘账号或执行真实投递。第一条简历链路仍需先用脱敏资料验证。

## 2. 各层职责

| 层 | 选型 | 负责内容 | 明确不负责 |
|---|---|---|---|
| 控制面 | Paperclip | 任务、负责人、状态、评论、审批、预算、审计和任务锁 | 事实真伪、语义裁决、浏览器密码和最终投递结果 |
| 工作流 | 暂不引入；后续评估 LangGraph | 复杂分支、暂停恢复、重试、人工介入和持久化状态 | 组织权限和 Git 合并 |
| 执行面 | Codex | 读取文件、修改代码和文档、运行测试、编译和受控工具调用 | 替用户确认事实和提交申请 |
| 工具权限 | MCP Policy | 工具白名单、敏感动作拦截和授权检查 | 操作系统级沙箱和 Git 合并 |
| 文件隔离 | Git Worktree | 并行任务的独立工作目录和变更快照 | 产品优先级和事实判断 |
| 质量门禁 | Git/CI + 独立 QA | Diff、测试、编译、回归和审查证据 | 代替用户作关键决定 |
| 最终授权 | 用户 | 个人事实、账号登录、验证码、费用和真实提交 | 不能由 Agent 代行 |

## 3. 框架评价

| 框架 | 适合的位置 | 当前判断 |
|---|---|---|
| Paperclip | Agent 团队控制面 | 最符合减少人工中转的目标，作为中期首选 |
| LangGraph | 有状态业务工作流 | 解决流程复杂度，不替代 Paperclip；后续按触发条件引入 |
| Microsoft Agent Framework | Python/.NET 企业级编排 | 当前没有 Azure/.NET 约束，暂不采用 |
| AG2 | 多 Agent 对话、协商和群聊 | 可用于研究辩论型协作，不作为简历流水线主控 |
| MetaGPT | 软件公司式角色 SOP | 可借鉴角色流程，但对本项目的事实与权限治理不够直接 |
| Codex | 本地执行 Agent | 现在直接使用，负责实际文件和测试操作 |

官方仓库定位可参考：[Paperclip](https://github.com/PaperclipAI/paperclip)、[LangGraph](https://github.com/langchain-ai/langgraph)、[Microsoft Agent Framework](https://github.com/microsoft/agent-framework)、[AG2](https://github.com/ag2ai/ag2)、[MetaGPT](https://github.com/FoundationAgents/MetaGPT) 和 [Codex](https://github.com/openai/codex)。框架版本和实现能力会变化，采用前仍需固定版本并做本地验证。

## 4. Paperclip 中的通信协议

Paperclip 负责传递任务状态和交接消息，工作区文件负责保存可复核事实。所有 Agent 交接都需要包含：

```yaml
task_id: 唯一任务编号
agent_id: 当前负责人
status: ready | in_progress | waiting_input | waiting_conflict | in_review | verified | blocked
read_scope: 允许读取的路径或任务产物
write_scope: 唯一允许写入的路径
input_refs: 输入版本和契约版本
artifact_refs: 输出文件、diff或报告
evidence_refs: 原文、事实来源、测试运行或截图位置
unresolved: 尚未解决的问题
next_action: 下一位负责人和动作
```

通信分工如下：

| 通信内容 | 主要位置 | 规则 |
|---|---|---|
| 谁负责、当前状态、阻塞和下一步 | Paperclip 任务与评论 | 用于唤醒和追踪，不作为事实来源 |
| 产品范围和接口 | `docs/` 契约与决策记录 | 版本化，改变后重新验收 |
| 用户事实和简历证据 | `data/profile/` 与事实报告 | 只能由用户确认的事实进入批准库 |
| 代码和文档变更 | Git Worktree 与 Diff | 单任务单写入者，集成由指定负责人完成 |
| QA结论和争议 | `docs/workflow/reviews/`、`disputes/`、`outputs/verification/` | 不覆盖旧结论，必须关联版本和复现证据 |

## 5. 简历系统的 Agent 分工

```text
Paperclip 主理人任务
├── 产品 Agent：用户任务、范围和验收
├── 事实库 Agent：个人经历和证据
├── JD Agent：岗位要求和匹配权重
├── 简历适配 Agent：候选岗位版本
├── 事实 QA Agent：真实性与夸大检查
├── LaTeX QA Agent：编译、页数和版面
└── 浏览器执行 Agent：后期页面读取和辅助填写
```

第一轮仍只能并行产品、事实库、JD 和 QA 规格四项；契约冻结后才生成简历版本；事实 QA 和 LaTeX QA 只读审查；主理人负责集成与争议裁决。Paperclip 可以自动派发和同步状态，但不能解除这些边界。

## 6. 冲突裁决

| 冲突 | 自动处理 | 最终依据 |
|---|---|---|
| 两个 Agent 要写同一文件 | Paperclip 标记冲突，Worktree 保留两份 Diff | 主理人决定合并顺序 |
| Agent 声称已完成但无产物 | Paperclip 保持未验证 | 结果包和运行证据 |
| 简历表达可能夸大 | 事实 QA 阻塞该版本 | 用户事实和来源记录 |
| 技术方案争议 | 各方提交一次结构化证据 | 最小可行实验或架构决策 |
| 主理人与作者角色冲突 | 调度新的审查实例 | 用户或独立审查结论 |
| 账号、邮箱、验证码或真实提交 | 任务暂停等待用户 | 用户明确授权和外部结果证据 |

Paperclip 解决的是“任务是否被占用、谁在处理、状态是否同步”；它不能独立解决“哪个语义判断正确”。后者必须依靠契约、事实来源、固定版本、QA 和主理人裁决。

## 7. 中期 Paperclip 验证门槛

在开放任何真实账号或外部模型前，必须完成：

| 验证项 | 通过条件 |
|---|---|
| 本地运行 | 只绑定 `127.0.0.1`，健康检查可复现 |
| 任务持久化 | 停止并重启后，脱敏任务、状态和交接记录可恢复 |
| 所有权 | 同一任务和同一写入范围不会被两个执行者同时修改 |
| 交接 | Agent 能通过任务评论和结果包找到下一个动作 |
| QA隔离 | QA只能读固定版本并写审查报告，不能覆盖候选简历 |
| 权限边界 | 未配置外部模型、邮箱、招聘网站和浏览器真实会话 |
| 回退 | Paperclip不可用时，仍能用本地任务卡完成单条简历链路 |

当前已有本地启动脚本和执行计划，但没有把“脚本存在”当作“控制面已部署”。

## 8. 后续引入 LangGraph 的条件

只有当以下问题在 Paperclip + Codex 方案中真实出现时，才加入 LangGraph：

- 流程需要多个条件分支和跨运行周期恢复；
- 用户确认会在多个节点暂停并恢复；
- 失败重试需要从中间节点继续，而不是重新运行；
- 语义争议需要固定的仲裁状态机；
- Paperclip 任务评论无法清晰表达业务运行状态。

在此之前，增加 LangGraph 只会增加一层状态和调试成本。

## 9. 不可宣称的状态

以下内容在完成实际验证前不得写成已完成：

- 多 Agent 已经自动互相通信；
- Paperclip 已经完成生产部署；
- Agent 已经独立完成简历验收；
- 浏览器已经接管招聘网站；
- 邮箱、验证码或真实投递已经自动化。

