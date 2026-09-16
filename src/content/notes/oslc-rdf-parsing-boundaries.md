---
title: "RDF 解析成功，不代表选对了资源：从三元组走到业务 DTO"
slug: oslc-rdf-parsing-boundaries
description: "沿 Jena Model、资源选择和字符串投影三层检查 OSLC 解析，分析多资源响应、语言标签丢失、空白节点和错误诊断的真实边界。"
status: published
publishedAt: 2026-09-15
topics: [modeling, architecture]
kind: architecture
updatedAt: 2026-09-16
---

接入外部工程工具时，拿到一段 XML 并成功解析，只完成了第一步。接下来还要确定：图里哪个资源才是本次请求的目标？同一个属性有多个值时选哪个？转换成字符串后还剩下多少语义？

SE-MBSE 的 OSLC 适配器把 Jena 模型读取集中到 `OslcRdfModelReader`，业务解析器再生成 DTO。这个分层能把 XML 读取与业务投影分开，也让边界容易被逐层检查。

## 先把“解析成功”拆成三关

当前 `readModel` 的次序是：

```text
输入有文本
  → Jena 按 RDF/XML 读取
  → Model 中至少存在一条三元组
  → 交给具体业务解析器
```

空输入、解析抛异常、空图分别有错误信息。但图非空不等于包含所需资源，更不等于资源的必填字段齐全。

RDF 用主语、谓语、宾语表达关系，XML 是其中一种序列化形式；资源可以在同一文档的多个位置被描述。[Jena RDF API 教程](https://jena.apache.org/tutorials/rdf_api.html) 给出了这种图模型的基础。因此解析后应围绕资源和属性查询，不能依赖 XML 节点的视觉嵌套来推断全部关系。

## 实际的 Resource 解析器怎样挑主语

`OslcResourceParser.parse` 调用 reader 后，进入 `findResourceSubject`。它先枚举带 `rdf:type` 的语句，收集 URI 主语，取候选中的第一个；没有这些候选时，再按标题、标识、描述等谓语尝试寻找主语。

随后用同一个 subject 读取标题、短标题、标识、描述、创建时间、服务提供者等字段，再遍历该主语的全部属性填入 `properties`。

关键在于：**这里的“第一个”来自模型迭代，没有按请求 URI 精确定位，也没有验证候选唯一性。**

例如响应中同时包含：

```turtle
# 用 Turtle 表示等价图，便于阅读；当前入口仍接收 RDF/XML。
<https://example.test/requirements/42>
    a <https://example.test/types/Requirement> ;
    <http://purl.org/dc/terms/title> "制动需求"@zh .

<https://example.test/providers/1>
    a <http://open-services.net/ns/core#ServiceProvider> ;
    <http://purl.org/dc/terms/title> "工程服务"@zh .
```

两者都是有 type 的 URI 主语。业务请求想要需求 42，不能把“迭代器先给出的那个”当成业务选择规则。

本文没有运行这个 RDF 的 Jena 集成测试，也不预言当前依赖版本会先返回哪个。恰恰相反：只要契约依赖这种顺序，测试样本偶然选对也不足以证明实现稳健。

## 谓语降级还有自己的优先级

`firstSubjectWithAnyPredicate` 按传入的谓语列表逐项查找，找到第一个存在匹配的谓语后，立即返回它的首个主语。

所以这是两层选择：

1. 谓语列表顺序决定先看哪一类属性。
2. 在该属性对应的多个主语中取第一个。

它并不是“统计所有主语，选择最像目标资源的那个”。如果一个元数据资源有标题，真正目标只有标识字段，标题在列表前面就可能影响选择。

更清楚的设计是让解析上下文携带预期资源 URI：先按该 URI 查图，必要时按允许的类型过滤；候选仍多于一个时返回歧义信息。若产品确实需要列表，则返回列表，不要用 `first` 悄悄吞掉其他资源。

这是接口设计建议，当前 `parse(String rdfXml)` 没有这个上下文参数。

## 从 RDFNode 变成 String，哪些信息会丢失

`nodeValue` 对三类节点分别返回 URI、空白节点标签或字面量的 lexical form。后者只是字面量的词法文本：

```text
"Brake"@en                       → "Brake"
"Brake"@de                       → "Brake"
"01"^^xsd:integer                → "01"
"01"^^xsd:string                 → "01"
```

变成字符串后，语言和数据类型已经消失。DTO 的属性 Map 虽然保留多个值，但 `List<String>` 仍然无法恢复这些区别。

如果页面只展示一段文本，这可能是有意的简化；如果后续要做多语言选择、数值比较或再次生成 RDF，这个投影就不够。可以显式建模：

```ts
// 建议的边界类型，并非当前 DTO
type RdfValue =
  | { kind: 'iri'; value: string }
  | { kind: 'blank'; value: string }
  | { kind: 'literal'; value: string; language?: string; datatype?: string };
```

业务层再决定如何显示。这样“原始语义”和“适合界面的文本”不会混在一个字段里。

## 空白节点和相对 URI 要单独验收

`resourceIdentity` 对空白节点返回标签。标签可用于同一次解析中连接关系，不应未经定义就作为跨请求的全局业务 ID。

`readModel` 调用 `model.read(reader, null, "RDF/XML")`，没有传入实际响应 URL 作为 base。对于相对 URI，需要测试 XML 自带 `xml:base`、调用方提供基地址和缺少基地址的区别。不能仅凭样例全是绝对 URI，就认为相对资源一定按请求地址解析。

这两类问题往往在单文件样例里不出现，跨页面引用、分页响应和再次抓取时才暴露出身份不稳定。

## 诊断信息也属于解析边界

解析异常会附带前 120 个字符串单位的预览，以及前 12 个 Unicode 码点。码点适合辅助识别 BOM、不可见前缀或拿错编码的迹象；预览能帮助识别实际收到的是登录页还是 RDF。

但预览直接来自远端正文，只替换 CR/LF。登录页、错误页也可能包含需要控制的内容。因此日志处应结合 HTTP 状态、Content-Type、响应长度与安全端点信息，决定是否保留正文片段，而不是默认把解析异常完整暴露给最终用户。

同时，错误分类应保留三层：传输不满足预期、RDF 语法或图结构错误、业务资源不满足要求。它们对应不同修复动作。

## 一组能防止“样例通过”的测试数据

最低限度应包含：

| 输入 | 要验证的断言 |
| --- | --- |
| 空白文本、合法空 RDF 图 | 分别进入对应错误路径 |
| 一个目标加一个服务资源 | 目标按显式规则选择 |
| 同一标题含两种语言 | 按策略选择或保留语言信息 |
| typed literal 与同文本字符串 | 不在语义层提前混同 |
| 空白节点关联 | 同图关系可追踪，跨请求不误作固定 ID |
| 相对 URI 与 xml:base | 解析后的绝对身份符合协议 |
| HTML 登录页 | 错误分类与日志内容符合预期 |

这些是建议验收数据，不是已经全部运行的测试清单。

基线为 `67b9805a064b`，源码位于 adapter service 的 `adapter/oslc/parser/OslcRdfModelReader.java` 与 `OslcResourceParser.java`。本文完成源码追踪和图模型推演，未启动外部 OSLC 服务或执行 Jena 集成测试。
