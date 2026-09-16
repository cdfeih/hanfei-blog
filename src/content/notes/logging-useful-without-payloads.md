---
title: "日志脱敏函数也需要反例：非法 URL、短指纹与字符串长度"
slug: logging-useful-without-payloads
description: "直接编译运行项目 LogSanitizer，用合成输入核对 URL 降级路径、UTF-16 长度与指纹边界，再讨论如何留下可排障的结构化证据。"
status: published
publishedAt: 2026-09-15
topics: [architecture, management]
kind: delivery
updatedAt: 2026-09-16
---

不记录完整请求体以后，日志怎样帮助排障？一个常见做法是保留类型、长度和短指纹。SE-MBSE 的 `LogSanitizer` 正在提供这些能力。

但“用了脱敏函数”不是最终验收条件。异常输入会走另一条分支，短指纹也有碰撞，长度字段甚至可能不是读者以为的字节数。我把这个没有第三方依赖的 Java 类原样复制进实验目录，用 JDK 21 直接编译运行了边界用例。

## 正常 URL 分支处理了什么

`withoutQuery` 先用 `new URI(value)` 解析。对有 host 的绝对 URI，重新构造一个不带用户信息、查询串和 fragment 的 URI。

测试输入全部是虚构值：

```text
输入：
https://alice:synthetic@example.test/path?token=synthetic#fragment

输出：
https://example.test/path
```

这条路径既去掉查询参数，也去掉 `alice:synthetic@`。保留协议、主机和路径，仍然可以判断调用的是哪个端点。

不过路径本身也可能含业务标识或敏感片段。函数并不知道端点的领域语义，调用处仍然需要决定是否记录完整 path。

## 非法 URI 会走不同的处理规则

如果解析失败，或者不满足绝对 URI 且有 host 的条件，函数退回字符串截断：找 `?` 与 `#` 的最早位置，取前缀，然后清理换行与制表符。

给路径放一个未编码空格：

```text
输入：
https://alice:synthetic@example.test/a b?token=synthetic

实际输出：
https://alice:synthetic@example.test/a b
```

查询串消失了，用户信息却保留下来。这个结果不是对 URI 行为的猜测，而是原始生产类的断言输出。

问题在于降级路径只完成“去查询串”，没有维持正常分支的“去用户信息”保证。修订时可以在解析失败后仅记录明确的失败标记与安全指纹，或者实现经过反例测试的保守端点提取。不要把原始字符串当作“解析失败时至少留点线索”的默认日志内容。

本文没有替换生产工具类；实验保留了原行为，便于后续修复做回归对照。

## length=3，不是发送了 3 个字节

`payloadSummary` 使用 `String.valueOf(payload)`，再记录 `value.length()`。Java 的这个长度按 UTF-16 代码单元计数。

实际测试：

```text
字符串：A + 一个笑脸字符
UTF-16 代码单元：3
UTF-8 字节数：5
摘要中的 length：3
```

如果排障问题是“消息是否超过字节限制”，这个 length 不能直接使用。可以把字段明确命名为 `utf16Length`，需要网络载荷大小时另记序列化后、指定编码下的字节数。

类型也要看调用处。事件发布器先调用 `JSONUtil.toJsonStr(event)` 再传入摘要函数，摘要看到的类型是 String，且 JSON 序列化和字符串分配已经发生。日志正文没有输出完整 JSON，不等于没有构造完整 JSON。

所以优化日志性能，要同时检查日志级别判断、序列化发生位置、对象大小和采样策略，不能只修改输出格式。

## 12 位十六进制指纹可以用来做什么

`fingerprint` 对 UTF-8 数据计算 SHA-256，截取前 12 个十六进制字符，即 48 位。测试中：

```text
fingerprint("abc") = ba7816bf8f01
```

它适合在有限排障窗口内辅助关联相同输入，却不是唯一 ID，更不是匿名化承诺。候选空间很小的值仍可能被枚举比对；相同指纹也不能严格证明原文相同。

用生日问题的近似式估算，若有一百万个不同输入，并假定截断结果均匀独立：

```text
碰撞概率 ≈ n(n - 1) / (2 × 2^48)
         ≈ 0.001776
         ≈ 0.18%
```

这是概率模型，不是观测到的项目碰撞率。它提示我们不要把短指纹作为审计主键或业务去重依据。是否改用更长指纹、带密钥的摘要或完全不记录，取决于关联需求与数据性质。

## “控制字符清理”的范围也要准确

当前 `stripControlCharacters` 只替换 CR、LF 和 TAB：

```java
return value.replaceAll("[\\r\\n\\t]", "_");
```

测试确认 `a\r\n\tb` 变成 `a___b`，但 Unicode 行分隔符 U+2028 保持原样。因此不能把方法名解释为“所有控制和分隔字符已清理”。

`mask` 还有另一种契约：空值返回固定标记，六个及以下字符全部替换，较长值保留首尾各三位。它服务于短标识定位，不适合代替任意文本清洗，也没有独立清理内部换行的步骤。

这些函数可以组合，但组合顺序和允许记录的字段需要由调用方明确。

## 真正有用的日志还缺哪些结构

一条“type=String,length=123,fingerprint=...”能说明载荷形态，却不能独立回答业务为什么失败。我更希望关键路径留下这样的字段：

```text
eventId / traceId
operation / stage
projectId 或允许记录的业务定位标识
attempt / durationMs
resultCode / exceptionType
payloadUtf16Length / payloadFingerprint
```

这是建议的字段设计，不是声称当前所有调用处已经具备。不要直接把用户名称、完整资源 URI 或动态对象放进高基数指标标签；日志定位字段与聚合指标标签承担不同任务。

例如上传失败，`stage=upload` 比只有“导出失败”更能指导排查。事件监听器失败时，稳定的 listener 标识也比全量对象 dump 更便于分组。

## 复现与验证范围

源码为核心模块 `util/LogSanitizer.java`，基线 `67b9805a064b`。实验保留源文件，附文件指纹与 `LogSanitizerLab.java`。

[下载与运行说明](../../examples/engineering-labs/README.md) 中给出编译命令。本轮在 JDK 21.0.7 上通过 10 项断言，覆盖正常与非法 URL、掩码、短指纹、两种长度、CR/LF/TAB 和 Unicode 分隔符。

这里验证的是工具类输入输出，没有扫描全部日志调用点，也没有宣称系统已经完成全面日志脱敏。
