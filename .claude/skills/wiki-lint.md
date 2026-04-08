---
name: wiki-lint
description: 检查 wiki 健康状态，生成结构化报告，触发关键词：检查、lint、健康报告
---

# Wiki Lint Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/lint.md` 中的完整 Spec。

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/lint.md`

## 参数说明

- **--domain**（可选）：限定检查范围至指定知识领域；未指定则全域检查
- **--fix**（可选）：自动修复 Spec 中标记为 `Auto` 级别的问题（如格式错误、缺失字段等）；需用户审阅后手动执行 `Manual` 级别修复
- 报告格式由 Spec 定义，通常包含：问题列表（按严重程度分级）、健康度评分、推荐下一步操作（如触发 `wiki-maintain`）

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
