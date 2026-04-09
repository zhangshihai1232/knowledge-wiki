---
type: validation-report
name: p0-pilot-final-report
version: 1.0
created_at: 2026-04-09
---

# Knowledge-Wiki 有效性验证阶段结论（P0 Pilot）

## 一句话结论

**本轮修复已经把系统从“接近可验证”推进到“可以开始正式验证”，并在 P0 pilot 中显示出明确的正向效果；但它还不是完整 90 case 端到端验证的最终结论。**

## 本轮已经证明的内容

### 1. 指标现在可采了

此前最严重的问题不是分数低，而是很多指标“想评但采不到”。本轮修复后：

- query 的 `last_queried_at` / `query_count` 已有明确更新时机
- `canon外推断占比` 已有明确公式
- `origin` 与 system `trigger_source` 已可表达 write-back / patrol 来源
- `lint-patrol` proposal 已可被下游 spec 正式消费

因此，系统已经具备“运行验证”的基础条件。

### 2. 治理路由闭环更稳定了

P0 pilot 对照表明：

- baseline 中，`query-writeback` 和 `lint-patrol` 都存在错误下游或未定义下游问题
- fixed 中，`query-writeback` 必须先补真实来源，再进入 compile
- fixed 中，`lint-patrol` 经 promote 批准后由 maintain 正式消费

这意味着系统的治理闭环从“概念上存在”变成了“规则上可执行”。

### 3. patrol 不再天然自循环

新增去重 + TTL 后，patrol 至少在规则层已经具备避免重复生成同类维护提案的能力。  
这对于后续实验非常关键，因为否则实验日志会被自生成噪声污染。

## 本轮还没有证明的内容

以下内容仍需 **full benchmark runtime validation** 才能正式证明：

1. query 回答中的 `unsupported_claim_rate` 是否显著下降  
2. 冲突型 source 的端到端处理质量是否显著提升  
3. 不确定资料是否真的被更稳妥地保留为“待验证”而不是写实  
4. 完整 benchmark 上 fixed 是否达到 protocol 中定义的成功阈值  

## 当前最合理的结论口径

如果现在必须给一个结论，最严谨的说法是：

> **系统的“验证准备度”已经被证明显著提升，且治理闭环的关键 P0 缺口已被修复；但关于“系统整体是否已经显著有效”，还需要在冻结 benchmark 上完成完整 baseline vs fixed 运行后才能下最终结论。**

## 建议的下一步

直接进入 full benchmark：

1. 用 `evaluation/benchmark/` v1.0 跑 baseline 全量一轮  
2. 用同一 benchmark 跑 fixed 全量一轮  
3. 按 `runtime-validation-protocol.md` 汇总主指标  
4. 输出最终口径：有效 / 部分有效 / 证据不足  

