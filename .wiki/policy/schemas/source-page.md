---
type: schema
name: source-page
version: 1.0
---

# Schema: Source Page

source 文件存放于 `.wiki/sources/` 下的标准子目录中（`articles/`、`conversations/`、`notes/`、`references/`），保存原始资料和摄入元数据。

## Frontmatter 字段

```yaml
---
type: source                        # 固定值
source_kind: article                # 枚举: article | conversation | note | reference
title: "资料标题"                    # 必填
url: "https://..."                  # 可选，原始URL
author: "作者"                      # 可选
published_at: "2026-01-01"          # 可选，原始发布时间
ingested_at: "2026-04-08"           # 必填，摄入时间（ISO 8601 日期）
domain: "ai"                        # 可选，预判归属领域
tags: [tag1, tag2]                  # 可选，关键词标签
extracted: false                    # 必填，是否已提取声明并生成 proposal
checksum: "sha256:abc123"           # 可选，内容哈希，用于去重检测
authority: secondary                # 可选，来源权威性：authoritative | secondary | unverified
---
```

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| type | 是 | 固定为 `source` |
| source_kind | 是 | 资料类型：article（文章）/ conversation（对话）/ note（笔记）/ reference（参考资料） |
| title | 是 | 资料标题，用于 proposal 引用 |
| url | 否 | 原始来源 URL |
| author | 否 | 作者信息 |
| published_at | 否 | 原始发布日期 |
| ingested_at | 是 | 摄入系统的日期 |
| domain | 否 | 预判所属知识领域 |
| tags | 否 | 关键词列表，辅助检索 |
| extracted | 是 | `false` = 尚未提取声明；`true` = 已生成 proposal |
| checksum | 否 | 内容 SHA-256 哈希，用于检测重复摄入 |
| authority | 否 | 来源权威性：`authoritative`（权威来源，如官方文档、同行评审论文）/ `secondary`（二手资料，如博客、综述）/ `unverified`（来源不明或未经验证）。缺失时视为 `secondary`。compile spec 使用此字段确定 confidence 初始值 |

> 目录映射：`article → articles/`，`conversation → conversations/`，`note → notes/`，`reference → references/`。

## 文件命名规范

```
{ingested_at}-{slug}.md
```

示例：`2026-04-08-attention-is-all-you-need.md`

## 正文结构

```markdown
{frontmatter}

## 原始内容

{保留原始内容，不改写，不摘要}

## 提取声明

（由 ingest spec 填写，extracted: true 后追加）

- 声明1 [段落引用]
- 声明2 [段落引用]
```
