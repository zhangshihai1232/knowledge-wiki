---
type: change-proposal
action: create
status: inbox
target_page: ai/databases/vector-index-algorithms
target_type: concept
domain: ai
primary_type: concept
subtype: technique
tags:
  - "向量数据库"
  - vector-database
  - hnsw
  - ivf
  - pq
  - "索引算法"
suggested_tags:
suggested_aliases:
suggested_related_terms:
trigger_source: sources/articles/2026-04-15--5.md
origin: ingest
confidence: medium
proposed_at: 2026-04-15
auto_quality_score: 0.5
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
---

## 提案摘要

新建向量数据库索引算法 canon 页，介绍 HNSW、IVF、PQ 等主流算法的原理与适用场景。

## 变更内容

### 新增内容

**HNSW（Hierarchical Navigable Small World）**

HNSW 是一种基于图的近似最近邻搜索算法，通过构建多层可导航小世界图实现高效检索。在搜索时从上层逐层向下收敛到最近邻，复杂度约为 O(log n)。优点：查询速度快、召回率高；缺点：内存占用较高、索引构建时间较长。

**IVF（Inverted File Index）**

IVF 是一种基于倒排索引的聚类方法，先将向量空间划分为多个聚类（Voronoi cells），搜索时只检索查询向量所属的少数聚类中的向量。可与 PQ 结合进一步压缩。优点：可解释性强、可调精度/速度权衡；缺点：召回率依赖聚类数量和距离计算方式。

**PQ（Product Quantization）**

PQ 是一种向量量化压缩方法，将高维向量分割为多个子空间，对每个子空间进行 k-means 聚类并用聚类中心 ID 表示原始向量。可将向量压缩至原来大小的 1/100 以下，大幅降低存储和计算成本。优点：存储效率高、支持内积/欧氏距离；缺点：有精度损失、查询速度受量化方式影响。

### 修改内容

无（新建页面）

### 删除内容

无