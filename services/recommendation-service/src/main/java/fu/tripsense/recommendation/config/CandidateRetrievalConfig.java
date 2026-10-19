package fu.tripsense.recommendation.config;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CandidateRetrievalConfig {
  @Bean(destroyMethod = "shutdownNow")
  ThreadPoolExecutor candidateRetrievalExecutor() {
    AtomicInteger sequence = new AtomicInteger();
    return new ThreadPoolExecutor(
        4,
        4,
        0,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(32),
        task -> {
          Thread worker = new Thread(task, "candidate-retrieval-" + sequence.incrementAndGet());
          worker.setDaemon(true);
          return worker;
        },
        new ThreadPoolExecutor.AbortPolicy());
  }
}
