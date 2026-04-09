---
name: wiki-maintain
description: 执行结构性维护（领域分裂/内容归档/MOC重组），触发关键词：维护、maintain、领域分裂
---

# Wiki Maintain Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/maintain.md` 中的完整 Spec。

## CLI 工具层

Spec 中标记为 ⚙️ 的步骤（系统统计、归档操作、索引更新、日志追加）**必须**通过 `wiki-ops` CLI 工具执行：

```bash
tools/wiki-ops.sh count all
tools/wiki-ops.sh scan --format json
tools/wiki-ops.sh frontmatter set <file> status "archived"
tools/wiki-ops.sh update-index --domain <domain> --action remove --slug <slug>
tools/wiki-ops.sh mark-compiled <proposal-file>
tools/wiki-ops.sh append-log --spec maintain --message <msg>
tools/wiki-ops.sh update-state
```

标记为 🧠 的步骤（领域分裂方案设计、重叠分析、归档候选评估）由 LLM 执行。标记为 🤝 的步骤由人工批准后方可执行。

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/maintain.md`

## 参数说明

- **操作类型**（可选，三选一）：
  - `split`：领域分裂——将体量过大的 domain 拆分为两个子领域，并迁移对应 canon 文件
  - `archive`：内容归档——将过时或低频访问的内容移入 `.wiki/archive/` 目录
  - `merge`：MOC 重组——合并重叠度过高的领域或重建 Map of Content 索引文件
- 不指定类型时，根据最近一次 `wiki-lint` 报告中的推荐操作自动判断
- 高风险操作（split / merge）执行前须向用户展示变更计划并获得确认

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
