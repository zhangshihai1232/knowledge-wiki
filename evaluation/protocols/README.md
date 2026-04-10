---
type: protocol-index
name: evidence-strengthening-protocols
version: 1.0
created_at: 2026-04-09
---

# Evidence Strengthening Protocols

本目录用于承接 **“当前已被验证为有效”之后的下一层证明工作**。  
目标不是重复 frozen benchmark，而是继续回答三类问题：

1. **真实场景也成立吗？**
2. **换一批评审者也会得出类似判断吗？**
3. **连续运行一段时间后还稳定吗？**

## 文件列表

| 文件 | 目标 |
|---|---|
| `adversarial-high-scale-protocol.md` | 在受控条件下继续提高复杂度、数据量、失败注入与边界攻击强度 |
| `evidence-strengthening-roadmap.md` | 总体路线图、MVP 边界、成功标准 |
| `real-log-replay-protocol.md` | 真实日志回放实验 |
| `rater-consistency-protocol.md` | 多评审者一致性实验 |
| `longitudinal-stability-protocol.md` | 长周期稳定性实验 |

## 执行约束

1. 基于同一批输入做 baseline vs fixed 对照  
2. judge 必须盲评，不得提前知道组别  
3. 运行期间不得改规则、改 fixture、改 rubric  
4. 若使用子 agent 执行，**并发数不得超过 3**
