package fu.tripsense.recommendation.application;

import com.google.common.util.concurrent.Striped;
import fu.tripsense.recommendation.application.port.*;
import fu.tripsense.recommendation.config.*;
import fu.tripsense.recommendation.domain.*;
import fu.tripsense.recommendation.security.AuthenticatedUser;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.Lock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/** One shared preview preparation, with lazy category-only supplementation. */
@Service
public class SectionFeedService {
  private final RecommendationApplicationService recommendations;
  private final CategoryCandidateSource place;
  private final List<CandidateGenerator> generators;
  private final PlaceSnapshotResolver snapshots;
  private final ExecutorService executor;
  private final SectionFeedCache cache;
  private final ExploreRecommendationCache profiles;
  private final RecommendationProperties properties;
  private final SectionFeedProperties settings;
  private final Striped<Lock> locks = Striped.lock(128);

  public SectionFeedService(
      RecommendationApplicationService recommendations,
      CategoryCandidateSource place,
      List<CandidateGenerator> generators,
      PlaceSnapshotResolver snapshots,
      @Qualifier("candidateRetrievalExecutor") ExecutorService executor,
      SectionFeedCache cache,
      ExploreRecommendationCache profiles,
      RecommendationProperties properties,
      SectionFeedProperties settings) {
    this.recommendations = recommendations;
    this.place = place;
    this.generators = generators;
    this.snapshots = snapshots;
    this.executor = executor;
    this.cache = cache;
    this.profiles = profiles;
    this.properties = properties;
    this.settings = settings;
  }

  public SectionFeedResult recommend(
      AuthenticatedUser user, String token, SectionFeedCommand request) {
    RequestDiagnostics.checkpoint("request_to_feed_ms");
    var destination = properties.getExplore().getDestinations().get(request.destinationId());
    if (destination == null) throw new InvalidDestinationException();
    var categories =
        request.section() == null ? DiscoveryCategory.preview() : List.of(request.section());
    RequestDiagnostics.mark("feed_view", request.section() == null ? "preview" : "category");
    RequestDiagnostics.mark("profile_load_count", 1);
    RequestDiagnostics.checkpoint("request_to_profile_ms");
    var context =
        RequestDiagnostics.measure(
                "resolve_context",
                () ->
                    recommendations.resolveContext(command(user.id(), token, request, destination)))
            .withExternalRefresh(false);
    String destinationScope =
        cache.scope(
            user.id(),
            request.destinationId() + "|" + context.anchor() + "|" + context.radiusMeters());
    // Validate owner even before the response-cache lookup. A cache hit must not bypass anti-IDOR.
    var seed =
        cache
            .seed(user.id(), request.seedId())
            .filter(s -> s.destinationScope().equals(destinationScope));
    String fingerprint = profiles.profileFingerprint(context.profile());
    String key =
        cache.scope(
            user.id(),
            destinationScope
                + "|"
                + request.section()
                + "|"
                + request.effectiveLimit()
                + "|"
                + fingerprint
                + "|"
                + seed.map(s -> s.id().toString()).orElse(""));
    Lock lock = locks.get(key);
    boolean acquired = false;
    try {
      acquired =
          lock.tryLock(settings.getRetrievalTimeout().toMillis() + 500, TimeUnit.MILLISECONDS);
      if (!acquired) throw unavailable();
      var hit = RequestDiagnostics.measure("cache_fresh_get", () -> cache.response(key, false));
      RequestDiagnostics.mark("cache_hit", hit.isPresent());
      if (hit.isPresent()) {
        RequestDiagnostics.mark("semantic_call_count", 0);
        RequestDiagnostics.mark("place_batch_call_count", 0);
        return hit.get();
      }
      try {
        return build(user, request, context, categories, seed.orElse(null), key, destinationScope);
      } catch (CandidateRetrievalUnavailableException failure) {
        return cache
            .response(key, true)
            .map(
                r ->
                    new SectionFeedResult(
                        r.seedId(),
                        r.expiresAt(),
                        r.seedReused(),
                        r.previewOrderPreserved(),
                        r.destinationId(),
                        r.resultMode(),
                        r.personalization(),
                        true,
                        r.recommendation(),
                        r.sections()))
            .orElseThrow(() -> failure);
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw unavailable();
    } finally {
      if (acquired) lock.unlock();
    }
  }

  private SectionFeedResult build(
      AuthenticatedUser user,
      SectionFeedCommand request,
      RecommendationContext context,
      List<DiscoveryCategory> categories,
      SectionFeedCache.Seed seed,
      String key,
      String destinationScope) {
    long deadline = System.nanoTime() + settings.getRetrievalTimeout().toNanos();
    boolean reuse = seed != null;
    // A successful semantic seed includes empty success; failure is never reused as an empty
    // success.
    RequestDiagnostics.mark("seed_reused", reuse);
    var futures = new ArrayList<Future<?>>();
    var retrievalTimer = RequestDiagnostics.start("retrieval");
    Hydrated seedData = null;
    Hydrated hydrated = null;
    CategoryCandidateSource.Batch batch = null;
    try {
      if (seed != null) {
        var hydration = submit(RequestDiagnostics.wrap(() -> hydrate(context, seed, true)));
        futures.add(hydration);
        seedData = await(hydration, deadline);
      }
      boolean reuseSemantic = seedData != null && seed.semanticSucceeded();
      boolean needsLocal =
          request.section() == null
              || seedData == null
              || recommendations.eligibleSectionSeed(context, seedData.candidates()).stream()
                      .filter(c -> request.section().matches(c.place()))
                      .map(FusedCandidate::placeId)
                      .distinct()
                      .count()
                  < request.effectiveLimit();
      RequestDiagnostics.mark(
          "semantic_call_count",
          reuseSemantic
              ? 0
              : generators.stream().anyMatch(g -> g.source() == CandidateSource.SEMANTIC) ? 1 : 0);
      RequestDiagnostics.mark("place_batch_call_count", needsLocal ? 1 : 0);
      RequestDiagnostics.mark("category_topup", request.section() != null && needsLocal);
      Future<Hydrated> semantic =
          reuseSemantic
              ? CompletableFuture.completedFuture(new Hydrated(List.of(), true))
              : submit(RequestDiagnostics.wrap(() -> hydrate(context, null, false)));
      futures.add(semantic);
      Future<CategoryCandidateSource.Batch> local =
          needsLocal
              ? submit(
                  RequestDiagnostics.wrap(
                      () ->
                          RequestDiagnostics.measure(
                              "source_place_categories",
                              () ->
                                  place.generateCategories(
                                      context,
                                      categories,
                                      request.section() == null
                                          ? settings.getPreviewCandidatesPerCategory()
                                          : 50))))
              : CompletableFuture.completedFuture(
                  new CategoryCandidateSource.Batch(
                      categories.stream()
                          .map(
                              c ->
                                  new CategoryCandidateSource.Group(
                                      c, "READY", List.of(), List.of()))
                          .toList()));
      futures.add(local);
      hydrated = await(semantic, deadline);
      batch = await(local, deadline);
    } finally {
      futures.forEach(
          f -> {
            if (!f.isDone()) f.cancel(true);
          });
      if (executor instanceof ThreadPoolExecutor pool) pool.purge();
      RequestDiagnostics.mark("retrieval_deadline_exceeded", System.nanoTime() >= deadline);
      retrievalTimer.finish(false);
    }
    boolean semanticOk = hydrated != null && hydrated.semanticSucceeded();
    Map<DiscoveryCategory, Boolean> localOk = new EnumMap<>(DiscoveryCategory.class);
    List<Candidate> candidates = new ArrayList<>();
    if (seedData != null) candidates.addAll(seedData.candidates());
    if (hydrated != null) candidates.addAll(hydrated.candidates());
    for (var category : categories) {
      var group =
          batch == null
              ? null
              : batch.groups().stream()
                  .filter(g -> g.category() == category)
                  .findFirst()
                  .orElse(null);
      boolean ok =
          group != null && ("READY".equals(group.status()) || "EMPTY".equals(group.status()));
      localOk.put(category, ok);
      if (ok) candidates.addAll(group.candidates());
    }
    if ((!semanticOk || generators.stream().noneMatch(g -> g.source() == CandidateSource.SEMANTIC))
        && localOk.values().stream().noneMatch(Boolean::booleanValue)) throw unavailable();
    // Canonical IDs are the deduplication key, not an obsolete Qdrant alias.
    var unique = new LinkedHashMap<String, Candidate>();
    for (var candidate : candidates) {
      var p = candidate.place();
      if (p != null && p.id() != null && !context.profile().negativePlaceIds().contains(p.id()))
        unique.putIfAbsent(
            p.id() + "|" + candidate.source(),
            new Candidate(
                p.id(),
                candidate.source(),
                candidate.sourceRank(),
                candidate.sourceScore(),
                p,
                candidate.retrievalEvidence()));
    }
    List<Candidate> all = new ArrayList<>(unique.values());
    List<CandidateGenerationResult> sources = new ArrayList<>();
    for (var source : CandidateSource.values()) {
      var members = all.stream().filter(c -> c.source() == source).toList();
      if (!members.isEmpty())
        sources.add(new CandidateGenerationResult(source, members, List.of()));
    }
    List<String> degradations = new ArrayList<>();
    if (!semanticOk) degradations.add("SEMANTIC_UNAVAILABLE");
    localOk.forEach(
        (category, ok) -> {
          if (!ok) degradations.add(category + "_LOCAL_UNAVAILABLE");
        });
    String intentScope = intentScope(user.id(), context.profile());
    boolean preserve = seed != null && seed.intentScope().equals(intentScope);
    var prefix = preserve ? seed.previewOrder() : Map.<DiscoveryCategory, List<String>>of();
    var prepared =
        recommendations.prepareSections(
            context,
            new CandidateRetrievalPipeline.RetrievalOutcome(sources, degradations),
            categories,
            request.effectiveLimit(),
            prefix);
    RequestDiagnostics.run("impression_record", () -> recommendations.record(prepared));
    var ranked = prepared.result();
    List<SectionFeedResult.Section> groups = new ArrayList<>();
    Map<DiscoveryCategory, List<String>> order = new EnumMap<>(DiscoveryCategory.class);
    for (var category : categories) {
      var items =
          ranked.items().stream()
              .filter(
                  i ->
                      categories.size() == 1
                          ? category.matches(i.features().place())
                          : DiscoveryCategory.owner(i.features().place()) == category)
              .toList();
      boolean error = items.isEmpty() && !localOk.get(category);
      var reasons = new ArrayList<String>();
      if (!localOk.get(category)) reasons.add("LOCAL_UNAVAILABLE");
      if (!semanticOk) reasons.add("SEMANTIC_UNAVAILABLE");
      groups.add(
          new SectionFeedResult.Section(
              category,
              error ? "ERROR" : items.isEmpty() ? "EMPTY" : "READY",
              reasons,
              items.stream().map(i -> i.features().placeId()).toList()));
      order.put(category, items.stream().limit(4).map(i -> i.features().placeId()).toList());
      RequestDiagnostics.mark("returned_" + category.name().toLowerCase(Locale.ROOT), items.size());
    }
    Instant expiry = Instant.now().plus(settings.getSeedTtl());
    var seedCandidates =
        all.stream()
            .limit(settings.getSeedMaxIds())
            .map(
                c ->
                    new SectionFeedCache.SeedCandidate(
                        c.placeId(),
                        c.source(),
                        c.sourceRank(),
                        c.sourceScore(),
                        c.retrievalEvidence()))
            .toList();
    UUID seedId = UUID.randomUUID();
    var next =
        new SectionFeedCache.Seed(
            seedId,
            cache.scope(user.id(), "owner"),
            destinationScope,
            intentScope,
            expiry,
            semanticOk,
            seedCandidates,
            request.section() == null ? order : seed == null ? order : seed.previewOrder());
    boolean stored = RequestDiagnostics.measure("seed_put", () -> cache.seed(next));
    RequestDiagnostics.mark("seed_stored", stored);
    int signals =
        context
            .profile()
            .personalizationSignalCount(!properties.getProfile().isObservedSignalPolicyV2Enabled());
    boolean personalized =
        context.profile().personalizationEnabled() && context.profile().available() && signals > 0;
    var response =
        new SectionFeedResult(
            stored ? seedId : null,
            expiry,
            reuse,
            preserve,
            request.destinationId(),
            personalized ? "PERSONALIZED" : "GENERIC_DESTINATION",
            new ExploreRecommendationResult.Personalization(
                context.profile().personalizationEnabled(), personalized, signals),
            false,
            ranked,
            groups);
    if (degradations.isEmpty())
      RequestDiagnostics.run("cache_put", () -> cache.response(key, response));
    return response;
  }

  private Hydrated hydrate(
      RecommendationContext context, SectionFeedCache.Seed seed, boolean reuseSemantic) {
    List<Candidate> candidates = new ArrayList<>();
    if (seed != null) {
      var canonical =
          snapshots.resolveLocalBatch(
              seed.candidates().stream()
                  .map(SectionFeedCache.SeedCandidate::id)
                  .distinct()
                  .toList());
      for (var c : seed.candidates()) {
        var p = canonical.get(c.id());
        if (p != null)
          candidates.add(new Candidate(p.id(), c.source(), c.rank(), c.score(), p, c.evidence()));
      }
      RequestDiagnostics.mark("seed_ids_reused", candidates.size());
    }
    boolean ok = reuseSemantic;
    if (!reuseSemantic) {
      var semantic =
          generators.stream().filter(g -> g.source() == CandidateSource.SEMANTIC).findFirst();
      if (semantic.isPresent()) {
        try {
          var result =
              RequestDiagnostics.measure(
                  "source_semantic", () -> semantic.get().generateBounded(context, 50));
          candidates.addAll(result.candidates());
          ok =
              result.degradations().stream()
                  .noneMatch(
                      d ->
                          d.endsWith("_UNAVAILABLE")
                              || d.endsWith("_TIMEOUT")
                              || d.equals("SEMANTIC_PLACE_UNRESOLVED"));
        } catch (RuntimeException failure) {
          ok = false;
        }
      } else ok = true; // Disabled semantic source is not an infrastructure failure.
    }
    return new Hydrated(candidates, ok);
  }

  private String intentScope(UUID user, UserProfileSnapshot p) {
    // Exact affinity comparison is deliberately conservative: unverifiable changes rerank.
    return cache.scope(
        user,
        p.available()
            + "|"
            + p.personalizationEnabled()
            + "|"
            + new TreeSet<>(p.preferredCategories())
            + "|"
            + new TreeSet<>(p.dislikedCategories())
            + "|"
            + new TreeMap<>(p.categoryAffinities())
            + "|"
            + new TreeSet<>(p.savedPlaceIds())
            + "|"
            + new TreeSet<>(p.addedToTripPlaceIds())
            + "|"
            + new TreeSet<>(p.negativePlaceIds()));
  }

  private RecommendationCommand command(
      UUID user, String token, SectionFeedCommand r, RecommendationProperties.Destination d) {
    var criteria =
        List.of(
            criterion(RankingCriterion.Feature.PREFERENCE, RankingCriterion.Importance.HIGH),
            criterion(RankingCriterion.Feature.DISTANCE, RankingCriterion.Importance.MEDIUM),
            criterion(RankingCriterion.Feature.RATING, RankingCriterion.Importance.MEDIUM),
            criterion(RankingCriterion.Feature.POPULARITY, RankingCriterion.Importance.MEDIUM),
            criterion(RankingCriterion.Feature.HISTORY, RankingCriterion.Importance.LOW),
            criterion(
                RankingCriterion.Feature.RETRIEVAL_RELEVANCE, RankingCriterion.Importance.LOW));
    return new RecommendationCommand(
        user,
        token,
        "địa điểm nổi tiếng ở " + d.getName(),
        null,
        r.sessionId(),
        new GeoPoint(d.getLat(), d.getLng()),
        d.getMaximumRadiusMeters(),
        Set.of(),
        Set.of(),
        Set.of(),
        new GeographicScope(d.getName(), d.getName(), null, true),
        criteria,
        48,
        "EXPLORE_RECOMMENDATION");
  }

  private RankingCriterion criterion(
      RankingCriterion.Feature f, RankingCriterion.Importance importance) {
    return new RankingCriterion(
        f,
        f == RankingCriterion.Feature.DISTANCE
            ? RankingCriterion.Direction.MINIMIZE
            : RankingCriterion.Direction.MAXIMIZE,
        importance);
  }

  private CandidateRetrievalUnavailableException unavailable() {
    return new CandidateRetrievalUnavailableException(
        new IllegalStateException("Grouped retrieval unavailable"));
  }

  private <T> Future<T> submit(Callable<T> operation) {
    try {
      return executor.submit(operation);
    } catch (RejectedExecutionException rejected) {
      return CompletableFuture.failedFuture(rejected);
    }
  }

  private <T> T await(Future<T> future, long deadline) {
    try {
      return future.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
    } catch (ExecutionException | TimeoutException | CancellationException failure) {
      future.cancel(true);
      return null;
    } catch (InterruptedException interrupted) {
      future.cancel(true);
      Thread.currentThread().interrupt();
      throw unavailable();
    }
  }

  private record Hydrated(List<Candidate> candidates, boolean semanticSucceeded) {}
}
