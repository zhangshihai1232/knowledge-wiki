---
name: wiki-ingest
description: 摄入新资料到 LLM Wiki（URL/文件/文本），触发关键词：摄入、ingest、添加资料
---

# Wiki Ingest Skill

## 执行前提

读取并严格遵循 `.wiki/policy/specs/ingest.md` 中的完整 Spec。

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
