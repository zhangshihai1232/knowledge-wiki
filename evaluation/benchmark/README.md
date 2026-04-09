---
type: benchmark-index
name: runtime-validation-benchmark
version: 1.0
created_at: 2026-04-09
---

# Runtime Validation Benchmark

本目录用于冻结“有效性验证”阶段的基准资产。其目标不是描述理想设计，而是为后续的 **baseline vs fixed** 对照实验提供**同一批、可复用、不可随实验轮次漂移**的输入集。

## 组成

| 文件 | 内容 | 规模 |
|---|---|---|
| `source-benchmark.md` | source 输入基准集 | 30 个 case |
| `query-benchmark.md` | query 问题基准集 | 45 个 case |
| `governance-benchmark.md` | 治理异常基准集 | 15 个 case |
| `runtime-validation-protocol.md` | 运行验证协议 | 1 套 protocol |
| `fixtures/` | source fixture + canon seed + judging templates | 1 套 |

## 冻结原则

1. case ID 一经发布不得重编号  
2. 任何修改都必须升级 `version`，并在文件顶部声明变更  
3. baseline 与 fixed 必须使用**完全相同**的 benchmark 版本  
4. 若新增 case，只能追加，不得删除既有 case  

## 使用方式

1. 先选定 benchmark 版本  
2. 将 `fixtures/sources/` 与 `fixtures/canon-seed/` 挂载到运行工作区  
3. 使用 `fixtures/templates/` 记录 query answer log 与 claim judging  
4. 按 `runtime-validation-protocol.md` 运行 baseline  
5. 在相同 benchmark 上运行 fixed  
6. 对照主指标与次指标，输出最终结论  
