package fu.tripsense.placeservice.config;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class PlaceMediaExecutionConfig {
  @Bean(destroyMethod = "shutdownNow")
  public ThreadPoolExecutor placeMediaJobExecutor() {
    return executor(1, 8, "place-media-job-");
  }

  @Bean(destroyMethod = "shutdownNow")
  public ThreadPoolExecutor placeMediaWorkerExecutor() {
    return executor(3, 6, "place-media-worker-");
  }

  private ThreadPoolExecutor executor(int threads, int queueSize, String threadPrefix) {
    AtomicInteger sequence = new AtomicInteger();
    return new ThreadPoolExecutor(
        threads,
        threads,
        0,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(queueSize),
        task -> {
          Thread worker = new Thread(task, threadPrefix + sequence.incrementAndGet());
          worker.setDaemon(true);
          return worker;
        },
        new ThreadPoolExecutor.AbortPolicy());
  }
}
