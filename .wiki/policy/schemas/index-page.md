---
type: schema
name: index-page
version: 1.0
---

# Schema: Index Page（_index.md）

`_index.md` 是每个领域目录的导航入口（Map of Content），存放于 `canon/domains/{domain}/` 下。顶层索引存放于 `canon/_index.md`。

---

## 顶层索引（canon/_index.md）

### Frontmatter

```yaml
---
type: index
title: "Canon 知识库 — 顶层索引"
updated_at: "2026-04-08"            # 每次有新领域加入时更新
---
```

### 正文结构

```markdown
# Canon 知识库

## 领域列表

- [ai](domains/ai/_index.md) — AI 与机器学习领域
- [python](domains/python/_index.md) — Python 语言与生态

## 使用说明

- 每个领域有独立的 `domains/{domain}/_index.md`
- 通过 `/wiki` 使用知识前台入口
- 通过 `wiki check / review / apply / resolve` 处理确定性队列
```

### 更新规则

- compile 执行 `action=create` 且为**新领域首个页面**时，在 `## 领域列表` 追加条目
- maintain 执行领域合并/分裂时，同步更新条目
- 条目格式：`- [{domain}](domains/{domain}/_index.md) — {一句话领域描述}`

---

## 领域索引（canon/domains/{domain}/_index.md）

### Frontmatter

```yaml
---
type: index
domain: "ai"                        # 必填，所属领域名
title: "ai 领域索引"                 # 必填
updated_at: "2026-04-08"            # 每次 compile 更新此领域时更新
pages:                              # 必填，本领域所有 canon 页面的 slug 列表
  - ai/architectures/transformer
  - ai/concepts/attention-mechanism
---
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| type | 是 | 固定为 `index` |
| domain | 是 | 领域名，与目录名一致 |
| title | 是 | 领域索引标题 |
| updated_at | 是 | 最后更新日期，每次 compile 修改此领域时更新 |
| pages | 是 | 本领域所有 canon 页面的路径列表（相对 `canon/domains/`，格式 `{domain}/{category}/{slug}`），**不含 _index.md 自身** |

### 正文结构

```markdown
# {domain} 领域

## {category-1}

- [[{slug}]] — {页面 title}
- [[{slug}]] — {页面 title}

## {category-2}

- [[{slug}]] — {页面 title}
```

### 分类区块规则

- 每个分类对应一个 `## {category}` 二级标题
- 条目格式：`- [[{slug}]] — {页面 title}`
- slug 与 `pages` frontmatter 列表中的路径末段一致
- 条目按字母顺序排列

### 更新规则

| 操作 | 触发方 | 更新内容 |
|------|--------|----------|
| create | compile Step 5 | `pages` 列表追加新 slug；正文对应分类区块追加条目；若分类不存在则新建 `## {category}` 区块 |
| archive | compile Step 5 | `pages` 列表移除该 slug；正文移除对应条目 |
| update | compile Step 5 | 若页面 title 变化则同步更新；否则不改动 |
| L001 自动修复 | lint Step 5 | 将孤儿页面追加到 `pages` 列表和正文末尾的 `## 其他` 区块 |
| L009 自动创建 | lint Step 5 | 领域目录缺少 `_index.md` 时，自动创建最小化版本（扫描目录下现有页面填充 `pages`） |

### 首次创建（由 compile 自动执行）

当 compile 执行 `action=create` 且目标领域的 `_index.md` 不存在时，自动创建：

```markdown
---
type: index
domain: {domain}
title: "{domain} 领域索引"
updated_at: {今日日期}
pages:
  - {target_page}
---

# {domain} 领域

## {category}

- [[{slug}]] — {title}
```

---

## 文件命名

固定为 `_index.md`，不可更改。

## lint 检查关联

| 规则 | 检查内容 |
|------|----------|
| L001 orphan-page | canon 页的路径是否在对应领域 `_index.md` 的 `pages` 列表中 |
| L009 missing-index | 领域目录下是否存在 `_index.md` |
