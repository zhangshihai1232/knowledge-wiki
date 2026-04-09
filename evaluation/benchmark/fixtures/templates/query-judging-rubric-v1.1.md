---
type: rubric
name: query-judging-rubric
version: 1.1
created_at: 2026-04-09
supersedes: evaluation/benchmark/fixtures/templates/query-judging-rubric.md
---

# Query Judging Rubric v1.1

> 本版是为多评审一致性增强实验新增的**澄清版 rubric**。  
> 目标不是重写主干标准，而是收紧一条已定位的边界歧义：
>
> 1. 流程性缺口说明默认归为 `not-scored`
> 2. `unsupported` 与 `uncertain` 的边界进一步明确

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
- 明确标记为“资料未覆盖”的缺口说明本身
- 边界控制语句（如“本次不提供未经验证的公式”）
- 流程性 write-back / proposal 说明（如“已登记知识缺口”“建议后续补页”“需要 write-back”）

## 2. claim 判定优先级

为减少标签漂移，judge 先按以下顺序判定：

1. **先问：这是不是流程性缺口说明或边界控制语句？**
   - 如果是，优先判 `not-scored`
2. **再问：这条声明是否被 canon 直接支持，或被显式标注为合法 `canon 外推断`？**
   - 如果是，判 `supported`
3. **再问：这条声明是否只有部分相关证据，且回答本身保留了不确定性？**
   - 如果是，判 `uncertain`
4. **其余一律判 `unsupported`**

## 3. claim 级标签标准

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

**澄清：**

- 如果回答把一个“仍有争议 / 尚无统一规则”的主题写成确定规则，判 `unsupported`，**不是** `uncertain`
- `uncertain` 只适用于回答本身保留了“不确定 / 待验证 / 尚无定论”边界的情况

### uncertain

满足以下条件：

1. 页面有部分相关信息，但不足以支持完整声明
2. 回答显式保留了“不确定 / 待验证 / 有争议”，没有把它写成已成立结论
3. judge 无法进一步归类为 `supported` 或 `unsupported`

### not-scored

非事实性语句，不纳入 claim 级主指标。

**默认按 `not-scored` 处理的句型包括：**

- “当前 canon 中没有对应页面”
- “本次不提供未经验证的估算公式 / 自动化流程 / 具体方案”
- “已登记知识缺口 / 已生成 proposal”
- “建议后续补充相关规范 / 页面 / 机制”
- “需要 write-back / 建议 write-back”

**注意：**

- 如果一句话除了流程说明，还额外声称了可被核验的领域事实，则要拆开看；只有流程部分算 `not-scored`

## 4. case 类型期望

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

## 5. write-back 合法性检查

若 case 期望 `write-back = yes/maybe`，proposal 至少检查：

- `type: change-proposal`
- `status: inbox`
- `trigger_source: system:query-writeback`
- `origin: query-writeback`
- `proposed_at` 存在
- `compiled: false`
- `target_page` 非空且格式为 `{domain}/{category}/{slug}`

若任一关键字段缺失，则该 case 的 `schema_valid = no`。

## 6. 指标计算口径

### unsupported_claim_rate

`unsupported` claim 数 / `supported + unsupported + uncertain` claim 数

### canon_inference_ratio

`[⚠️ canon 外推断]` 的 factual claim 数 / 全部 factual claim 数

### writeback_schema_valid_rate

合法 write-back proposal 数 / 全部 write-back proposal 数

### boundary_honesty

若 partial / gap case 对缺口有显式说明，且未编造不存在细节，则记为通过。

## 7. 冲突与低可信内容

当 canon 页带有 `has_divergence: true` 或 low confidence 时：

- 允许回答保留双边观点
- 不允许把其中一边写成唯一结论，除非页面已有明确裁决

## 8. 本版新增的判例锚点

### 8.1 流程性缺口说明

像下面这类句子，默认按 `not-scored`：

- “当前 canon 中没有对应页面”
- “已登记知识缺口”
- “建议后续补充对应规范”

因为它们的作用是**交代边界或记录流程状态**，不是提供领域事实。

### 8.2 相关但不足以下结论

如果 canon 只表明“相关”或“存在争议”，而回答把它写成统一规则、常见阈值或默认结论，判 `unsupported`。

只有在回答自己保留了“尚不确定 / 待验证 / 无统一规则”时，才可判 `uncertain`。
