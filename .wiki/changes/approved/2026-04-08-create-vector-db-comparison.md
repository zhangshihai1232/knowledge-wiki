---
type: change-proposal
action: create
status: approved
target_page: "ai/databases/vector-db-comparison"
target_type: comparison
trigger_source: "sources/articles/2026-04-08-vector-db-comparison-pinecone-weaviate-milvus.md"
confidence: medium
proposed_at: "2026-04-08"
reviewed_by: "test-evaluator"
reviewed_at: "2026-04-08T10:00:00+08:00"
rejection_reason: ~
approve_note: "技术数据有来源，声明准确"
compiled: true
compiled_at: "2026-04-08"
auto_quality_score: 0.82
conflict_location: ~
---

## 提案摘要

新建向量数据库选型对比 canon 页，收录 Pinecone、Weaviate、Milvus 三款主流向量数据库的性能指标、成本分析、部署复杂度和选型建议。

## 变更内容

### 新增内容

**对比维度**

本页面从性能（延迟、吞吐量、Recall）、成本（托管定价、自托管可行性）、部署复杂度（运维负担、冷启动时间）、功能特性（混合搜索、多租户、GPU加速）四个维度对 Pinecone、Weaviate、Milvus 进行对比。

**详细对比**

| 维度 | Pinecone | Weaviate | Milvus |
|------|----------|----------|--------|
| p99 延迟（100万向量） | 20-30ms（托管） | 15-25ms（自托管） | 5-15ms（分布式） |
| 吞吐量（参考） | 100-1000+ QPS | 500-800 QPS（8核32GB） | 2000+ QPS（单节点） |
| Recall@10 | ~95%（默认），99%+（精确模式） | ~96%（HNSW默认参数） | 取决于索引类型 |
| 自托管 | 不支持 | 支持 | 支持 |
| 混合搜索 | 需额外组件 | 原生 BM25+向量 | 需额外配置 |
| 最大规模 | 20,000维，扩展需升级 Pod | 支持10,000+多租户 | 10亿+向量 |
| 开源许可 | 专有（全托管） | Apache 2.0 | Apache 2.0（MIT） |
| 运维复杂度 | 极低 | 中等 | 高（依赖etcd+pulsar/kafka） |

**成本对比**

- Pinecone：无自托管，Serverless $0.096/百万读取单元；Pod-based 从 $70/月（s1.x1）起
- Weaviate：开源自托管免费；WCD 从 $25/月起
- Milvus：开源完全免费（MIT许可证）；Zilliz Cloud 从约 $100-300/月起

**选择建议**

- 快速验证 / SaaS 场景 → Pinecone（零运维，快速上手，但无法自托管）
- 中等规模 + 需要混合搜索 → Weaviate（功能全面，原生混合搜索，社区活跃）
- 大规模生产 / 成本敏感 / 需要自定义索引 → Milvus（性能天花板最高，扩展性最佳，但运维复杂度高）

### 修改内容

无（新建页面）

### 删除内容

无

## Source 证据

- Pinecone p99 查询延迟约 20-30ms（100万向量，托管版 AWS us-east-1），Recall@10 默认约 95%，精确模式可达 99%+。（来源：§性能指标/Pinecone）
- Weaviate 原生支持 BM25 + 向量混合检索（无需额外组件），v1.20 后支持原生多租户，单实例可管理 10,000+ 租户。（来源：§性能指标/Weaviate）
- Milvus 支持 12 种以上索引类型，单集群支持 10 亿+ 向量，NVIDIA GPU 加速相比 CPU 提速 10-50x。（来源：§性能指标/Milvus）
- Pinecone 无自托管选项，Milvus 和 Weaviate 均支持开源自托管，分别采用 MIT 和 Apache 2.0 许可证。（来源：§成本分析）
- Milvus 部署依赖 etcd 和 pulsar/kafka，冷启动需 5-15 分钟，运维复杂度最高。（来源：§部署复杂度）

## AI 建议

建议将此页面放置于 `ai/databases/` 分类下，类型为 `comparison`，与其他 AI 基础设施对比页面并列。

数据来源为 secondary 级别（博客综述），建议后续补充官方 benchmark 报告作为 authoritative 来源，以将 confidence 提升至 medium 或更高。注意性能数据注有时效性说明，应在 canon 页面中保留此说明。
