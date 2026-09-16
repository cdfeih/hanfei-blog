import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Guava 33.4.8-jre 的独立机制实验；不启动 SE-MBSE、Spring 或 Ignite。
 * OLD/NEW 代表一次模型元素改名前后的名称，不是业务系统实测数据。
 * 用门闩固定线程顺序，不通过 sleep 或随机压力制造结果。
 */
public class CacheConsistencyLab {
    private static final String ELEMENT = "elementCache:2000001:3000001:0:4000001";

    public static void main(String[] args) throws Exception {
        negativeCache();
        asyncInvalidationWindow();
        invalidateDuringLoad();
        generationSeparatesOldLoad();
        System.out.println("PASS: 4 deterministic experiments");
    }

    private static LoadingCache<String, Optional<String>> cache(
            AtomicReference<String> source, AtomicInteger loads) {
        return CacheBuilder.newBuilder().maximumSize(10000)
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .build(new CacheLoader<>() {
                @Override public Optional<String> load(String key) {
                    loads.incrementAndGet();
                    return Optional.ofNullable(source.get());
                }
            });
    }

    private static void negativeCache() {
        var source = new AtomicReference<String>();
        var loads = new AtomicInteger();
        var cache = cache(source, loads);
        equal(Optional.empty(), cache.getUnchecked(ELEMENT));
        source.set("NEW");
        equal(Optional.empty(), cache.getUnchecked(ELEMENT));
        equal(1, loads.get());
        cache.invalidate(ELEMENT);
        equal(Optional.of("NEW"), cache.getUnchecked(ELEMENT));
        equal(2, loads.get());
        System.out.println("negative: empty -> empty -> NEW; loads=2");
    }

    private static void asyncInvalidationWindow() throws Exception {
        var source = new AtomicReference<>("OLD");
        var cache = cache(source, new AtomicInteger());
        equal(Optional.of("OLD"), cache.getUnchecked(ELEMENT));
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            source.set("NEW"); // 模拟底层写入已经提交
            var invalidation = executor.submit(() -> {
                entered.countDown();
                await(release);
                cache.invalidate(ELEMENT);
            });
            await(entered);
            equal(Optional.of("OLD"), cache.getUnchecked(ELEMENT));
            release.countDown();
            invalidation.get(5, TimeUnit.SECONDS);
            equal(Optional.of("NEW"), cache.getUnchecked(ELEMENT));
            System.out.println("async: before-listener=OLD; after-listener=NEW");
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private static void invalidateDuringLoad() throws Exception {
        var source = new AtomicReference<>("OLD");
        var captured = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var loads = new AtomicInteger();
        LoadingCache<String, Optional<String>> cache = CacheBuilder.newBuilder()
            .maximumSize(10000).expireAfterWrite(30, TimeUnit.MINUTES)
            .build(new CacheLoader<>() {
                @Override public Optional<String> load(String key) {
                    String snapshot = source.get();
                    if (loads.incrementAndGet() == 1) {
                        captured.countDown();
                        await(release);
                    }
                    return Optional.ofNullable(snapshot);
                }
            });
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            var reader = executor.submit(() -> cache.getUnchecked(ELEMENT));
            await(captured); // loader 已经读取 OLD，但尚未返回
            source.set("NEW");
            cache.invalidate(ELEMENT); // 失效已经同步执行完
            release.countDown();
            equal(Optional.of("OLD"), reader.get(5, TimeUnit.SECONDS));
            equal(Optional.of("OLD"), cache.getUnchecked(ELEMENT));
            equal(1, loads.get());
            System.out.println("in-flight: source=NEW; cached=OLD; loads=1");
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private record Key(String element, long generation) {}

    private static void generationSeparatesOldLoad() throws Exception {
        var source = new AtomicReference<>("OLD");
        var generation = new AtomicLong();
        var captured = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        LoadingCache<Key, Optional<String>> cache = CacheBuilder.newBuilder()
            .maximumSize(10000).expireAfterWrite(30, TimeUnit.MINUTES)
            .build(new CacheLoader<>() {
                @Override public Optional<String> load(Key key) {
                    String snapshot = source.get();
                    if (key.generation() == 0) {
                        captured.countDown();
                        await(release);
                    }
                    return Optional.ofNullable(snapshot);
                }
            });
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            var oldKey = new Key(ELEMENT, generation.get());
            var reader = executor.submit(() -> cache.getUnchecked(oldKey));
            await(captured);
            source.set("NEW");
            generation.incrementAndGet(); // 模拟提交后同步推进本节点的代次
            release.countDown();
            equal(Optional.of("OLD"), reader.get(5, TimeUnit.SECONDS));
            equal(Optional.of("OLD"), cache.getUnchecked(oldKey));
            equal(Optional.of("NEW"), cache.getUnchecked(new Key(ELEMENT, generation.get())));
            System.out.println("generation: old-reader=OLD; next-reader=NEW");
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("latch timeout");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }

    private static void equal(Object expected, Object actual) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("expected=" + expected + ", actual=" + actual);
        }
    }
}
