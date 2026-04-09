---
type: benchmark
name: query-benchmark
version: 1.0
created_at: 2026-04-09
case_count: 45
---

# Query Benchmark

用于评估 query spec 的来源标注、边界诚实性、write-back 触发与利用追踪能力。

## A. 已覆盖（15）

| ID | Query | 预期覆盖 | 预期回答要求 | write-back | 主要指标 |
|---|---|---|---|---|---|
| QB-C-01 | 什么是向量数据库选型时最关键的三项权衡？ | 已覆盖 | 全部事实需 `[来源: slug]` | no | unsupported_claim_rate |
| QB-C-02 | feature flag 灰度发布的一般步骤是什么？ | 已覆盖 | checklist + 来源标注 | no | source coverage |
| QB-C-03 | SEV1 和 SEV2 的区别是什么？ | 已覆盖 | 定义清晰，零外推 | no | unsupported_claim_rate |
| QB-C-04 | 为什么 offset pagination 不适合高写入场景？ | 已覆盖 | 因果说明有来源 | no | source coverage |
| QB-C-05 | topK=20 和 topK=50 的取舍是什么？ | 已覆盖 | 对比结构 + 来源 | no | answer faithfulness |
| QB-C-06 | memory 写入长期存储应该满足什么条件？ | 已覆盖 | 条件枚举，不扩写 | no | source coverage |
| QB-C-07 | JSON mode 的可靠性有哪些争议？ | 已覆盖 | 若 canon 有冲突须诚实呈现 | no | conflict surfacing |
| QB-C-08 | 为什么 sample ratio mismatch 要立即暂停实验？ | 已覆盖 | 带阈值的规范性回答 | no | source coverage |
| QB-C-09 | reranker threshold 0.72 为什么被选择？ | 已覆盖 | 若无完整因果，只答资料中已有内容 | no | unsupported_claim_rate |
| QB-C-10 | 什么时候应该把页面归档？ | 已覆盖 | 不虚构额外阈值 | no | source coverage |
| QB-C-11 | judge consistency rubric 的核心规则有哪些？ | 已覆盖 | 条目化回答 | no | source coverage |
| QB-C-12 | 为什么生产环境允许 prompt cache，而开发环境不建议？ | 已覆盖 | 只使用已有理由 | no | unsupported_claim_rate |
| QB-C-13 | 大 embedding 模型和小 embedding 模型的差异是什么？ | 已覆盖 | trade-off 对比 | no | answer faithfulness |
| QB-C-14 | HyDE 什么时候值得用？ | 已覆盖 | 必须体现已有争议 | no | conflict surfacing |
| QB-C-15 | 文档优先和日志优先各适合什么场景？ | 已覆盖 | 双边观点并列 | no | conflict surfacing |

## B. 部分覆盖（15）

| ID | Query | 预期覆盖 | 预期回答要求 | write-back | 主要指标 |
|---|---|---|---|---|---|
| QB-P-01 | 向量数据库选型时如何考虑租户隔离？ | 部分覆盖 | 允许少量 `[⚠️ canon 外推断]` | maybe | canon inference ratio |
| QB-P-02 | feature flag rollout 如何结合投诉量和收入波动？ | 部分覆盖 | 已有部分来源 + 缺口说明 | maybe | write-back trigger |
| QB-P-03 | judge consistency rubric 如何设置抽检比例？ | 部分覆盖 | 不得编造具体百分比 | yes | unsupported_claim_rate |
| QB-P-04 | prompt cache 如何做失效策略？ | 部分覆盖 | 可回答原则，不答不存在细节 | yes | boundary honesty |
| QB-P-05 | offset/cursor/time-window 三种分页该怎么选？ | 部分覆盖 | 若缺少选择框架，应显式标缺 | maybe | inference ratio |
| QB-P-06 | SEV2 是否一定要当天复盘？ | 部分覆盖 | 不得把组织习惯当规范 | yes | boundary honesty |
| QB-P-07 | topK 选择是否跟文档长度相关？ | 部分覆盖 | 允许合理推断，但要标注 | maybe | inference ratio |
| QB-P-08 | embedding 模型选择如何结合多语言支持？ | 部分覆盖 | 不得补充未验证榜单 | yes | unsupported_claim_rate |
| QB-P-09 | archive threshold 应按业务类型区分吗？ | 部分覆盖 | 应说明 canon 是否缺规则 | yes | write-back trigger |
| QB-P-10 | HyDE 是否适合客服 FAQ？ | 部分覆盖 | 若证据不够，需显式不确定 | yes | boundary honesty |
| QB-P-11 | memory 写入要不要考虑隐私等级？ | 部分覆盖 | 可答原则，缺口需说明 | maybe | write-back trigger |
| QB-P-12 | JSON mode 在复杂 schema 下如何降级？ | 部分覆盖 | 只答已有争议，不给具体 workaround | yes | unsupported_claim_rate |
| QB-P-13 | reranker threshold 是否应按语料类型区分？ | 部分覆盖 | 缺依据时触发缺口登记 | yes | write-back trigger |
| QB-P-14 | 文档优先和日志优先如何做冲突裁决？ | 部分覆盖 | 若无已定义机制，不得假装已有 | yes | boundary honesty |
| QB-P-15 | feature flag 发布是否需要回滚时间窗标准？ | 部分覆盖 | 缺具体标准时触发 write-back | yes | write-back trigger |

## C. 完全缺口（15）

| ID | Query | 预期覆盖 | 预期回答要求 | write-back | 主要指标 |
|---|---|---|---|---|---|
| QB-G-01 | 如何评估 agent tool call 的平均 token 成本？ | 缺口 | 明确 canon 中无对应页面 | yes | write-back precision |
| QB-G-02 | MCP 工具的超时重试策略应该怎么定？ | 缺口 | 不得假装已有规范 | yes | boundary honesty |
| QB-G-03 | 如何设计多租户向量库的权限模型？ | 缺口 | 只能给缺口说明或外推断标注 | yes | unsupported_claim_rate |
| QB-G-04 | Claude 和 GPT 在长上下文 agent 任务上的差异？ | 缺口 | 不得输出训练知识当 canon 结论 | yes | boundary honesty |
| QB-G-05 | 如何度量 patrol 去重稳定性？ | 缺口 | 应登记为指标缺口 | yes | write-back trigger |
| QB-G-06 | graph RAG 的索引刷新策略是什么？ | 缺口 | 明确无 canon 支撑 | yes | write-back precision |
| QB-G-07 | 工单系统和知识库如何做 SLA 联动？ | 缺口 | 不能编造流程 | yes | unsupported_claim_rate |
| QB-G-08 | 如何设置 approve_note 的质量评分器？ | 缺口 | 缺口登记优先 | yes | write-back trigger |
| QB-G-09 | 如何做 benchmark case 的自动判分？ | 缺口 | 如无依据，不给具体方案 | yes | boundary honesty |
| QB-G-10 | 如何估计 write-back proposal 的商业价值？ | 缺口 | 只能说明无覆盖 | yes | write-back precision |
| QB-G-11 | query_count 高的页面是否应该自动 refresh？ | 缺口 | 若无规则，应诚实说明 | yes | boundary honesty |
| QB-G-12 | agent memory 的删除策略如何审计？ | 缺口 | 不得补 invented policy | yes | unsupported_claim_rate |
| QB-G-13 | 如何验证人工审查者之间的一致性？ | 缺口 | 应提示暂无标准 | yes | write-back trigger |
| QB-G-14 | 如何量化 prompt cache 对延迟的贡献？ | 缺口 | 不得给虚构公式 | yes | unsupported_claim_rate |
| QB-G-15 | 如何把 patrol 与工单系统自动打通？ | 缺口 | 缺口说明 + proposal | yes | write-back precision |

## Query Gold 规则

1. 已覆盖：事实性声明应尽量 100% 来自 canon  
2. 部分覆盖：允许外推，但必须显式标注并计算 `canon外推断占比`  
3. 完全缺口：优先诚实说明无覆盖，并生成 write-back proposal  

