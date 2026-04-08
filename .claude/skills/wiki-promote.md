---
name: wiki-promote
description: 审查并决定 inbox 中的 change proposal，触发关键词：审查、promote、review proposal
---

# Wiki Promote Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/promote.md` 中的完整 Spec。

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/promote.md`

## 参数说明

- **proposal**（可选，两种模式）：
  - 指定文件路径：审查单个 inbox 中的 proposal 文件（如 `.wiki/proposals/inbox/2024-01-01-topic.md`）
  - 不指定：批量审查 `.wiki/proposals/inbox/` 目录下所有待处理提案
- 审查结果为三选一：**approve**（移入 approved/）、**reject**（移入 rejected/）、**defer**（留在 inbox/ 并附注原因）
- 审查依据为 canon 知识库中的既有内容与 Spec 中定义的质量标准

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
