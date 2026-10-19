package fu.tripsense.recommendation.application;

import fu.tripsense.recommendation.application.port.CandidateGenerationResult;
import fu.tripsense.recommendation.application.port.CandidateGenerator;
import fu.tripsense.recommendation.config.RecommendationProperties;
import fu.tripsense.recommendation.domain.CandidateSource;
import fu.tripsense.recommendation.domain.RecommendationContext;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CandidateRetrievalPipeline {
  private final List<CandidateGenerator> generators;
  private final ExecutorService executor;
  private final Duration parallelTimeout;

  public CandidateRetrievalPipeline(List<CandidateGenerator> generators) {
    this(generators, null, new RecommendationProperties());
  }

  @Autowired
  public CandidateRetrievalPipeline(
      List<CandidateGenerator> generators,
      @Qualifier("candidateRetrievalExecutor") ExecutorService executor,
      RecommendationProperties properties) {
    this.generators = List.copyOf(generators);
    this.executor = executor;
    this.parallelTimeout = properties.getRetrieval().getParallelTimeout();
    if (parallelTimeout == null || parallelTimeout.isZero() || parallelTimeout.isNegative())
      throw new IllegalArgumentException("Parallel retrieval timeout must be positive");
  }

  public RetrievalOutcome retrieve(RecommendationContext context) {
    if (context.parallelRetrieval() && executor != null) return retrieveParallel(context);
    return retrieveSequential(context, generators);
  }

  public RetrievalOutcome retrievePlace(RecommendationContext context) {
    return retrieveSequential(
        context.withExternalRefresh(true).withParallelRetrieval(false),
        generators.stream().filter(g -> g.source() == CandidateSource.PLACE_RETRIEVAL).toList());
  }

  private CandidateGenerationResult generate(
      CandidateGenerator generator, RecommendationContext context) {
    return RequestDiagnostics.measure(
        "source_" + generator.source().name().toLowerCase(java.util.Locale.ROOT),
        () -> java.util.Objects.requireNonNull(generator.generate(context)));
  }

  private RetrievalOutcome retrieveParallel(RecommendationContext context) {
    RequestDiagnostics.mark("retrieval_parallel", true);
    if (Thread.currentThread().isInterrupted())
      return new RetrievalOutcome(
          List.of(), generators.stream().map(g -> g.source() + "_INTERRUPTED").toList());
    long deadline = System.nanoTime() + parallelTimeout.toNanos();
    Map<CandidateGenerator, Future<CandidateGenerationResult>> pending = new LinkedHashMap<>();
    List<CandidateGenerationResult> results = new ArrayList<>();
    List<String> degradations = new ArrayList<>();
    boolean interrupted = false;
    try {
      for (CandidateGenerator generator : generators) {
        try {
          pending.put(
              generator,
              executor.submit(
                  RequestDiagnostics.wrap(
                      () -> generate(generator, context.withExternalRefresh(false)))));
        } catch (RejectedExecutionException rejected) {
          degradations.add(generator.source() + "_REJECTED");
        }
      }
      // Source order stays deterministic even when completion order differs.
      for (var entry : pending.entrySet()) {
        var generator = entry.getKey();
        var future = entry.getValue();
        if (interrupted && !future.isDone()) {
          degradations.add(generator.source() + "_INTERRUPTED");
          future.cancel(true);
          continue;
        }
        try {
          CandidateGenerationResult result =
              future.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
          results.add(result);
          degradations.addAll(result.degradations());
        } catch (TimeoutException timeout) {
          degradations.add(generator.source() + "_TIMEOUT");
          future.cancel(true);
        } catch (InterruptedException interruption) {
          interrupted = true;
          degradations.add(generator.source() + "_INTERRUPTED");
          future.cancel(true);
        } catch (ExecutionException | CancellationException failure) {
          degradations.add(generator.source() + "_UNAVAILABLE");
          log.warn(
              "candidate_generator_unavailable source={} optional={} errorType={}",
              generator.source(),
              generator.optional(),
              failure.getClass().getSimpleName());
        }
      }
      // Local failure/empty output may still be recovered by the explicit provider/LKG policy.
      return new RetrievalOutcome(List.copyOf(results), degradations.stream().distinct().toList());
    } finally {
      pending
          .values()
          .forEach(
              future -> {
                if (!future.isDone()) future.cancel(true);
              });
      if (executor instanceof ThreadPoolExecutor pool) pool.purge();
      if (interrupted) Thread.currentThread().interrupt();
    }
  }

  private RetrievalOutcome retrieveSequential(
      RecommendationContext context, List<CandidateGenerator> selected) {
    List<CandidateGenerationResult> results = new ArrayList<>();
    List<String> degradations = new ArrayList<>();
    RuntimeException requiredFailure = null;
    for (CandidateGenerator generator : selected) {
      try {
        CandidateGenerationResult result = generate(generator, context);
        results.add(result);
        degradations.addAll(result.degradations());
      } catch (RuntimeException exception) {
        degradations.add(generator.source() + "_UNAVAILABLE");
        log.warn(
            "candidate_generator_unavailable source={} optional={} errorType={}",
            generator.source(),
            generator.optional(),
            exception.getClass().getSimpleName());
        if (!generator.optional()) requiredFailure = exception;
      }
    }
    boolean hasCandidates = results.stream().anyMatch(result -> !result.candidates().isEmpty());
    if (!hasCandidates && requiredFailure != null) {
      throw new CandidateRetrievalUnavailableException(requiredFailure);
    }
    return new RetrievalOutcome(results, degradations.stream().distinct().toList());
  }

  public record RetrievalOutcome(
      List<CandidateGenerationResult> sources, List<String> degradations) {}
}
