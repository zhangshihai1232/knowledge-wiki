---
name: wiki-compile
description: 将 approved proposal 编译到 canon 知识库，触发关键词：编译、compile
---

# Wiki Compile Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/compile.md` 中的完整 Spec。

## CLI 工具层

Spec 中标记为 ⚙️ 的步骤（更新 frontmatter、创建 canon 页、更新索引、标记已编译、追加日志、衰减计算）**必须**通过 `wiki-ops` CLI 工具执行：

```bash
tools/wiki-ops.sh create-canon --target-page <page> --type <type> --title <title> --sources <sources>
tools/wiki-ops.sh frontmatter set <file> <key> <value>
tools/wiki-ops.sh update-index --domain <domain> --action add --slug <slug> --title <title>
tools/wiki-ops.sh mark-compiled <proposal-file>
tools/wiki-ops.sh decay
tools/wiki-ops.sh scan --format json
tools/wiki-ops.sh append-log --spec compile --message <msg>
tools/wiki-ops.sh update-state
```

标记为 🧠 的步骤（内容合并、冲突检测、cross_refs 语义扫描）由 LLM 执行。

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/compile.md`

## 参数说明

- **proposal**（可选，两种模式）：
  - 指定文件路径：编译单个 approved proposal 文件（如 `.wiki/proposals/approved/2024-01-01-topic.md`）
  - 不指定：批量编译 `.wiki/proposals/approved/` 目录下的所有待编译文件
- 编译操作会将 proposal 内容合并写入对应 domain 的 canon 文件，并将已处理的 proposal 移入归档目录

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
