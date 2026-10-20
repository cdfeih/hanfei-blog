# MCP 与建模助手：独立源码实验

对应三篇工程笔记：

- `/notes/mcp-domain-tool-boundaries/`
- `/notes/mcp-write-receipts-and-recovery/`
- `/notes/modeling-assistant-runtime/`

## 来源与目的

源码来自 SE-MBSE `feature/v2.5.0/normal` 的固定提交：

`4918e0d27813a06f7496bd387758e7f3d474ed20`

提取日期：2026-10-20。`source-manifest.json` 保存原始路径与 SHA-256。

`source/` 中四个文件是该提交原始内容，未修改函数实现：

- `stream.ts`：SSE 分帧、中文解码、业务终态及取消。
- `context.ts`：业务 ID 字符串筛选。
- `ModelingResult.java`：回执错误分类和压缩结果。
- `McpOperationReceipt.java`：回执接口。

## 如何运行

环境：Node.js 20 或更新版本、JDK 21；博客已有 TypeScript 开发依赖。

在 hf-blog 根目录执行：

```sh
pnpm install
node public/examples/mcp-assistant-20261020/verify.mjs
```

若单独下载实验目录，请保留 `source/` 子目录和 manifest，并先安装 TypeScript：

```sh
npm install typescript@5.8.3
node verify.mjs
```

脚本将 TypeScript 擦除类型后加载，使用 Node 原生 Response / ReadableStream 构造输入；Java 部分直接编译原始类及 `ReceiptLab.java`。中间文件写入系统临时目录，退出时清理，不访问业务数据库或模型服务。

## 本次结果

2026-10-20 本地执行：12 项外层检查全部通过。Java 回执检查包含 8 个断言。

1. 四个源文件 SHA-256 校验。
2. 中文 UTF-8 逐字节切块、CRLF、心跳和事件顺序。
3. complete 终态及时结束。
4. error 终态及时结束。
5. confirmation 终态及时结束。
6. question 终态及时结束。
7. 无终态 EOF 报执行结果待核对。
8. 等待网络期间取消产生 AbortError。
9. 非 SSE 的 HTTP 错误不进入聊天正文。
10. 损坏 JSON 报错且释放读取锁。
11. Long 上限、溢出、收藏前缀、去重和虚拟节点过滤。
12. Java 回执错误分类及压缩回执保留恢复入口。

## 证据范围

这些检查验证实际独立函数，而不是完整应用：

- 没有连接真实大模型。
- 没有执行数据库事务、故障注入或模型创建。
- 没有验证多实例租约接管和部署代理。
- 不等于重新运行 SE-MBSE 后端测试套件。

文章中的其他实现分析来自固定提交源码；测试源文件只作为测试设计线索，历史审计文档里的通过数量不作为本次执行结果。
