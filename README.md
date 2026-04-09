# LLM Wiki 使用说明

## 系统概述

LLM Wiki 是一个**知识编译器**，不是笔记工具。它的核心定位是：把散乱的原始资料（文章、对话、笔记）通过受控流程编译成可信赖的权威知识库。普通笔记系统只是存储，LLM Wiki 强制要求每条知识都有来源追溯，每个变更都经过人工审查，才能进入 canon。

核心理念是一条单向管道：**资料 → 摄入（ingest）→ 审查（promote）→ 编译（compile）→ 权威知识库（canon）**。AI 负责提取和起草，人工负责审查和放行。任何绕过审查直接写入 canon 的操作都违背系统设计。

---

## 推荐入口（默认）

**现在推荐的默认使用方式，不是先选 6 个 Skill，而是先用一个入口：**

```text
/wiki {你的问题 / 资料 / 整理请求}
```

仓库中对应的真实前台 Skill 文件已经提供：

- `.claude/skills/wiki.md`
- `.wiki/policy/specs/wiki.md`

`/wiki` 会在内部自动判断你是在：

- 提问（走 query）
- 贴资料（走 ingest）
- 请求整理（走 reconcile / refresh / maintain）
- 要看细节（附加 audit 展示，而不是切走另一个入口）

### 推荐用法示例

```text
/wiki 什么时候应该把页面归档？
/wiki 请把这段会议纪要吸收进知识库
/wiki 帮我整理这批知识并补缺口
/wiki 这个结论的依据是什么？请展开细节
```

你默认不需要先理解：

- ingest / promote / compile 的边界
- schema 字段
- benchmark / protocol / rubric

如果你只是想“用起来”，优先从 `/wiki` 开始。  
下面那套多 Skill 方式保留给高级用户和手动控制场景。

---

## 搭建任意新的同类仓库

现在这个仓库不只是一个可用样例，也是一套**建仓工具包**。  
如果你要创建另一套全新的同类仓库，而不是继续使用当前这套内容，可以直接用下面两种方式。

### 方式 1：脚本直接建仓

```bash
tools/bootstrap-wiki-repo.sh ../my-new-wiki --name "My New Wiki"
```

### 方式 1.5：全局安装后直接执行

```bash
tools/install-global.sh
wiki setup work /data/wiki/work
wiki new my-new-wiki --name "My New Wiki"
```

默认会安装到：

- 主命令：`~/.local/bin/wiki`
- 兼容别名：`~/.local/bin/wiki-bootstrap`
- 资产目录：`~/.local/share/knowledge-wiki-toolkit`

如果你想换前缀，也可以：

```bash
tools/install-global.sh --prefix /usr/local --main-name wiki --bin-name wiki-bootstrap
```

### Namespace 路径映射（推荐）

如果你希望按固定 namespace 直接落到指定路径，可以这样配置。

默认配置文件：

```text
~/.config/knowledge-wiki-toolkit/namespaces.conf
```

配置 namespace：

```bash
wiki setup work /data/wiki/work
wiki bootstrap --set-namespace personal /data/wiki/personal
```

### 最短 onboarding（最推荐）

如果你要让使用者和 agent 的认知最小化，最推荐直接用一条 setup：

```bash
wiki setup work /data/wiki/work
```

之后最短路径就是：

```bash
wiki new new-repo --name "Work Wiki"
```

如果你还没切到当前 repo，可以直接定位：

```bash
cd "$(wiki where)"
```

查看 namespace：

```bash
wiki status
```

然后直接用 namespace 建仓：

```bash
wiki new new-repo --namespace work --name "Work Wiki"
```

如果你想看当前实际使用的配置文件路径：

```bash
wiki bootstrap --show-config
```

如果你想把整个最短工作流直接打印出来：

```bash
wiki guide
```

如果你想让 agent 一条命令看清当前上下文：

```bash
wiki status
```

### 方式 2：让 AI 直接建仓

```text
/wiki-bootstrap ../my-new-wiki --name "My New Wiki"
```

### 建完仓后，真正的主流程是什么

建仓只是初始化。  
真正的知识编译 / 蒸馏主流程是在**新仓内部**通过 `/wiki` 完成：

```text
/wiki 请吸收这段资料
/wiki 帮我整理这批知识并补缺口
/wiki 这个结论的依据是什么？请展开细节
```

也就是说，最小心智模型其实分两段：

1. **repo 生命周期层**：`wiki`
2. **知识层**：`/wiki`

其中 `/wiki` 才是仓内真正的前台主入口，它会把 ingest / distill / reconcile / refresh / maintain / query 收敛起来。

`wiki-bootstrap` 现在只保留为兼容别名；对普通使用者，主入口应视为 `wiki`。

### 建仓时会复制什么

- `.claude/skills/*.md`
- `.wiki/policy/specs/*.md`
- `.wiki/policy/schemas/*.md`
- `.wiki/policy/templates/*.md`
- `tools/bootstrap-wiki-repo.sh`
- `tools/install-global.sh`
- `evaluation/` 下的协议与 rubric 模板骨架
- 空白的 `.wiki/` 运行时目录、`README.md`、`STATE.md`、`LOG.md`

### 建仓时不会复制什么

- 当前仓库的 `canon` 知识内容
- 当前仓库的 `sources` 原始资料
- 当前仓库的 `changes` 提案内容
- 当前仓库的 `evaluation/results` 实验结果

也就是说，**它搭出来的是一套新的空白治理内核，而不是当前仓库内容的克隆。**

---

## 快速上手

### Step 1：确认 `.wiki/` 目录已初始化

运行时目录 `.wiki/` 包含四个区，确认均存在：

```
.wiki/
  sources/    # 原始资料区（只读，不改写）
  canon/      # 权威知识区（只能由 compile 写入）
  changes/    # 变更提案区（inbox / review / approved / rejected）
  policy/     # 系统状态和 schema 定义
```

如果目录已存在（如本项目），直接进入 Step 2。

### Step 2：直接用 `/wiki`

```text
/wiki {问题 / 资料 / 整理请求}
```

系统会自动路由，并默认用最小认知负担的方式返回：

1. **结果**
2. **边界**
3. **系统动作**
4. **需要你决定**（如果有）

如果你明确说“看依据 / 展开细节 / 看 proposal / 看内部路由”，  
系统会在主结果后附加 **audit 模式**，不需要你切换到别的 Skill。

如果本次处理自动触发了补缺、proposal、后台维护或风险提醒，  
系统会额外附加一个**很短的后台摘要**，你不需要手动调用 `/wiki-maintain` 才知道系统做了什么。

### Step 3：只有在你想手动控制时，才进入高级模式

如果你确实想显式控制某一步，或者在调试 / 维护系统，再使用下面的多 Skill 入口。

### Step 4：摄入第一份资料（高级/手动模式）

```
/wiki-ingest
```

将资料粘贴或提供给 AI。Skill 会：
1. 在 `sources/{kind}/` 下创建 source 文件（保留原文）
2. 提取声明，在 `changes/inbox/` 下生成 change proposal
3. 更新 `policy/STATE.md`

### Step 5：审查生成的 proposal（高级/手动模式）

```
/wiki-promote
```

AI 会列出 `changes/inbox/` 和 `changes/review/` 中的待审 proposal，你逐一决定：
- **approve**：移入 `changes/approved/`，等待编译
- **reject**：移入 `changes/rejected/`，填写拒绝原因
- **skip**：本次跳过，保留在 inbox/review

### Step 6：编译 approved proposal 到 canon（高级/手动模式）

```
/wiki-compile
```

AI 处理所有 `changes/approved/` 中 `compiled: false` 的 proposal：
- `create`：在 `canon/domains/{domain}/` 下新建页面
- `update`：更新已有页面内容和 sources 列表
- 完成后标记 proposal `compiled: true`，更新 STATE.md

### Step 7：查询知识库（高级/手动模式）

```
/wiki-query
```

用自然语言提问，AI 在 canon 中检索相关页面并给出有来源标注的回答。

---

## 高级 / 手动模式下的 6 个 Skill

| Skill | 用途 | 触发方式 | Spec 文件 |
|-------|------|----------|-----------|
| `/wiki-ingest` | 摄入新资料，生成 source 文件和 change proposal | 有新文章、对话记录、笔记需要入库时 | `.wiki/policy/specs/ingest.md` |
| `/wiki-promote` | 审查 inbox 中的 proposal，决定 approve 或 reject | 摄入后，编译前 | `.wiki/policy/specs/promote.md` |
| `/wiki-compile` | 将 approved proposal 编译写入 canon | 审查完成，有待编译的 approved proposal 时 | `.wiki/policy/specs/compile.md` |
| `/wiki-query` | 查询 canon 知识库，回答问题 | 需要检索已有知识时 | `.wiki/policy/specs/query.md` |
| `/wiki-lint` | 检查系统健康状态，发现孤立文件、断链等问题 | 定期维护或怀疑系统状态异常时 | `.wiki/policy/specs/lint.md` |
| `/wiki-maintain` | 批量维护：更新 staleness、归档过期页面 | 定期维护，通常配合 lint 使用 | `.wiki/policy/specs/maintain.md` |

---

## 工具层的建仓 Skill

| Skill | 用途 | 触发方式 | Spec 文件 |
|-------|------|----------|-----------|
| `/wiki-bootstrap` | 创建一套新的空白 LLM Wiki 仓库 | 需要搭建新的同类仓库，而不是继续使用当前仓库时 | `.wiki/policy/specs/bootstrap.md` |

---

## 典型工作流

### 日常摄入流程

每次有新资料时：

```
新资料
  |
  v
/wiki-ingest  ──→  sources/{kind}/ 新文件
                   changes/inbox/  新 proposal
  |
  v
/wiki-promote ──→  approved proposal 移入 changes/approved/
  |
  v
/wiki-compile ──→  canon/domains/{domain}/ 更新
  |
  v
/wiki-query   ──→  查询并验证结果
```

### 默认维护方式（推荐）

普通使用下，优先继续使用 `/wiki`。  
系统应在后台完成轻量巡检、缺口登记和必要的维护动作，只在真的有结果或风险时回传简短摘要。

### 高级 / 手动维护流程

只有维护者需要显式巡检、排障或批量治理时，再手动执行：

```
/wiki-lint    ──→  检查孤立文件、断链、staleness 超限页面
  |
  v
/wiki-maintain──→  更新 staleness_days、归档过期页面、修复断链
  |
  v
/wiki-lint    ──→  再次检查，确认健康分达标
```

---

## 目录结构说明

```
.wiki/
|-- sources/                        # 原始资料区，只读，不改写
|   |-- articles/                   # 摄入的文章（含提取声明）
|   |-- conversations/              # 对话记录
|   |-- notes/                      # 个人笔记
|   `-- references/                 # 参考资料（规范、论文等）
|
|-- canon/                          # 权威知识区，只能由 compile 写入
|   |-- _index.md                   # 顶层索引，列出所有活跃领域
|   `-- domains/                    # 按领域组织的知识页面
|       `-- {domain}/
|           |-- _index.md           # 领域索引页
|           `-- {slug}.md           # 单个知识页面（含来源追溯）
|
|-- changes/                        # 变更提案区，记录所有变更请求
|   |-- inbox/                      # 新生成的 proposal，待初步审查
|   |-- review/                     # 移入深度审查的 proposal
|   |-- approved/                   # 已批准，等待 compile 处理
|   `-- rejected/                   # 已拒绝，保留记录
|
`-- policy/                         # 系统配置和状态
    |-- STATE.md                    # 系统全局状态（统计数字、健康指标）
    |-- LOG.md                      # 操作日志（每次 ingest/compile 追加）
    `-- schemas/                    # 各类文件的 schema 定义
        |-- source-page.md          # source 文件的 frontmatter 和正文规范
        |-- canon-page.md           # canon 页面的 frontmatter 和正文规范
        |-- change-proposal.md      # proposal 文件的结构和状态流转规范
        `-- state-log.md            # STATE.md 和 LOG.md 的格式规范
```

---

## 核心概念

**Source**：原始资料文件，存放于 `sources/` 下。摄入后保留原文，不改写。每个 source 文件记录资料来源、摄入时间，以及提取出的声明列表。Source 是 canon 知识的原始依据。

**Canon**：权威知识页面，存放于 `canon/domains/` 下。每个页面都通过 `sources` 字段追溯到支撑它的所有 source 文件。Canon 只能由 compile 操作写入，不能手动编辑内容。

**Proposal**：变更请求文件，存放于 `changes/` 的各状态子目录下。每个 proposal 描述对某个 canon 页面的具体变更（新建、更新、合并等），必须经人工审查（approve）后才能被 compile 执行。这是系统防止未经验证内容污染知识库的核心机制。

**Spec**：LLM 执行规范，即每个 Skill 背后的提示词文件（`.wiki/policy/specs/*.md`）。Spec 是完整可执行的 AI 操作说明，包含前置检查、执行步骤、输出格式和错误处理，保证每次调用行为一致。
