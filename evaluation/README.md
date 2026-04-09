---
type: evaluation
version: 1.0
created_at: 2026-04-08
---

# LLM Wiki 知识治理质量评估体系

## 这是什么

针对 LLM Wiki 知识治理系统的**设计审查框架**。从知识治理的本质出发，评估一套 wiki 系统是否能真正实现"知识编译器"的核心承诺。

## 核心理念

评估不是测试工程属性（接口一致性、状态机完整性），而是测试**知识治理质量属性**：

- 知识提取后有没有失真？
- 知识的来源能追溯吗？
- 矛盾知识如何处理？
- 过时知识会被发现吗？
- 人工审查是真的在筛选质量吗？
- 用户查询时能判断信息可信度吗？

## 12 个质量属性

| 层次 | # | 属性 |
|------|---|------|
| 知识进入 | 1 | 知识提取保真度 |
| 知识进入 | 2 | 来源可追溯性 |
| 知识结构 | 3 | 导航可达性 |
| 知识结构 | 4 | 知识关联准确性 |
| 知识一致性 | 5 | 冲突发现与解决 |
| 知识一致性 | 6 | 置信度准确性 |
| 知识时效性 | 7 | 陈旧知识处理机制 |
| 知识时效性 | 8 | 知识库活跃度 |
| 治理过程 | 9 | 人工审查有效性 |
| 治理过程 | 10 | 审查负担可控性 |
| 知识可用性 | 11 | 知识缺口主动发现 |
| 知识可用性 | 12 | 查询回答可信度标注 |

每个属性独立评分（0-10），**不合并总分**。

## 目录结构

```
evaluation/
├── README.md                          ← 本文件
├── SCORECARD.md                       ← 最新评分卡（由 A0 汇总 Agent 生成）
├── findings/                          ← 各维度详细评估报告
│   ├── 01-knowledge-ingestion.md      ← 属性1+2（A1 Agent 输出）
│   ├── 02-knowledge-structure.md      ← 属性3+4（A2 Agent 输出）
│   ├── 03-knowledge-consistency.md   ← 属性5+6（A3 Agent 输出）
│   ├── 04-knowledge-freshness.md     ← 属性7+8（A4 Agent 输出）
│   └── 05-governance-usability.md    ← 属性9-12（A5 Agent 输出）
├── protocols/                         ← 增强外部说服力的实验协议
│   ├── evidence-strengthening-roadmap.md
│   ├── real-log-replay-protocol.md
│   ├── rater-consistency-protocol.md
│   └── longitudinal-stability-protocol.md
└── framework/
    ├── scoring-rubric.md              ← 12个属性的评分标准（可复用）
    └── agent-prompts.md               ← 6个 Agent 的标准 prompt 模板
```

## 如何执行评估

### 方式一：Agent Teams 并行评估（推荐）

启动 5 个专家 Agent 并行读取设计文档，各自输出 findings，最后由汇总 Agent 生成 SCORECARD：

```
A1 → 属性1+2 → findings/01-knowledge-ingestion.md
A2 → 属性3+4 → findings/02-knowledge-structure.md
A3 → 属性5+6 → findings/03-knowledge-consistency.md
A4 → 属性7+8 → findings/04-knowledge-freshness.md
A5 → 属性9-12 → findings/05-governance-usability.md
          ↓（全部完成后）
A0 → 读取全部 findings → SCORECARD.md
```

每个 Agent 的具体 prompt 见 `framework/agent-prompts.md`。

### 方式二：单次手动评估

按 `framework/scoring-rubric.md` 中的评分标准，逐一阅读设计文档并打分。

## 何时重新评估

- 系统设计有重大变更（新增 Spec、修改核心流程）
- 落地使用 3 个月后（从设计审查切换为运行时评估）
- 发现系统性问题后（评估是否影响其他属性）

## 何时进入增强证明实验

当 frozen benchmark 已经得到“有效”结论，但仍需要继续证明：

1. 真实日志场景也成立
2. 多评审者判断具有一致性
3. 长周期运行不会退化

此时进入 `protocols/` 目录定义的下一阶段实验。

## 与 lint 的区别

| | lint（wiki-lint） | 评估框架 |
|--|------------------|----------|
| 对象 | 运行时数据（canon 页面、proposals） | 设计文档（specs、schemas） |
| 频率 | 定期/每次 compile 后 | 设计变更时/定期审查 |
| 输出 | 具体文件的问题列表 | 系统设计质量的综合判断 |
| 执行者 | AI 自动执行 | Agent Teams |
