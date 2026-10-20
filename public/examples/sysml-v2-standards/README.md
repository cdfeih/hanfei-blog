# SysML v2 标准解读：配套示例

核对日期：2026-10-20。

## 标准基线

| 标准 | 版本 | 当前核对的文档号 |
| --- | --- | --- |
| OMG SysML，Part 1: Language | 2.0 | formal/2026-03-02 |
| OMG KerML | 1.0 | formal/2026-03-01 |
| Systems Modeling API and Services | 1.0 | formal/2026-03-04 |

`source-manifest.json` 记录官方 URL 和本次下载内容的 SHA-256。官方 PDF 不随博客重新发布。

## 原创 SysML 教学模型

- [cooling-structure.sysml](./cooling-structure.sysml)：定义与角色。
- [cooling-specialization.sysml](./cooling-specialization.sysml)：类型、子集与重新定义。
- [cooling-requirements.sysml](./cooling-requirements.sysml)：需求约束、满足断言和验证计划骨架。

模型相互独立，使用不同包名。第三个文件依赖标准 ISQ、SI 模型库。

这些文件已经人工对照条款核对，但本次没有运行独立 SysML 编译器。验证计划骨架不包含真实测量动作或 verdict 计算，不应当作完整可执行试验。

## 可运行逻辑推演

Node.js 20 或以上，无第三方依赖：

```sh
node public/examples/sysml-v2-standards/run-experiments.mjs
```

若下载到独立目录：

```sh
node run-experiments.mjs
```

本次 8 项推演通过，包含：

1. 值集合的子集关系。
2. 子集不自动保证互斥。
3. 子集不自动保证覆盖。
4. 数量范围的兼容例子。
5. 假设与要求的蕴含真值。
6. 原创测量区间判据。
7. 缓存键丢失提交维度导致串版。
8. 固定提交读取与分支推进。

脚本不是 SysML 求值器，也不是标准 API 实现。它验证文章中的数学反例和架构推演，不能证明 `.sysml` 文件通过编译，不能作为任何产品符合标准的证明。

## 系列文章

1. SysML v2 标准解读（一）：先找到语义，再理解图形与工具。
2. SysML v2 标准解读（二）：Definition、Usage 与特化，不能只按类和对象理解。
3. SysML v2 标准解读（三）：写了 satisfy，为什么仍不能说“验证通过”。
4. SysML v2 标准解读（四）：模型 API 为什么必须知道“哪一次提交”。
