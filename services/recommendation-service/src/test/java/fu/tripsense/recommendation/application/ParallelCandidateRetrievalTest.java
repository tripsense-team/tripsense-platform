package fu.tripsense.recommendation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.*;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ParallelCandidateRetrievalTest {
  private final ExecutorService pool = Executors.newFixedThreadPool(2);
  private final RecommendationProperties properties = new RecommendationProperties();
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @AfterEach
  void stop() throws Exception {
    pool.shutdownNow();
    assertThat(pool.awaitTermination(2, TimeUnit.SECONDS)).isTrue();
    RequestDiagnostics.finish(200);
    registry.close();
  }

  private RecommendationContext context() {
    return new RecommendationContext(
            UUID.randomUUID(),
            UUID.randomUUID(),
            null,
            "session",
            "cafe",
            null,
            null,
            Set.of(),
            Set.of(),
            null,
            null,
            48)
        .withParallelRetrieval(true)
        .withExternalRefresh(false);
  }

  private CandidateGenerationResult result(CandidateSource source) {
    return new CandidateGenerationResult(
        source, List.of(new Candidate("p", source, 1, 0.8, null, null)), List.of());
  }

  private CandidateGenerator generator(
      CandidateSource source,
      Function<RecommendationContext, CandidateGenerationResult> operation) {
    return new CandidateGenerator() {
      public CandidateSource source() {
        return source;
      }

      public boolean optional() {
        return source == CandidateSource.SEMANTIC;
      }

      public CandidateGenerationResult generate(RecommendationContext context) {
        return operation.apply(context);
      }
    };
  }

  private CandidateRetrievalPipeline pipeline(List<CandidateGenerator> sources) {
    return new CandidateRetrievalPipeline(sources, pool, properties);
  }

  @Test
  void bothSourcesStartBeforeEitherFinishesAndKeepSourceOrderAndRequestId() {
    RequestDiagnostics.begin("recommendation-service", "parallel-request", registry);
    CountDownLatch entered = new CountDownLatch(2);
    var sources =
        List.of(CandidateSource.PLACE_RETRIEVAL, CandidateSource.SEMANTIC).stream()
            .map(
                source ->
                    generator(
                        source,
                        context -> {
                          entered.countDown();
                          try {
                            assertThat(entered.await(1, TimeUnit.SECONDS)).isTrue();
                          } catch (InterruptedException failure) {
                            throw new IllegalStateException(failure);
                          }
                          assertThat(context.allowExternalRefresh()).isFalse();
                          assertThat(RequestDiagnostics.requestId()).isEqualTo("parallel-request");
                          return result(source);
                        }))
            .toList();
    var output = pipeline(sources).retrieve(context());
    assertThat(output.degradations()).isEmpty();
    assertThat(output.sources())
        .extracting(CandidateGenerationResult::source)
        .containsExactly(CandidateSource.PLACE_RETRIEVAL, CandidateSource.SEMANTIC);
    assertThat(RequestDiagnostics.requestId()).isEqualTo("parallel-request");
  }

  @Test
  void timedOutPlaceDoesNotDiscardCompletedSemanticAndIsCancelled() throws Exception {
    properties.getRetrieval().setParallelTimeout(Duration.ofMillis(200));
    CountDownLatch semanticDone = new CountDownLatch(1);
    CountDownLatch cancelled = new CountDownLatch(1);
    var slow =
        generator(
            CandidateSource.PLACE_RETRIEVAL,
            context -> {
              try {
                semanticDone.await();
                new CountDownLatch(1).await();
              } catch (InterruptedException expected) {
                cancelled.countDown();
              }
              return result(CandidateSource.PLACE_RETRIEVAL);
            });
    var fast =
        generator(
            CandidateSource.SEMANTIC,
            context -> {
              semanticDone.countDown();
              return result(CandidateSource.SEMANTIC);
            });
    var output = pipeline(List.of(slow, fast)).retrieve(context());
    assertThat(output.sources())
        .extracting(CandidateGenerationResult::source)
        .containsExactly(CandidateSource.SEMANTIC);
    assertThat(output.degradations()).containsExactly("PLACE_RETRIEVAL_TIMEOUT");
    assertThat(cancelled.await(1, TimeUnit.SECONDS)).isTrue();
  }

  @Test
  void failedPlaceRetainsSemanticAndAllFailuresAllowExplicitFallback() {
    var failed =
        generator(
            CandidateSource.PLACE_RETRIEVAL,
            context -> {
              throw new IllegalStateException();
            });
    assertThat(
            pipeline(
                    List.of(
                        failed,
                        generator(CandidateSource.SEMANTIC, c -> result(CandidateSource.SEMANTIC))))
                .retrieve(context())
                .sources())
        .hasSize(1);
    assertThat(pipeline(List.of(failed)).retrieve(context()).degradations())
        .containsExactly("PLACE_RETRIEVAL_UNAVAILABLE");
  }

  @Test
  void rejectedExecutorDegradesWithoutRunningOnCaller() {
    pool.shutdown();
    AtomicBoolean ran = new AtomicBoolean();
    var output =
        pipeline(
                List.of(
                    generator(
                        CandidateSource.PLACE_RETRIEVAL,
                        c -> {
                          ran.set(true);
                          return result(CandidateSource.PLACE_RETRIEVAL);
                        })))
            .retrieve(context());
    assertThat(ran).isFalse();
    assertThat(output.degradations()).containsExactly("PLACE_RETRIEVAL_REJECTED");
  }

  @Test
  void diagnosticWrapperRestoresWorkerStateAfterSuccessAndException() throws Exception {
    RequestDiagnostics.begin("test", "captured-request", registry);
    var captured = RequestDiagnostics.wrap(() -> RequestDiagnostics.requestId());
    RequestDiagnostics.finish(200);
    assertThat(pool.submit(captured).get()).isEqualTo("captured-request");
    assertThat(pool.submit(() -> RequestDiagnostics.requestId()).get()).isNull();
    RequestDiagnostics.begin("test", "failing-request", registry);
    var failed =
        RequestDiagnostics.wrap(
            () -> {
              throw new IllegalStateException();
            });
    assertThatThrownBy(() -> pool.submit(failed).get()).isInstanceOf(ExecutionException.class);
    assertThat(pool.submit(() -> RequestDiagnostics.requestId()).get()).isNull();
  }

  @Test
  void supplementRunsOnlyPlaceAndExplicitlyEnablesRefresh() {
    var place =
        generator(
            CandidateSource.PLACE_RETRIEVAL,
            c -> {
              assertThat(c.allowExternalRefresh()).isTrue();
              assertThat(c.parallelRetrieval()).isFalse();
              return result(CandidateSource.PLACE_RETRIEVAL);
            });
    var semantic =
        generator(
            CandidateSource.SEMANTIC,
            c -> {
              throw new AssertionError("must not rerun semantic");
            });
    assertThat(pipeline(List.of(place, semantic)).retrievePlace(context()).sources()).hasSize(1);
  }

  @Test
  void legacyContextStillUsesSequentialProviderBehavior() {
    var firstFinished = new AtomicBoolean();
    var place =
        generator(
            CandidateSource.PLACE_RETRIEVAL,
            c -> {
              assertThat(c.allowExternalRefresh()).isTrue();
              firstFinished.set(true);
              return result(CandidateSource.PLACE_RETRIEVAL);
            });
    var semantic =
        generator(
            CandidateSource.SEMANTIC,
            c -> {
              assertThat(firstFinished).isTrue();
              return result(CandidateSource.SEMANTIC);
            });
    var legacy = context().withParallelRetrieval(false).withExternalRefresh(true);
    assertThat(pipeline(List.of(place, semantic)).retrieve(legacy).sources()).hasSize(2);
  }

  @Test
  void invalidParallelTimeoutFailsBeforeWorkIsSubmitted() {
    properties.getRetrieval().setParallelTimeout(Duration.ZERO);
    assertThatThrownBy(() -> pipeline(List.of())).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void interruptedCallerDoesNotSubmitWorkOrEnableProvider() {
    AtomicBoolean ran = new AtomicBoolean();
    var pipeline =
        pipeline(
            List.of(
                generator(
                    CandidateSource.PLACE_RETRIEVAL,
                    c -> {
                      ran.set(true);
                      return result(CandidateSource.PLACE_RETRIEVAL);
                    })));
    Thread.currentThread().interrupt();
    try {
      assertThat(pipeline.retrieve(context()).degradations())
          .containsExactly("PLACE_RETRIEVAL_INTERRUPTED");
      assertThat(Thread.currentThread().isInterrupted()).isTrue();
      assertThat(ran).isFalse();
    } finally {
      Thread.interrupted();
    }
  }
}
