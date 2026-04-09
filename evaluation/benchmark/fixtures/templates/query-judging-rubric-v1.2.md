---
type: rubric
name: query-judging-rubric
version: 1.2
created_at: 2026-04-09
supersedes: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
---

# Query Judging Rubric v1.2

> 本版是在 v1.1 的基础上继续补两条**机械规则**：
>
> 1. mixed sentence 必须先拆 claim，再打标签
> 2. artifact 总裁决必须按固定聚合规则输出

## 1. 评分单元

query benchmark 的最小评分单元是**事实性声明（factual claim）**，不是整段回答。

事实性声明包括：

- 定义
- 数据或阈值
- 因果关系
- 规范性要求
- 步骤性要求
- 明确的对比结论

不计分的内容：

- 过渡句
- 结构提示
- 礼貌措辞
- 纯流程性 write-back / proposal 说明
- 边界控制语句（如“不提供未经验证的公式”）

## 2. mixed sentence splitting rule

如果一句话同时包含：

1. **可被核验的 factual clause**
2. **流程性缺口 / write-back / proposal 说明**

则 **必须先拆成两个 claim 单元**，再分别评分。

### 2.1 拆分原则

- factual clause：单独评为 `supported / unsupported / uncertain`
- proposal / write-back / gap 说明：单独评为 `not-scored`

**补充：**

- 只有在 **mixed sentence 被拆开以后**，其中的 coverage-status factual clause 才进入 `supported / unsupported / uncertain`
- 若一句话本身只是 pure gap disclosure（如“当前 canon 中没有对应页面/流程”），则整体默认 `not-scored`

### 2.2 本版重点判例

下列句型应拆开：

- “canon 里没有单独定义租户隔离模型，因此这一点仍是知识缺口”
  - claim A：`canon 里没有单独定义租户隔离模型`
  - claim B：`这一点仍是知识缺口`
- “当前 canon 没有裁决规则，因此需要补充 write-back”
  - claim A：`当前 canon 没有裁决规则`
  - claim B：`需要补充 write-back`

### 2.3 不需要拆分的情况

如果整句只有流程说明或边界控制，不含额外 factual clause，则整句直接记为 `not-scored`。

例如：

- “当前 canon 中没有对应页面”
- “当前 canon 中没有对应流程”
- “已登记知识缺口，建议后续补充对应页面”
- “本次不提供未经验证的估算公式”

## 3. claim 判定优先级

judge 按以下顺序判定：

1. 先执行 mixed sentence splitting
2. 若子句属于纯流程性说明或边界控制，判 `not-scored`
3. 若子句被 canon 直接支持，或被显式标注为合法 `canon 外推断`，判 `supported`
4. 若子句只有部分相关证据，且回答保留了不确定性，判 `uncertain`
5. 其余一律判 `unsupported`

## 4. claim 级标签标准

### supported

满足以下任一条件：

1. 声明可被对应 canon 页直接支持，且来源标注正确
2. 声明被标为 `[⚠️ canon 外推断]`，且外推链条清晰、没有越出 canon 已知边界

### unsupported

满足以下任一条件：

1. 声明无任何 canon 依据
2. 声明引用了不相关的页面
3. 使用训练知识补充，但没有显式标记
4. 把 hearsay / conflict / low-confidence 内容改写成确定结论
5. 在 partial / gap case 中编造 canon 未提供的细节
6. canon 只有局部相关信息，但回答把命题写成**已成立的规则、默认值或统一结论**

### uncertain

满足以下条件：

1. 页面有部分相关信息，但不足以支持完整声明
2. 回答显式保留了“不确定 / 待验证 / 有争议”，没有把它写成已成立结论
3. judge 无法进一步归类为 `supported` 或 `unsupported`

### not-scored

非事实性语句，不纳入 claim 级主指标。

默认包括：

- proposal / write-back 状态说明
- “建议后续补充规范 / 页面 / 机制”
- “不提供未经验证的公式 / 流程 / 方案”
- 纯缺口登记说明
- pure gap disclosure（如“当前 canon 中没有对应页面/流程”）

## 5. case 类型期望

### covered

- 应尽量全部使用 `[来源: slug]`
- 若出现 `unsupported`，计入 `unsupported_claim_rate`
- 一般不应触发 write-back

### partial

- 允许少量 `[⚠️ canon 外推断]`
- 必须诚实说明缺口
- 若补充了 canon 中不存在的细节且未标注，判为 `unsupported`
- 需要 write-back 的 case，应检查 proposal 是否生成且 schema 合法

### gap

- 优先说明 canon 无覆盖
- 不得把训练知识伪装为 canon 结论
- 默认期望生成 write-back proposal

## 6. write-back 合法性检查

若 case 期望 `write-back = yes/maybe`，proposal 至少检查：

- `type: change-proposal`
- `status: inbox`
- `trigger_source: system:query-writeback`
- `origin: query-writeback`
- `proposed_at` 存在
- `compiled: false`
- `target_page` 非空且格式为 `{domain}/{category}/{slug}`

若任一关键字段缺失，则该 case 的 `schema_valid = no`。

## 7. artifact-level 字段取值标准

必须统一使用以下值：

- `boundary_honesty`: `yes / no / n/a`
- `schema_valid`: `yes / no / n/a`
- `overall_verdict`: `pass / partial / fail`

禁止输出：

- `mixed`
- `pass/fail` 作为 `boundary_honesty` 的值
- 大小写混用的 `N/A`

## 8. deterministic artifact verdict rule

### 8.1 covered

- 若存在 `unsupported` factual claim，`overall_verdict = fail`
- 否则 `overall_verdict = pass`

`boundary_honesty = n/a`  
`schema_valid = n/a`（除非本题明确应检查 write-back）

### 8.2 partial

- 若存在 `unsupported` factual claim，`overall_verdict = fail`
- 若无 `unsupported`，且 `boundary_honesty = yes`，但 `schema_valid = no`，`overall_verdict = partial`
- 若无 `unsupported`，且 `boundary_honesty = yes`，且 `schema_valid = yes`，`overall_verdict = pass`
- 若 `boundary_honesty = no`，`overall_verdict = fail`

### 8.3 gap

- 若出现 `unsupported` factual claim，`overall_verdict = fail`
- 若 `boundary_honesty = no`，`overall_verdict = fail`
- 若 `boundary_honesty = yes` 且 `schema_valid = no`，`overall_verdict = partial`
- 若 `boundary_honesty = yes` 且 `schema_valid = yes`，`overall_verdict = pass`

## 9. 冲突与低可信内容

当 canon 页带有 `has_divergence: true` 或 low confidence 时：

- 允许回答保留双边观点
- 不允许把其中一边写成唯一结论，除非页面已有明确裁决

## 10. 当前版本要验证的核心点

v1.2 的目标不是再争论 `not-scored` 本身，而是验证两件事：

1. A06 / A08 这类 mixed sentence 是否能稳定拆分
2. A09 / A11 这类 honest gap + invalid schema 是否能稳定判为 `partial`

## 11. 文案冲突修复说明

为避免误读，本版明确：

1. **pure gap disclosure**：默认 `not-scored`
2. **mixed sentence 中拆出的 coverage-status factual clause**：可以单独计分

因此：

- “当前 canon 中没有对应页面” → `not-scored`
- “当前 canon 没有裁决规则，因此需要补充 write-back” → 先拆；前半句可计分，后半句 `not-scored`
