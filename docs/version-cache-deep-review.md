# 版本缓存文章深度修订记录

修订日期：2026-09-15。源码 HEAD：`67b9805a064b68dffda405e2f1134e57b84859e1`。

## 本次完成

重写[版本缓存文章](../src/content/notes/version-aware-cache-keys.md)，保留读取到的 published 状态、slug 与发布日期；未提交、推送或部署。其他 14 篇未在本次完成深度重写。

## 具体增加的内容

- 从 key 到 Mapper、引用上下文切换、Ignite 版本过滤的读取链。
- 从 updateName 到版本写入、正常事务提交、事件派发、异步失效的写入链。
- 确认现有 TTL/MDC 传播实现；确认当前 VO 无集合字段，替换泛泛的风险推测。
- 同版本 Guava 的 4 个真实机制实验及输出，含失效后旧加载回填与代次隔离对照。
- 候选方案的提交时机、预热、代次回收、多节点和旧读请求限制。

## 证据入口

下列路径相对于 `D:/workspace/shareetech/SE-MBSE`。行号定位相应符号；校验值来自本次实际文件。

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/AbstractVersionedCacheManager.java:36`
  - 符号：`buildCacheKey`
  - SHA-256：`6e86910ae7691cc8caf4be73bc053591aaacc4efea4aab75d3e402a989590897`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/ElementCacheManager.java:337`
  - 符号：`private ElementCacheVO buildEntry`
  - SHA-256：`bbe036bc9e2761f8dba416c9276cf3fe33f7fa32f71fd52d060e7f9aa3a3339e`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/cache/manager/ProjectCachePreloader.java:79`
  - 符号：`public void preload()`
  - SHA-256：`fa532884556c2223c9bb7340e15fd5a3d7c95ee7df5da16cfd652110a5015e98`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/config/MetaVersionMapper.java:351`
  - 符号：`default T selectCacheByDataId(Long dataId, Long projectId)`
  - SHA-256：`c92dd9519db56bc62ca7f4348d40612e8f84cf7ed4f6416a787350e3ee0bab6b`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/utils/IgniteVersionTemplate.java:729`
  - 符号：`public static boolean versionControlCondition`
  - SHA-256：`8779685dd4eab93368c5a8d2fa51c2efb0a53a3ae6423d7c9d1ed0831fdea2cd`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/management/service/impl/VersionControlServiceImpl.java:361`
  - 符号：`public <T> T executeByProjectId`
  - SHA-256：`3449642dd3378444b744b4b558145a7d352f1014a43fcd50a9d0691004808bb8`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/service/impl/ElementServiceImpl.java:430`
  - 符号：`public void updateName`
  - SHA-256：`04d19c2d8b7b5ace885eee623d24a440b4e73d8332616c95fc00028459306eb7`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/event/ElementChangeEventHandler.java:145`
  - 符号：`public void handleElementDeleteChange`
  - SHA-256：`0f89a5be97cfb8ca8d793a5b7f8c32dcdb708d280109c51a24735a330ded5aa4`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/vo/accessory/ElementCacheVO.java:17`
  - 符号：`public class ElementCacheVO`
  - SHA-256：`7c5d2ce44ab6a5e8c1195a07f93e920cf7eb50d4d826fcacd711c5eb6a6fe1eb`

- `server/mbse-platform-project/mbse-platform-project-service/src/main/java/com/shareetech/mbse/platform/project/metamodel/vo/accessory/BriefVO.java:19`
  - 符号：`public class BriefVO`
  - SHA-256：`5e559524f341e0272fdb6a8af1cbaf509612cb3f18639c3a0be6e5a1e21741e8`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/transaction/IgniteTransactionTemplate.java:82`
  - 符号：`public <T> T execute`
  - SHA-256：`3fcadd75034ecac0425cc9c658ee92e788453577dd12435c1f18fb33dda64f26`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/transaction/IgniteTransactionAspect.java:41`
  - 符号：`public Object around`
  - SHA-256：`7e100470ce1a7c91eb33f119ba7b54f3cf58f3e20d1d039c1d399c19d135cc05`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/transaction/IgniteTransactionContext.java:55`
  - 符号：`public static void publishVersionTableChangeEvents`
  - SHA-256：`fb5bff55c5ce99ceb7495c0518e04b026b9a228ad663bb0a580d7b916b825ba4`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeListener.java:52`
  - 符号：`boolean async()`
  - SHA-256：`1f745347bf27bd4498b6d55605982bd8ecc59fdec43e58828973f1886a4b6dd3`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/ignite/event/VersionTableChangeEventPublisher.java:110`
  - 符号：`private void processAsyncEvent`
  - SHA-256：`e3e2433eea8934454d0c939456556a9c9c97068f8c1b368690b0a2fb5ed63144`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/version/VersionControlContext.java:38`
  - 符号：`private static final TransmittableThreadLocal`
  - SHA-256：`4a30ca39c53aaa42dc8e983d2acc5c70cbbace73d438a84440ef09b84f6ff1e7`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/config/ThreadExecutorConfig.java:69`
  - 符号：`public ExecutorService eventExecutor`
  - SHA-256：`5bc92314817d1393936bab87e1b87fcfc7c55c70ae7b2ec8c0252a67c97a8201`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/config/ContextTaskDecorator.java:15`
  - 符号：`public Runnable decorate`
  - SHA-256：`61d9be1bf114da4682821a4c9783eca3f99f5ac1c78cb179dc1b9bc6dedb4fcd`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/config/ContextPropagatingExecutorService.java:49`
  - 符号：`public void execute`
  - SHA-256：`45e19bd5ac3357c6efc9ae71943fc3630fbf15f286b910d2512898fe2db571cf`

- `server/mbse-platform-core/src/main/java/com/shareetech/mbse/platform/core/util/BeanCopierUtils.java:72`
  - 符号：`public static <T> T copyProperties(Object source, Class<T> targetClass,`
  - SHA-256：`2e32d40fcf7d0e62ac9689fdcb4dad704a46416b96adb3c4c909299ad885ce19`

## 实验边界

[Java 源码](../public/examples/version-cache/CacheConsistencyLab.java)、[运行说明](../public/examples/version-cache/README.md)、[实测输出](../public/examples/version-cache/expected-output.txt)。

实测环境为 Microsoft OpenJDK 21.0.7、Guava 33.4.8-jre。实验用真实 LoadingCache，用 AtomicReference 模拟下层数据源，用带超时的 CountDownLatch 固定顺序。没有执行真实 Mapper、Spring 事件链或 Ignite 事务；没有将模拟结果冒充项目事故或性能测量。未改动 SE-MBSE 源码。
