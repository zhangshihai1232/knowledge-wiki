---
name: wiki-query
description: 基于 canon 知识库回答问题，每个声明标注来源，触发关键词：查询、query、问知识库
---

# Wiki Query Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/query.md` 中的完整 Spec。

## CLI 工具层

query 以语义操作为主（🧠），仅在 write-back 和日志环节使用 CLI：

```bash
tools/wiki-ops.sh dedup-check --target-page <page>
tools/wiki-ops.sh create-proposal --action create --target-page <page> --trigger-source "system:query-writeback" --confidence low --body-file <path>
tools/wiki-ops.sh append-log --spec query --message <msg>
tools/wiki-ops.sh update-state
```

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/query.md`

## 参数说明

- **question**（必填）：自然语言问题，直接描述想了解的内容
- **--domain**（可选）：限定查询范围至指定知识领域（如 `--domain engineering`），未指定则全域搜索
- 回答中每条声明须附带来源标注（格式由 Spec 定义，如 `[来源: canon/engineering/xxx.md#章节]`）
- 若 canon 中无相关内容，明确告知"知识库暂无此信息"，不得编造

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
