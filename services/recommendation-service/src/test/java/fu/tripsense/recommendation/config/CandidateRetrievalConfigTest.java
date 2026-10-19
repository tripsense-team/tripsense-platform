package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.assertThat;

import fu.tripsense.recommendation.application.CandidateRetrievalPipeline;
import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadPoolExecutor;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

class CandidateRetrievalConfigTest {
  @Test
  void springOwnsBoundedExecutorAndShutsItDown() {
    ThreadPoolExecutor pool;
    try (var context = new AnnotationConfigApplicationContext(CandidateRetrievalConfig.class)) {
      pool = context.getBean("candidateRetrievalExecutor", ThreadPoolExecutor.class);
      assertThat(pool.getCorePoolSize()).isEqualTo(4);
      assertThat(pool.getMaximumPoolSize()).isEqualTo(4);
      assertThat(pool.getQueue().remainingCapacity()).isEqualTo(32);
      assertThat(pool.getRejectedExecutionHandler())
          .isInstanceOf(ThreadPoolExecutor.AbortPolicy.class);
      assertThat(pool.isShutdown()).isFalse();
    }
    assertThat(pool.isShutdown()).isTrue();
  }

  @Test
  void springInjectsQualifiedExecutorDespiteLegacyConstructor() {
    try (var context = new AnnotationConfigApplicationContext()) {
      context.register(CandidateRetrievalConfig.class, CandidateRetrievalPipeline.class);
      context.registerBean(RecommendationProperties.class, RecommendationProperties::new);
      context.registerBean(
          CandidateGenerator.class,
          () ->
              new CandidateGenerator() {
                public CandidateSource source() {
                  return CandidateSource.PLACE_RETRIEVAL;
                }

                public boolean optional() {
                  return false;
                }

                public CandidateGenerationResult generate(RecommendationContext input) {
                  assertThat(Thread.currentThread().getName()).startsWith("candidate-retrieval-");
                  assertThat(input.allowExternalRefresh()).isFalse();
                  return new CandidateGenerationResult(source(), List.of(), List.of());
                }
              });
      context.refresh();
      var input =
          new RecommendationContext(
                  UUID.randomUUID(),
                  UUID.randomUUID(),
                  null,
                  "session",
                  "query",
                  null,
                  null,
                  Set.of(),
                  Set.of(),
                  null,
                  null,
                  48)
              .withParallelRetrieval(true);
      var outcome = context.getBean(CandidateRetrievalPipeline.class).retrieve(input);
      assertThat(outcome.degradations()).isEmpty();
      assertThat(outcome.sources()).hasSize(1);
    }
  }
}
