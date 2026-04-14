---
name: wiki-read
description: 当用户需要从知识库中查阅、检索或引用已有知识内容时，直接读取 .wiki/canon/ 目录文件，通过 bash/grep/view 逐层导航摘要索引，无需调用 wiki ask CLI
---

# Wiki Read — 直接文件检索

直接读取 `.wiki/canon/` 目录树检索知识，不调用 `wiki ask` CLI。

---

## 检索层级

```
.wiki/canon/_index.md                              ← 顶层：领域列表 + 话题摘要
.wiki/canon/domains/{domain}/_index.md             ← 领域层：页面摘要表格
.wiki/canon/domains/{domain}/{category}/{slug}.md  ← 页面层：完整知识内容
```

---

## 执行步骤

### Step 1：读顶层索引，定位领域

```bash
cat .wiki/canon/_index.md
```

根据领域表格中的"核心覆盖话题"，选出最相关的 1-2 个领域。

### Step 2：读领域索引，找候选页面

```bash
cat .wiki/canon/domains/{domain}/_index.md
```

领域索引有页面摘要表格（slug + 一行摘要 + 类型 + 置信度）。  
根据摘要判断候选页面，**不在这步读完整页面**。

### Step 3：关键词扫描（可选加速）

```bash
# 扫描所有页面的 summary 字段
grep -r "^summary:" .wiki/canon/domains/ --include="*.md" -A 1

# 按关键词搜索相关文件
grep -r "关键词" .wiki/canon/ --include="*.md" -l
```

### Step 4：读候选页面，提取答案

```bash
cat .wiki/canon/domains/{domain}/{category}/{slug}.md
```

提取与问题直接相关的段落、结论、数据、决策建议。

### Step 5：综合回答

- 在关键结论后标注来源：`[来源: {domain}/{category}/{slug}]`
- `confidence: low` 的内容追加：`[⚠️ 低置信度，建议验证]`
- 找不到时明确告知，不编造内容

### Step 5.5：主域未命中时，检查 secondary_domains（跨域兜底）

若 Step 1-4 未找到满意答案，执行跨域检索：

```bash
# 找出所有声明了 secondary_domains 的页面（排除空值）
grep -r "^secondary_domains:" .wiki/canon/domains/ --include="*.md" -l
```

对命中文件，读取其 `secondary_domains` frontmatter 字段；若包含当前查询相关的领域，将该页面纳入候选集，按 Step 4 正常展开。

> `secondary_domains` 表示该页面的核心问题跨越多个领域。后端 SQLite 索引已对此字段建立评分（+22 分），主域查询未命中时这是最重要的兜底路径。

---

## 约束

- **只读**：不写入任何文件，只读 `.wiki/canon/`
- **不猜路径**：始终从 `_index.md` 开始导航
- **边界诚实**：canon 里没有就明说，不用训练知识伪装
- **与 `/wiki` 的分工**：本 skill 只读；写入/摄入/审查走 `/wiki` + `wiki` CLI
