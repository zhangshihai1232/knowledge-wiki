# P6-5：Audit Mode 输出原型

## 目标

为单入口 Skill 提供一个**按需展开**的审计视图，使高级用户可以看到系统内部依据，但默认用户不被这些细节打扰。

---

## 使用原则

Audit Mode 只在以下场景打开：

1. 用户明确要求“看依据 / 看路由 / 看 proposal”
2. 系统命中了高风险动作，需要解释为什么被拦截
3. 用户怀疑当前结果与已有知识冲突

默认模式不自动展开 Audit Mode。

---

## 输出结构

Audit Mode 固定返回 5 段：

1. **结果**
2. **命中依据**
3. **内部路由**
4. **系统动作**
5. **风险拦截**

---

## 原型模板

```text
结果：
{最终给用户的结果}

命中依据：
- canon 页面：{slug 列表}
- 外推断句子：{如有}
- 缺口说明：{如有}

内部路由：
- 一级路由：{answer | absorb | organize | audit}
- 二级动作：{query / ingest / refresh / maintain / write-back}

系统动作：
- 是否生成 proposal：{yes/no}
- proposal 位置：{如有}
- 是否触发后台维护：{yes/no}

风险拦截：
- 是否命中确认门：{yes/no}
- 拦截原因：{如有}
```

---

## 原型示例

```text
结果：
当前没有统一归档阈值。

命中依据：
- canon 页面：ai/wiki/archive-threshold
- 外推断句子：无
- 缺口说明：当前 canon 未裁决双方分歧

内部路由：
- 一级路由：answer
- 二级动作：query + write-back

系统动作：
- 是否生成 proposal：yes
- proposal 位置：changes/inbox/2026-04-09-query-gap-archive-threshold-rule.md
- 是否触发后台维护：no

风险拦截：
- 是否命中确认门：no
- 拦截原因：无
```

---

## 非目标

Audit Mode 不追求：

1. 暴露全部系统日志
2. 让用户看到 schema 原始字段
3. 让用户手动接管内部路由

---

## 当前结论

Audit Mode 的作用不是让系统更复杂，而是：

> **把复杂度保留为“可按需查看”，而不是“默认压给所有人”。**
