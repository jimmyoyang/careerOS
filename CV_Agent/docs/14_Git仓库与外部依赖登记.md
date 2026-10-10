# Git 仓库与外部依赖登记

版本：0.1；日期：2026-10-09；状态：登记基线。

本文记录当前与 `CV_Agent` 相关的本地仓库、简历项目仓库和候选 Agent 框架仓库。它只记录来源和用途，不代表已经安装、接入或验证。凭据、Cookie、API Key 和私有仓库内容不得写入本文。

## 1. 本地仓库

| 名称 | 本地路径 | Git边界 | 远程仓库 | 与本项目关系 | 当前状态 |
|---|---|---|---|---|---|
| `CV_Agent` | `/Users/tang/Documents/Bid_Analysis/CV_Agent` | 不是独立 Git 根目录，属于父级仓库 | `git@github.com:jimmyoyang/bid-analysis.git` | 本产品的 PRD、协作规范、未来代码和测试工作区 | 文档已建立，尚无实现验收 |
| `bid-analysis` | `/Users/tang/Documents/Bid_Analysis` | 父级 Git 仓库 | `git@github.com:jimmyoyang/bid-analysis.git` | 承载 `CV_Agent`，同时包含原招投标项目 | 现有仓库，修改时需区分本产品与父级项目 |

`CV_Agent` 不应被误写成一个已经独立发布的简历系统仓库。若未来需要独立版本、独立 CI 或独立权限，再单独建立仓库并记录迁移决策；当前不自动拆分父级仓库。

## 2. 简历与项目证据仓库

| 名称 | URL | 本地状态 | 用途 | 使用边界 |
|---|---|---|---|---|
| `gee-agent` | [github.com/haofanfredliao/gee-agent](https://github.com/haofanfredliao/gee-agent) | 未在本工作区克隆 | 作为用户简历中 GEE-Agent 项目的代码、README、Demo 和项目 PRD/需求文档入口 | 只作为用户提供的项目证据，不自动修改、不代用户宣称未验证指标 |

该仓库与 `CV_Agent` 是两个不同项目。`CV_Agent` 负责简历事实、JD适配和投递工作流；`gee-agent` 负责被写入简历的个人项目证据。

## 3. 候选 Agent 框架仓库

| 框架 | 官方仓库 | 选型角色 | 当前决定 | 本地状态 |
|---|---|---|---|---|
| Paperclip | [github.com/PaperclipAI/paperclip](https://github.com/PaperclipAI/paperclip) | Agent团队控制面 | 中期首选 | 计划使用本地 `paperclipai` CLI，尚未完成运行验证 |
| LangGraph | [github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 有状态工作流和恢复 | 后续按复杂度引入 | 未接入 |
| Microsoft Agent Framework | [github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework) | Python/.NET企业级编排 | 当前不采用 | 未接入 |
| AG2 | [github.com/ag2ai/ag2](https://github.com/ag2ai/ag2) | 多 Agent 对话和协商 | 当前不采用主控 | 未接入 |
| MetaGPT | [github.com/FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | 软件公司式角色 SOP | 仅参考，不作为核心 | 未接入 |
| Codex | [github.com/openai/codex](https://github.com/openai/codex) | 本地执行 Agent | 当前执行面 | 由当前 Codex 环境使用，不代表已形成多 Agent 服务 |

## 4. 运行和依赖登记

| 组件 | 记录位置或入口 | 数据范围 | 当前限制 |
|---|---|---|---|
| Paperclip本地脚本 | `scripts/paperclip-start.sh`、`scripts/paperclip-status.sh`、`scripts/paperclip-stop.sh` | 计划只使用本地脱敏任务 | 未启动、未验证重启持久化 |
| Paperclip实施计划 | `docs/superpowers/plans/2026-10-09-paperclip-control-plane.md` | 控制面验证步骤 | 计划不是运行报告 |
| Paperclip架构决策 | `docs/workflow/decisions/ADR-20261009-paperclip-control-plane.md` | 选型理由、边界和验证门槛 | `accepted_for_validation` 不等于已运行 |
| Agent长期记忆 | `docs/workflow/agent_memory.md` | 角色边界和稳定规则 | 不保存任务级结果或个人隐私 |
| 任务与证据 | `docs/workflow/`、`outputs/verification/` | 版本化任务和审查证据 | 敏感内容必须脱敏 |

## 5. 引入与更新规则

1. 新框架先登记官方仓库、用途、版本和决定，再进入实现任务。
2. 只记录公开仓库 URL 和非敏感版本信息；不记录 Token、Cookie、密码、邮箱验证码或私有数据。
3. “已登记”不等于“已安装”，“已安装”不等于“已运行”，“已运行”不等于“已通过验收”。
4. 框架升级、远程地址变化或采用决定变化时，追加决策记录，不覆盖旧记录。
5. 外部简历项目仓库只作为事实证据来源；简历文案仍须经过事实库和 QA 流程。

## 6. 下一步

中期优先验证 Paperclip 本地控制面：回环绑定、脱敏任务创建、任务交接、文件所有权冲突、停止/重启后的状态恢复和无外部模型运行。验证通过后，再决定是否接入实际 Agent 运行器；在此之前，真实账号、邮箱、验证码和真实投递保持关闭。
