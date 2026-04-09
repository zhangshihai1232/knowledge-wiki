---
name: wiki-ingest
description: 摄入新资料到 LLM Wiki（URL/文件/文本），触发关键词：摄入、ingest、添加资料
---

# Wiki Ingest Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/ingest.md` 中的完整 Spec。

## CLI 工具层

Spec 中标记为 ⚙️ 的步骤（创建 source、创建 proposal、标记 extracted、去重检查、追加日志、更新状态）**必须**通过 `wiki-ops` CLI 工具执行：

```bash
tools/wiki-ops.sh create-source --kind <kind> --title <title> --domain <domain> --body-file <path>
tools/wiki-ops.sh create-proposal --action <action> --target-page <page> --body-file <path>
tools/wiki-ops.sh mark-extracted <source-file>
tools/wiki-ops.sh dedup-check --target-page <page>
tools/wiki-ops.sh append-log --spec ingest --message <msg>
tools/wiki-ops.sh update-state
```

标记为 🧠 的步骤（资料分类、声明提取、canon 匹配、质量评分）由 LLM 执行。

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。

**Spec 路径**：`.wiki/policy/specs/ingest.md`

## 参数说明

- **来源**（必填，三选一）：
  - URL：网页地址，工具将抓取页面正文
  - 文件路径：本地文件（支持 .md / .txt / .pdf 等文本类格式）
  - 直接文本：用户粘贴的原始文本内容
- **--domain**（可选）：指定资料归属的知识领域（如 `engineering`、`product`）；未指定时由 Spec 中的自动分类逻辑决定

## 执行

按 Spec 文件中的 Steps 逐步执行。执行完成后更新 `.wiki/policy/LOG.md` 和 `.wiki/policy/STATE.md`。
