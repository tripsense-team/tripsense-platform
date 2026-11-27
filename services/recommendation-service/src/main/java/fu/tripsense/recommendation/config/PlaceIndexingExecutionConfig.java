package fu.tripsense.recommendation.config;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PlaceIndexingExecutionConfig {
  @Bean(destroyMethod = "shutdownNow")
  ThreadPoolExecutor placeIndexingExecutor() {
    AtomicInteger sequence = new AtomicInteger();
    return new ThreadPoolExecutor(
        2,
        2,
        0,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(100),
        task -> {
          Thread worker = new Thread(task, "place-indexing-" + sequence.incrementAndGet());
          worker.setDaemon(true);
          return worker;
        },
        new ThreadPoolExecutor.AbortPolicy());
  }
}
