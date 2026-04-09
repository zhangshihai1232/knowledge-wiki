---
name: wiki-bootstrap
description: 初始化一个新的 LLM Wiki 仓库脚手架，触发关键词：新建 wiki 仓库、bootstrap、搭建新仓
---

# Wiki Bootstrap Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/bootstrap.md` 中的完整 Spec。

## CLI 工具层

bootstrap 主要通过 `tools/bootstrap-wiki-repo.sh` 脚本执行。该脚本会自动将 `wiki-ops.sh` 复制到新仓库的 `tools/` 目录，确保新仓库具备完整的 CLI 工具层。

## 快速入口

**当前工作目录**：检查当前仓库是否包含 `tools/bootstrap-wiki-repo.sh`。  
**Skill 路径**：`.claude/skills/wiki-bootstrap.md`  
**Spec 路径**：`.wiki/policy/specs/bootstrap.md`

## 参数说明

- **target_dir**（必填）：新仓库的目标目录
- **--name**（可选）：新仓库的人类可读名称
- **--force**（可选）：允许在已有非空目录中继续初始化

## 执行

1. 先按 `.wiki/policy/specs/bootstrap.md` 读取目标路径与约束
2. 调用 `tools/bootstrap-wiki-repo.sh`
3. 返回新仓库位置、默认入口 `/wiki`，以及复制了什么 / 没复制什么
