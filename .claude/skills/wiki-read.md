---
name: wiki-read
description: 直接读取 canon 文件检索知识，不依赖 CLI，用 bash/view/grep 逐层导航摘要，触发词：查知识库、检索、wiki里、知识里说、根据wiki
---

# Wiki Read Skill — 直接文件检索

本 skill 让 Claude Code **直接读取** `.wiki/canon/` 目录树来检索知识，不调用 `wiki ask` CLI。  
适用场景：快速问答、交叉验证、离线检索、需要在当前对话内联查阅的场景。

---

## 检索入口

所有检索从以下文件开始，**不要盲猜路径**：

```
.wiki/canon/_index.md          ← 顶层：所有领域列表 + 每个领域的摘要
.wiki/canon/domains/{domain}/_index.md  ← 领域层：该领域下所有页面的一行摘要
.wiki/canon/domains/{domain}/{category}/{slug}.md  ← 页面层：完整知识内容
```

---

## 检索步骤

### Step 1：读顶层索引，定位领域

```bash
cat .wiki/canon/_index.md
```

顶层索引列出所有 **领域（domain）** 及其摘要（覆盖的核心话题）。  
根据用户问题的关键词，选出 1-2 个最相关的领域。

### Step 2：读领域索引，找候选页面

```bash
cat .wiki/canon/domains/{domain}/_index.md
```

领域索引列出该领域下所有页面的 **slug + 一行摘要**。  
根据摘要快速判断哪些页面与问题相关（通常 1-3 个）。  
不要在这一步就读完整页面。

### Step 3：关键词快速扫描（可选加速）

如果领域索引摘要不足以判断，用 grep 做关键词扫描：

```bash
grep -r "关键词" .wiki/canon/domains/{domain}/ --include="*.md" -l
```

或跨所有领域：

```bash
grep -r "关键词" .wiki/canon/ --include="*.md" -l
```

### Step 4：读候选页面，提取答案

```bash
cat .wiki/canon/domains/{domain}/{category}/{slug}.md
```

逐一读取 Step 2-3 筛出的候选页面。  
提取与问题直接相关的段落、结论、数据、决策建议。

### Step 5：综合回答

- 用页面内容直接回答用户问题
- 在关键结论后标注来源：`[来源: {domain}/{category}/{slug}]`
- 若 canon 中有 `confidence: low` 的内容，追加提示：`[⚠️ 低置信度，建议验证]`
- 若完全找不到相关内容，明确告知用户 canon 中无此知识，不要编造

---

## 快速检索模板（可直接复制执行）

```bash
# 1. 查所有领域
cat .wiki/canon/_index.md

# 2. 查某领域的全部页面摘要
cat .wiki/canon/domains/ai/_index.md

# 3. 关键词全局搜索
grep -r "向量数据库" .wiki/canon/ --include="*.md" -l

# 4. 读某个具体页面
cat .wiki/canon/domains/ai/databases/vector-db-comparison.md

# 5. 只看frontmatter摘要（快速扫描所有页面）
grep -r "^summary:" .wiki/canon/domains/ --include="*.md" -A 1
```

---

## 页面结构说明

每个 canon 页面的 frontmatter 包含：

| 字段 | 含义 |
|------|------|
| `title` | 页面标题 |
| `summary` | **一行摘要**，说明本页核心结论或用途（检索时优先读这个） |
| `domain` | 所属领域 |
| `tags` | 关键词标签 |
| `confidence` | `high / medium / low`，low 的内容需提示验证 |
| `primary_type` | 内容类型：`guide / comparison / decision / concept` |

---

## 与 `/wiki` 的关系

| 场景 | 用哪个 |
|------|--------|
| 快速查一条知识、inline 引用 | **本 skill（wiki-read）** |
| 摄入新资料、触发 proposal、写入知识库 | `/wiki`（走 CLI） |
| 审查 / apply / resolve 队列 | `wiki review / apply / resolve` |

---

## 注意事项

- **只读**：本 skill 不写入任何文件，只读 `.wiki/canon/`
- **不猜路径**：始终从 `_index.md` 开始导航，不直接拼路径
- **边界诚实**：找不到就明说，不用训练知识伪装成 canon 内容
- **跨领域**：问题跨多个领域时，分别读各领域的 `_index.md`，再汇总
