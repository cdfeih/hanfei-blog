---
title: "导出显示成功，文件却没准备好：分页、管道上传与任务终态"
slug: async-excel-task-lifecycle
description: "追踪 Excel 导入导出的真实调用链，解释分页一致性、PipedStream 背压、上传 Future 的异常传播，以及持久化任务记录和恢复执行的区别。"
status: published
publishedAt: 2026-09-11
topics: [architecture, management]
kind: delivery
updatedAt: 2026-09-16
---

异步导出常被描述成“把生成 Excel 放进线程池”。但用户看到的是一项可以查询进度、下载文件的任务。线程结束、行处理结束、文件封装结束、上传成功、任务状态落库，至少是五个不同的完成点。

SE-MBSE 已经有持久化任务表和导出进度更新。这篇文章沿现有实现检查：哪一步决定用户最终看到“成功”，以及这个判断覆盖了哪些失败。

## 任务不是只存在于内存

`AsyncExportTaskSupport.createTask` 创建 `ExcelTaskEntity`，设置 INIT 后调用 `taskService.save`。`onExport` 将状态更新为 PROCESSING，并保存成功数、失败数和总数。

因此不能把它误写成“只有线程池，没有任务记录”。真正需要检查的是任务记录和执行资源之间的关系：

```text
任务表：INIT → PROCESSING → 终态
                         ↑
执行链：分页查询 → 写 Excel → 管道 → 上传 → 获取文件地址
```

任务表可用于查询状态，但不能仅凭一条 PROCESSING 记录恢复中断的分页位置、输出流和已写文件。恢复执行还需要输入留存、检查点以及重试是否重复写业务数据的约束。

## 导入批次在哪里结束

导入侧的 `AsyncPageReadListener` 累积一批数据后，同步调用 consumer，不是每一页都另起任务。消费链大致为：

```text
support.onImport
→ handler.beforePerPage
→ handler.importData，取得错误行
→ ctx.record(本批行数, 错误行数)
→ support.onWrite，输出处理结果
→ handler.afterPerPage
```

尾批不足批量大小时也要刷新。监听器把 Excel 行号放入实现 `ISheetRow` 的对象，转换失败时生成对应的错误信息并计数，保留了定位原始行的依据。

这种逐批消费可以限制当批对象数量，却不能直接承诺整个导入的固定内存上限：解析器、错误结果、业务处理器和上传通道还各有缓冲。

另一个资源边界是：导入器在提交线程池前已经创建输入与读取对象。若任务提交被拒绝，异常发生在异步主体的 try/finally 之外。因此资源释放需要覆盖“构造完成但没有执行”的情况。

## 分页导出不自动获得一致快照

`AsyncExcelExporter` 查询第一页，依据总数和页大小计算页数，随后继续逐页查询。数据是否稳定，取决于具体 handler 的查询约束。

用一个最小例子说明偏移分页的风险：

```text
初始数据按 ID 排序：[1, 2, 3, 4]，每页 2 条
第一页：offset 0 → [1, 2]
期间删除 ID 1，当前集合变成 [2, 3, 4]
第二页：offset 2 → [4]

最终文件：[1, 2, 4]，缺少 3
```

实验包固定了这个交错，输出 `exported=1,2,4; skipped=3`。这是独立分页模型，不代表当前每个导出 handler 都存在这个问题，也不是数据库复现。

稳定排序是必要条件，仍不足以抵抗集合变化。可选方案包括一致性快照、固定导出 ID 集合，或带明确版本上界的游标查询。游标能缓解偏移移动，但不会自动把可变字段冻结为同一时点。

## 为什么上传要另起一个线程

首次 `onWrite` 会创建相连的 `PipedOutputStream` 和 `PipedInputStream`，然后用一个独立线程运行上传 FutureTask：

```text
导出线程：
  分页数据 → EasyExcel → PipedOutputStream
                              ↓ 有限缓冲
上传线程：
  文件服务 ← PipedInputStream
```

如果同一线程先写完整文件，再开始读取管道，缓冲写满后可能停在写入处，永远走不到读取。独立读取者让管道可以边产出、边消费。

这个结构也形成背压：上传慢时，写入端可能阻塞，进而放慢分页生产。背压能限制这一段的积压，但还要为上传卡住、上传线程失败和取消任务设计退出路径。每项任务另建线程，也意味着并发任务数会影响线程资源，不能只给主导出线程池设置上限就结束容量评估。

## 终态判定遗漏了哪类失败

正常完成调用 `onComplete`，先执行 `close(ctx)`，顺序是：

1. `ExcelWriter.finish()`，完成文件写入。
2. 关闭输出流，让读取端能够看到结束。
3. `ctx.getFuture().get()`，等待上传结果并取得文件地址。
4. 关闭输入流。
5. 根据行失败数设置任务终态并保存。

这里顺序有意义：在写入端尚未结束前等待上传返回，可能形成相互等待。

但当前 `close` 对等待上传和关闭输入流的异常只记录日志，没有向 `onComplete` 传播，也没有增加行失败数。因此存在这样一条源码可达路径：

```text
所有行处理成功，failCount=0
→ 上传 Future 异常
→ close 捕获并记录异常，resultFile 没有成功赋值
→ onComplete 仍按 failCount=0 设置 COMPLETED
→ 写入任务并发送成功消息
```

这说明“行数据处理成功”和“交付物可下载”是两个维度。本文没有实际令文件服务失败；这条结论来自异常分支与状态赋值的静态核对。

另外，`future.get()` 没有超时。如果上传一直不结束，任务可能长期停留在处理中。加超时后还要关闭管道、取消上传并收尾，单独抛一个 TimeoutException 不等于资源已经释放。

## 如何把成功定义得可验证

我会让文件完成阶段返回明确结果或传播异常，终态必须同时检查：

```text
处理结果允许交付
AND Excel 封装成功
AND 上传成功并取得有效文件引用
AND 任务终态保存成功
```

部分行失败但结果文件可下载，可以是 PARTIAL_FAILED；上传失败则不能复用“行成功”来显示成功。状态设计还应区分任务执行错误、交付物错误和通知错误：通知失败不应该重新生成整份文件。

这些是修改建议，当前文章没有改动任务引擎。

## 如何做一次有价值的验收

应至少覆盖最后一页、空数据、上传中断、上传永不结束、线程池拒绝和进程重启。对每种情况检查：持久化状态、文件是否可读、错误阶段是否明确、流和线程是否退出、再次执行是否重复副作用。

源码基线 `67b9805a064b`，系统 service 中 `asyncexcel/importer/` 与 `exporter/` 是入口，重点是 `AsyncPageReadListener`、`AsyncExcelImporter`、`AsyncExcelExporter` 和 `AsyncExportTaskSupport`。

[实验包](../../examples/engineering-labs/README.md) 已验证分页模型；数据库分页、EasyExcel 文件产出、管道上传故障和任务恢复尚未做集成验证。
