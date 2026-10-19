package fu.tripsense.contextservice.config;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.contextservice.support.LocalCacheTestServer;
import java.io.*;
import java.net.*;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.core.StringRedisTemplate;

/** Simulates slow activation without using cloud credentials or a shared Redis. */
@EnabledIfSystemProperty(named = "context.cache.integration", matches = "true")
class RedisActivationTimeoutIntegrationTest {
  @Test
  void delayedActivationSucceedsButOrdinaryCommandStillTimesOutAtShortBudget() throws Exception {
    try (var server = LocalCacheTestServer.redis();
        var proxy = new DelayedProxy(server.port)) {
      var props = new PreferenceCacheProperties();
      props.setRedisUrl("redis://127.0.0.1:" + proxy.listener.getLocalPort());
      props.setConnectTimeout(Duration.ofMillis(800));
      props.setCommandTimeout(Duration.ofMillis(100));
      var factory = new PreferenceCacheConfig().contextCacheConnectionFactory(props);
      factory.afterPropertiesSet();
      factory.start();
      try {
        var redis = new StringRedisTemplate(factory);
        long started = System.nanoTime();
        redis.opsForValue().set("test-only", "value");
        assertThat(Duration.ofNanos(System.nanoTime() - started))
            .isGreaterThan(Duration.ofMillis(200));
        assertThat(redis.opsForValue().get("test-only")).isEqualTo("value");
        proxy.delayNextReply.set(true);
        assertThatThrownBy(() -> redis.opsForValue().get("test-only"))
            .isInstanceOf(org.springframework.dao.QueryTimeoutException.class);
      } finally {
        factory.destroy();
      }
    }
  }

  private static final class DelayedProxy implements AutoCloseable {
    private final ServerSocket listener = new ServerSocket(0, 8, InetAddress.getLoopbackAddress());
    private final ExecutorService workers = Executors.newFixedThreadPool(4);
    private final List<Socket> sockets = new CopyOnWriteArrayList<>();
    private final AtomicBoolean delayNextReply = new AtomicBoolean();
    private final Thread accept;

    DelayedProxy(int upstreamPort) throws IOException {
      accept =
          new Thread(
              () -> {
                while (!listener.isClosed()) {
                  try {
                    Socket downstream = listener.accept();
                    sockets.add(downstream);
                    Socket upstream = new Socket(InetAddress.getLoopbackAddress(), upstreamPort);
                    sockets.add(upstream);
                    workers.submit(() -> relay(downstream, upstream, false));
                    workers.submit(() -> relay(upstream, downstream, true));
                  } catch (IOException | RejectedExecutionException stopped) {
                    break;
                  }
                }
              },
              "test-redis-proxy");
      accept.setDaemon(true);
      accept.start();
    }

    private void relay(Socket source, Socket target, boolean replies) {
      boolean first = true;
      try {
        byte[] bytes = new byte[8192];
        int count;
        while ((count = source.getInputStream().read(bytes)) != -1) {
          if (replies && (first || delayNextReply.getAndSet(false))) Thread.sleep(250);
          first = false;
          target.getOutputStream().write(bytes, 0, count);
          target.getOutputStream().flush();
        }
      } catch (IOException stopped) {
        /* fixture shutdown */
      } catch (InterruptedException stopped) {
        Thread.currentThread().interrupt();
      }
    }

    @Override
    public void close() throws Exception {
      listener.close();
      for (var socket : sockets) socket.close();
      workers.shutdownNow();
      assertThat(workers.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
      accept.join(2000);
    }
  }
}
