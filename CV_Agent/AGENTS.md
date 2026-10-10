# CV_Agent 工作区约定

求职投递工作台的固定根路径为 `/Users/tang/Documents/Bid_Analysis/CV_Agent`。处理本产品任务时，以该目录作为工作目录。

## 文件归属

| 内容 | 相对本工作区的路径 |
|---|---|
| 总 PRD、分期 PRD、模块规格、数据模型和接口文档 | `docs/` |
| 架构图、分期图及交互图源文件 | `docs/diagrams/` |
| 实现代码 | `src/` |
| 脱敏样例及测试输入 | `data/` |
| 测试 | `tests/` |
| 编译产物、验证报告和交付文件 | `outputs/` |

现有 PRD 入口为 `README.md`，后续文档应接入该索引。同名的父级 `docs/`、`src/`、`data/`、`tests/` 和 `outputs/` 属于招投标项目，不作为本产品的输出位置。

已有个人简历、面试材料和招投标文件继续保留原位置；仅在任务明确涉及它们时引用或处理。本产品相关新文件统一保存在本工作区。

开发协作、审查独立性和争议处理参考 `docs/09_Agent协作治理与项目交付.md`。当前一期任务以 `docs/10_一期实施与验收任务台账.md` 为入口，任务记录使用 `docs/11_任务交接与裁决模板.md`。同一作者的自测和自审不得称为独立 QA；未实际执行的测试、未启动的 Agent 和未核验的投递不得标记已完成。

多 Agent 并行协作规则以 `docs/12_简历系统多Agent并行协作.md` 为准；角色职责、读写边界和稳定项目记忆保存在 `docs/workflow/agent_memory.md`。新任务开始时先读取该记忆、任务卡和相关契约；任务级结果不要回写角色记忆。

本目录继续遵循父级 `AGENTS.md` 与 `.codex/full_permission_debug_rules.md`；在本目录内执行时，该规则文件的相对路径为 `../.codex/full_permission_debug_rules.md`。
