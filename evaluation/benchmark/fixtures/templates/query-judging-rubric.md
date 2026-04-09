---
type: rubric
name: query-judging-rubric
version: 1.0
created_at: 2026-04-09
---

# Query Judging Rubric

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

## 2. claim 级标签标准

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

### uncertain

满足以下任一条件：

1. 页面有部分相关信息，但不足以支持完整声明  
2. 回答显式保留了“不确定 / 待验证 / 有争议”，且 judge 无法进一步归类为 supported 或 unsupported

### not-scored

非事实性语句，不纳入 claim 级主指标。

## 3. case 类型期望

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

## 4. write-back 合法性检查

若 case 期望 `write-back = yes/maybe`，proposal 至少检查：

- `type: change-proposal`
- `status: inbox`
- `trigger_source: system:query-writeback`
- `origin: query-writeback`
- `proposed_at` 存在
- `compiled: false`
- `target_page` 非空且格式为 `{domain}/{category}/{slug}`

若任一关键字段缺失，则该 case 的 `schema_valid = no`。

## 5. 指标计算口径

### unsupported_claim_rate

`unsupported` claim 数 / `supported + unsupported + uncertain` claim 数

### canon_inference_ratio

`[⚠️ canon 外推断]` 的 factual claim 数 / 全部 factual claim 数

### writeback_schema_valid_rate

合法 write-back proposal 数 / 全部 write-back proposal 数

### boundary_honesty

若 partial / gap case 对缺口有显式说明，且未编造不存在细节，则记为通过。

## 6. 冲突与低可信内容

当 canon 页带有 `has_divergence: true` 或低 confidence 时：

- 允许回答保留双边观点
- 不允许把其中一边写成唯一结论，除非页面已有明确裁决

