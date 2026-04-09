---
type: spec
name: bootstrap
autonomy: semi-auto
triggers:
  - 用户要求初始化一个新的知识仓库
  - 用户要求复制这套治理能力到另一个目录
inputs:
  - 目标目录
  - 可选：仓库名称
  - 可选：--force
outputs:
  - 新仓库脚手架
  - 创建结果摘要
quality_gates:
  - 必须生成完整的 .wiki 运行时目录
  - 必须生成 .claude/skills/ 前台入口
  - 不得复制当前仓库的 canon / sources / proposals / experiment results
---

# Spec: Bootstrap（新仓库脚手架）

## Purpose

`bootstrap` 的职责不是使用当前知识仓，而是**创建一套新的同类仓库**。

它要把当前项目中可复用的治理能力抽出来，生成一个全新的空白仓：

- 保留前台 Skill
- 保留后台 Spec / Schema / Template
- 保留评测协议骨架
- 不复制当前仓中的知识内容与运行时数据

---

## When to Run

以下任一场景优先触发本 spec：

- 用户说“帮我新建一套这种 wiki 仓库”
- 用户说“把这套能力复制到另一个目录/项目”
- 用户说“我要搭一个新的知识治理仓”

---

## 步骤责任标记说明

每个步骤标题带有执行责任标记：

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（`wiki-ops` 工具） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

⚙️ 步骤中的文件操作**必须**通过 `wiki-ops` CLI 命令执行，不得由 LLM 直接操作文件系统。

## Steps

### Step 1 🤝：确认目标路径与命名

读取以下参数：

1. `target_dir`（必填）
2. `repo_name`（可选）
3. `--force`（可选）

若 `repo_name` 未提供，则默认使用 `target_dir` 的目录名。

---

### Step 2 ⚙️：执行脚手架命令

运行：

```bash
tools/bootstrap-wiki-repo.sh {target_dir} [--name {repo_name}] [--force]
```

执行后应得到：

- 新的 `.claude/skills/`
- 新的 `.wiki/` 目录骨架
- 新的 `evaluation/` 骨架
- 新的 `README.md`
- 新的 `tools/bootstrap-wiki-repo.sh`

脚手架命令会自动将 `wiki-ops.sh` 复制到新仓库的 `tools/` 目录，确保新仓库具备完整的 CLI 工具层。

---

### Step 3 ⚙️：校验复制边界

必须确认以下边界：

1. 未复制当前仓的 `canon/**` 内容
2. 未复制当前仓的 `sources/**` 内容
3. 未复制当前仓的 `changes/**` 提案内容
4. 未复制当前仓的 `evaluation/results/**` 实验结果

允许复制的是：

1. `skill` 入口
2. `spec / schema / template`
3. 评测协议与 rubric 模板
4. 空白运行时目录与 starter 文档

---

### Step 4 🤝：返回初始化结果

向用户返回：

1. 新仓库位置
2. 默认入口 `/wiki`
3. 新仓库里已具备的前台 Skill 与后台 Spec
4. 说明这是空白治理内核，而不是当前仓知识副本

---

## Non-Goals

本 spec 不负责：

1. 复制当前仓的业务知识
2. 自动导入真实资料
3. 自动生成领域内容
4. 配置外部 CI / 托管平台
