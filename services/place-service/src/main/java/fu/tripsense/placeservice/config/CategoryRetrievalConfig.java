package fu.tripsense.placeservice.config;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CategoryRetrievalConfig {
  @Bean(destroyMethod = "shutdownNow")
  public ThreadPoolExecutor categoryCacheReadExecutor() {
    return cacheExecutor(4, "category-cache-read-");
  }

  @Bean(destroyMethod = "shutdownNow")
  public ThreadPoolExecutor categoryCacheWriteExecutor() {
    return cacheExecutor(2, "category-cache-write-");
  }

  private ThreadPoolExecutor cacheExecutor(int workers, String prefix) {
    AtomicInteger sequence = new AtomicInteger();
    return new ThreadPoolExecutor(
        workers,
        workers,
        0,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(16),
        task -> {
          Thread worker = new Thread(task, prefix + sequence.incrementAndGet());
          worker.setDaemon(true);
          return worker;
        },
        new ThreadPoolExecutor.AbortPolicy());
  }

  @Bean(destroyMethod = "shutdownNow")
  public ThreadPoolExecutor categoryRetrievalExecutor() {
    AtomicInteger sequence = new AtomicInteger();
    return new ThreadPoolExecutor(
        8,
        8,
        0,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(16),
        task -> {
          Thread worker = new Thread(task, "place-category-" + sequence.incrementAndGet());
          worker.setDaemon(true);
          return worker;
        },
        new ThreadPoolExecutor.AbortPolicy());
  }
}
