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

## CLI 运行时

所有确定性动作都通过 `wiki` CLI 执行，不得由 LLM 直接操作文件系统。

对当前系统，优先只记住这组任务词：

 ```bash
 wiki status
 wiki check
 wiki ask "query"
 wiki import --input payload.json --json
 wiki maintain --json
 wiki taxonomy suggestions --json
 wiki taxonomy deprecate KIND ID [--replaced-by VALUE] --json
 wiki review --json
 wiki apply list --json
 wiki resolve --json
 wiki migrate list [--status STATUS] --json
 wiki migrate plan --op TYPE --scope TEXT --from KEY=VALUE... --to KEY=VALUE... [--reason TEXT] --json
 wiki migrate dry-run PLAN_ID --json
 wiki migrate apply PLAN_ID --json
 wiki migrate rollback PLAN_ID --json
 wiki migrate show PLAN_ID --json
 ```

LLM 负责语义判断、抽取、匹配、综合与裁决建议；`wiki` 负责队列、状态、日志、索引与确定性落盘。

其中：

- `wiki ask`：先做轻量分类（`domain / primary_type / subtype`），再对 canon / proposal / source 做字段收窄与词面排序，JSON 结果带 `contract_version`
- `wiki import`：按 JSON contract 一次性创建 source + proposal，并可同步完成 claims / extracted / dedup evidence 收尾；`--input -` 可从 stdin 读入
- `wiki maintain`：返回结构健康、队列统计、taxonomy pending suggestions、衰减动作等结构化维护输入
- `wiki taxonomy suggestions --json`：读取待吸收分类建议；`wiki taxonomy accept / reject` 负责显式吸收或拒绝，不让 AI 直接改写正式 registry
- `wiki taxonomy deprecate KIND ID --replaced-by VALUE`：将某 domain/primary_type/subtype 标记为废弃，支持 `--replaced-by` 指定一个或多个（逗号分隔）替代值；对应的 `replaced_by` 在注册表中以数组形式存储，支持 1:N 域拆分谱系
- `wiki review --json / wiki apply list --json / wiki resolve --json`：返回稳定的队列 JSON，避免解析表格输出
- `wiki migrate`：分类治理的迁移控制平面，见下方说明

## 迁移工作流（wiki migrate）

当用户表达以下意图时，使用迁移工作流，而**不是**直接修改文件：

| 用户意图 | 迁移操作类型（`--op`） |
|----------|----------------------|
| "把 X 域的页面重新分类到 Y 域" | `reclassify` |
| "把所有 X 域的页面移到 Y 集合下" | `relocate` |
| "把旧域名 X 改成 Y" | `rename-domain` |
| "把子类型 X 合并进 Y" | `merge-subtype` |
| "把这批旧页面归档/废弃" | `deprecate` |
| "把多个页面合并成一个" | `merge-pages` |

**标准四步流程**：

```bash
# 1. 创建计划（draft）
wiki migrate plan --op reclassify --scope "ai-to-ml-split" \
  --from domain=ai subtype=machine-learning \
  --to domain=ml \
  --reason "ML 独立成域，从 ai 分离" --json

# 2. 预演（draft → reviewed）— 不修改任何文件
wiki migrate dry-run PLAN_ID --json

# 3. 人工确认后执行（reviewed → applied）
wiki migrate apply PLAN_ID --json

# 4. 出错时回滚（applied → rolled-back）
wiki migrate rollback PLAN_ID --json
```

**P0 安全规则**：`reclassify` 操作若目标路径已存在同名页面，会抛出 `reclassify collision` 错误而非静默覆盖。收到此错误时，先处理冲突页面（合并或重命名），再重新执行 apply。

**新过滤维度（`--from` 支持）**：
- `subtype_is_null=true`：选取所有未分类（subtype 为空）的页面
- `confidence=low`：选取置信度为 low 的页面（通常是 S006 信号页面）
- `page_ids=id1,id2,...`：精确指定页面集合，绕过字段匹配

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

**快速路由备忘**：

| 用户说了什么 | 路由到 |
|------------|--------|
| 提问、询问 | `query` |
| 贴资料、记录、摄入 | `ingest` |
| 整理、刷新、批量更新 | `maintain / refresh / reconcile` |
| 重命名领域、迁移页面、废弃分类、拆分子类 | `govern → wiki migrate` |
| "taxonomy 里 X 已废弃" | `wiki taxonomy deprecate` |
| "这两个页面内容重复" | `govern → wiki migrate --op merge-pages` |
| reclassify collision 错误 | 暂停，展示三选一恢复问题（合并/重命名/放弃） |
