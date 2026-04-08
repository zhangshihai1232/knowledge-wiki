# P2-1：compile Gate 1 增加路径有效性检查

## 背景

LLM Wiki 系统中，`compile.md` 的 Gate 1 只检查 `sources` 字段非空，但不检查路径有效性。一个失效路径（文件已被移动或删除）也能通过 Gate 1，直到 lint 才能发现——但 L004 检查的是 `cross_refs` 而非 `sources` 路径，存在检测盲区。

## 修改文件
- `.wiki/policy/specs/compile.md`

## compile.md 修改内容

### Gate 1 扩展

**在以下文字之后插入**：

```
检查更新后的 canon 页 `sources` 字段不为空列表。若为空，说明来源信息丢失，canon 页可信度无法保证。
```

**插入内容**：

```markdown
**Gate 1b：sources 路径有效性检查**

对 `sources` 列表中每个路径执行文件存在性检查：

```
for path in canon_page.frontmatter.sources:
    if not file_exists(path):
        log_warning(f"SOURCE_PATH_INVALID: {path} 不存在，可能已被移动或删除")
        report.add_warning("source_path_invalid", path)
```

若检测到失效路径，在编译报告中记录 `SOURCE_PATH_INVALID` 警告，编译继续执行（不阻塞）。

**兜底机制：proposal 路径特殊标记**

当 `sources` 中的路径指向 proposal 文件（路径包含 `.wiki/proposals/` 前缀）而非正式 source 文件时，在编译报告中额外标注"待核实来源"，与普通 source 路径失效区分：

```
for path in canon_page.frontmatter.sources:
    if path.startswith(".wiki/proposals/"):
        report.add_flag("unverified_source", path)
```

此标注不产生警告，仅作为后续 lint 追踪的辅助信息。
```

设计决策说明：
- 失效路径报 WARNING（不阻塞编译），而非 ERROR（阻塞编译）
- 原因：sources 路径失效可能是文件被合法移动，不应阻止知识更新
- WARNING 记录到编译报告中，供后续 lint 追踪

## 验证方式

1. **正常路径**：`sources` 中所有路径均存在 → Gate 1 + Gate 1b 均通过，无警告
2. **失效路径**：`sources` 中含不存在的路径 → Gate 1 通过（非空），Gate 1b 记录 `SOURCE_PATH_INVALID` 警告，编译继续
3. **proposal 路径**：`sources` 中含 `.wiki/proposals/` 路径 → 标注"待核实来源"，不产生警告
4. **空列表**：`sources` 为空列表 → 原有 Gate 1 assert 失败，记录 `QUALITY_GATE_FAIL`，行为不变
