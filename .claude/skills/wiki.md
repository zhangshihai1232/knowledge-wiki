---
name: wiki
description: 单入口 LLM Wiki Skill，自动处理提问/摄入/整理/查看依据，触发关键词：/wiki、知识库、吸收资料、整理知识、看依据
---

# Wiki Skill

## 执行前提

先读取并严格遵循 `.wiki/policy/specs/wiki.md` 中的完整 Spec。

若内部主路由命中具体流程，再继续读取对应的底层 Spec：

- `query` → `.wiki/policy/specs/query.md`
- `ingest` → `.wiki/policy/specs/ingest.md`
- `reconcile` → `.wiki/policy/specs/reconcile.md`
- `refresh` → `.wiki/policy/specs/refresh.md`
- `maintain` → `.wiki/policy/specs/maintain.md`

## 快速入口

**当前工作目录**：检查 `.wiki/` 是否存在，如不存在提示用户先初始化。  
**前台 Skill 路径**：`.claude/skills/wiki.md`  
**前台 Spec 路径**：`.wiki/policy/specs/wiki.md`

## 用户输入契约

- 用户直接输入自然语言请求，不要求先声明 `query / ingest / maintain`
- 用户可附带 URL、文件路径或直接粘贴资料
- 若用户想展开细节，可直接在请求中说：
  - “看依据”
  - “展开细节”
  - “为什么这么判断”
  - “看 proposal”
  - “看内部路由”

## 输出契约

默认返回 4 段：

1. **结果**
2. **边界**
3. **系统动作**
4. **需要你决定**

若本次处理确实触发了 proposal、后台维护或风险提醒，再附加**后台摘要**。  
若用户明确要求细节或系统命中高风险拦截，再附加 **audit 视图**。

## 执行

1. 先按 `.wiki/policy/specs/wiki.md` 判断主任务类型与是否需要 audit
2. 内部自动路由到底层 Spec，禁止把路由选择抛回给用户
3. 默认先输出前台结果
4. 若满足条件，再追加后台摘要
5. 若满足条件，再追加 audit 视图
6. 若命中高风险动作，只提出**单个最小确认问题**
