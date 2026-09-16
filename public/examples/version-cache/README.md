# 版本缓存一致性实验

## 范围

使用真正的 Guava 33.4.8-jre，独立验证负缓存、异步失效窗口、失效期间旧加载回填，以及代次隔离的行为。它没有使用 SE-MBSE 的 Mapper、事务管理器或事件发布器，不能代替整套系统的集成测试。

Java 文件不需要编译到项目中，不依赖 Spring、Ignite 或数据库。所有线程同步都使用带 5 秒超时的门闩；断言失败会返回非零退出码。

## 运行

环境：JDK 21、Maven。将本目录的 Java 文件和 pom.xml 放到同一目录，在该目录执行以下 PowerShell 命令：

```powershell
mvn dependency:build-classpath '-Dmdep.outputFile=classpath.txt'
$labClasspath = (Get-Content -Raw -LiteralPath classpath.txt).Trim()
java '-Dfile.encoding=UTF-8' --class-path $labClasspath CacheConsistencyLab.java
```

第一次 Maven 命令会解析 Guava 及其依赖。已经有本地依赖时，也可以直接将 guava-33.4.8-jre.jar 和 failureaccess-1.0.3.jar 的路径加入 classpath 后运行；本次实测使用该方式，JDK 为 Microsoft OpenJDK 21.0.7。

四个实验全部通过时，最后一行为 `PASS: 4 deterministic experiments`，其余输出见 expected-output.txt。

## 如何理解结果

- `negativeCache`：底层从 null 变成 NEW，没有失效时仍命中 Optional.empty。
- `asyncInvalidationWindow`：底层已更新，监听被暂停时仍命中 OLD；放行失效以后读到 NEW。
- `invalidateDuringLoad`：旧 loader 已取得 OLD，写入 NEW 并同步失效，放行旧 loader 后仍缓存 OLD。
- `generationSeparatesOldLoad`：旧请求返回 OLD，但在推进代次后开始的新请求读取 NEW。实验没有证明跨节点传播或所有并发请求的强一致性。

代码中的底层名称、标识都是独立示例，不包含业务数据。没有计时基准，loads 只是 loader 调用次数。
