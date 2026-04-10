---
type: benchmark-fixture-index
name: runtime-validation-fixtures
version: 1.0
created_at: 2026-04-09
---

# Runtime Validation Fixtures

本目录保存 `runtime-validation-protocol.md` 所需的可执行 benchmark 载体。

## 目录结构

| 路径 | 用途 |
|---|---|
| `sources/` | 可直接复制到 `.wiki/sources/` 的 source fixture |
| `canon-seed/` | query benchmark 使用的冻结 canon 初始状态 |
| `templates/` | query answer log、claim annotation、judging rubric 模板 |

当前规模：

- `sources/`：30 个 source fixture
- `canon-seed/`：15 个 canon 页面 + 4 个索引文件
- `templates/`：4 个 query judging / adjudication 模板

## 约束

1. fixture 文件内容是**合成但 schema 合法**的实验材料  
2. source fixture 的 `title` 均带 benchmark case ID，方便 case 级追踪  
3. baseline 与 fixed 必须从**同一份** `canon-seed/` 开始  
4. 若 fixture 发生变化，必须同步升级 benchmark / protocol 版本
