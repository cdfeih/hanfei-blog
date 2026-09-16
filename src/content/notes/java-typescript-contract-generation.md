---
title: "生成器遇到 @Size(min=0) 为什么卡住：类型映射背后的契约"
slug: java-typescript-contract-generation
description: "从真实生成器函数的超时复现入手，解释必填语义、Long 精度、运行时校验和输出目录清理如何共同影响前后端契约。"
status: published
publishedAt: 2026-09-15
topics: [frontend, architecture, management]
kind: delivery
updatedAt: 2026-09-16
---

Java DTO 自动生成 TypeScript，可以减少重复维护。但生成器本身也是一段会出错的程序。类型文件能编译，不代表它忠实表达了后端协议；生成命令能启动，也不代表它一定能结束。

这次我没有直接执行整个 `convertJavaToTs.cjs`。它的任务链会先清理输出目录，所以我先静态检查流程，再单独抽取一个没有文件副作用的函数做实验。结果在 `@Size(min=0)` 上复现了不终止的循环。

## 一个字段为什么能让整个生成过程停住

脚本用正则提取字段注解，`isFieldRequired` 先检查 NotBlank、NotNull、NotEmpty，再根据 Size 的 min 推断必填。

关键逻辑可以缩减为：

```js
const sizeAnnotationRegex =
  /\s*@Size\s*\(\s*[^)]*min\s*=\s*(\d+)[^)]*\)/;

const regex = new RegExp(sizeAnnotationRegex);
while ((match = regex.exec(annotationStr)) !== null) {
  if (parseInt(match[1], 10) > 0) return true;
}
return false;
```

这个正则没有 `g` 标志。对同一输入反复 exec，会再次匹配同一位置：

- min=1：第一次匹配后立即 return，表面正常。
- min=0：匹配成功，条件不成立，下一轮仍然匹配同一段。
- 没有 Size：exec 返回 null，正常退出。

因此，问题只在“匹配到了，但不能提前返回”的分支出现。用常见的必填字段样例测试，很容易漏掉它。

## 实际做了怎样的隔离验证

实验通过 TypeScript AST 抽取原脚本中的两个正则常量和 `isFieldRequired`，不加载其顶层任务链。在新的 Node VM 上下文中执行，并设置 100 毫秒的运行上限。

结果：

```text
contract/required: min=1 returns true; min=0 hits VM timeout
```

这验证的是当前函数在特定输入下不返回，没有证明现有每个 DTO 都会触发它，也没有对全量生成命令做成功声明。超时由 VM 强制中止，不是让开发机上的生成进程一直挂着。

若只需读取一个 Size 的 min，单次 exec 就够了；如果支持重复注解，应该明确如何遍历和组合约束。给正则加 g 能改变循环行为，但更重要的问题还在后面。

## min 大于零，真的意味着字段必填吗

按照 [Jakarta Bean Validation 3.0 规范](https://jakarta.ee/specifications/bean-validation/3.0/jakarta-bean-validation-spec-3.0)，Size 约束允许 null。它限制的是非空值的长度或集合大小，不等同于 NotNull。

例如：

```java
@Size(min = 1)
private List<String> tags;
```

这表达“提供 tags 时不能是空集合”，并不单独表达“必须提供 tags”。当前函数把 min>0 转成 required，可能让前端拒绝后端允许的输入。

契约模型至少要区分：

```text
字段能否缺省
字段能否为 null
非 null 值的类型
值的长度、范围、格式
验证组与使用场景
```

TypeScript 的可选属性、联合 null 类型，以及运行时数组长度约束，各自对应不同语义。创建接口和局部更新接口，也可能对同一业务字段有不同要求。

修复死循环只能让生成器结束；修复映射语义才能让结果可信。

## Long 映射成 string，还需要响应真的发出字符串

脚本把 Java 的 Long 和 long 映射为 TypeScript string。这能表达大整数 ID 应保持文本身份，但类型声明不会改变 JSON.parse 的行为。

独立 JavaScript 实验：

```js
const dto = JSON.parse('{"id":9007199254740993}');
console.log(dto.id); // 9007199254740992
```

精度在 JSON 数字解析成 JavaScript number 时已经丢失。之后写 `dto as { id: string }`，或者再 `String(dto.id)`，都不能恢复原值。

所以要验收整条链：

```text
Java 实体/DTO
→ 实际序列化配置
→ 网络响应字节中的 id 是否带引号
→ JSON 解析
→ TypeScript 类型
→ 运行时校验
```

本文没有测试后端实际 HTTP 序列化，不据此宣称当前接口已经有精度问题。它说明生成结果需要与真实协议样本一起验证。

BigDecimal 被映射为 number 也需要类似判断：显示近似值与精确十进制运算的要求不同，不能根据 Java 类型名机械承诺前端精度。

## 正则扫描、AST 和编译器各看得到什么

这个脚本除了模型，还处理常量、枚举、控制器、操作枚举、WebSocket 类型和 Zod schema。它在部分阶段使用 AST，并不等于整个 Java 语义都经过编译器解析。

Java 源码中的泛型、继承、导入别名解析、嵌套类型、注解参数与多行格式，都需要对应的扫描能力。遇到不能精确映射的类型时，退回 any 可以让输出继续编译，却会隐藏契约信息丢失。

我会让生成报告列出“精确映射、降级映射、无法识别”三类字段，并让新增的降级项在评审中可见。对于关键公共接口，宁可明确失败，也不要无声生成看似完整的类型。

运行时 schema 也不能绕开这个问题：如果它由同一份错误的中间模型生成，TypeScript 与 Zod 可以一致地出错。

## 输出目录清理为什么也属于设计的一部分

脚本支持 `--out-dir`，默认输出到 `src/models`；任务链前部的 `clearGencodeDir` 使用递归删除再生成。

如果删除成功，而后续在 Size 循环卡住，旧产物已经消失，新产物也不完整。这就是为什么本文先隔离函数，没有为了验证一个边界而直接运行整个生成器。

更稳妥的生成流程可以是：

1. 验证输出路径在允许的生成目录内。
2. 生成到独立临时目录，并限制总运行时间。
3. 执行类型检查、代表性协议样本校验和契约差异比较。
4. 检查成功后替换生成产物。
5. 失败时保留原产物和可定位的错误报告。

如果输出目录中允许手写文件，还必须先划定生成文件的所有权，不能靠清空目录维持整洁。

## 该怎样证明“自动生成值得信任”

我会保留一组小而有区分力的 Java 输入：可空 Size、NotNull、Long 大值、嵌套泛型、继承字段和局部更新对象。逐项断言生成类型、运行时 schema 和真实 JSON 样本的关系，并给整个生成流程设置超时。

源码基线 `67b9805a064b`，入口 `client/script/convertJavaToTs.cjs`。[实验包](../../examples/engineering-labs/README.md) 包含原函数抽取结果、来源指纹、VM 超时检查与大整数解析示例。

本轮没有执行会清理目录的完整生成任务，没有修改生成器，也没有验证所有后端端点。已经确认的事实是：当前必填函数在指定边界输入下不能结束；其余契约风险需要相应的端到端证据。
