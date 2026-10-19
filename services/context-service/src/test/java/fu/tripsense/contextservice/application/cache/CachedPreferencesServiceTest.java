package fu.tripsense.contextservice.application.cache;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.config.PreferenceCacheProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;

class CachedPreferencesServiceTest {
  private final UUID user = UUID.randomUUID();
  private final PreferenceCacheProperties properties = new PreferenceCacheProperties();
  private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
  private final Source source = new Source();
  private final Cache cache = new Cache();

  @Test
  void cachesOnlyOnDemandAndHitStillChecksCurrentRevision() {
    var service = service();
    assertThat(cache.data).isEmpty();
    assertThat(service.preferences(user, "TRIP_PLANNING"))
        .extracting(PreferenceSignal::valueCode)
        .containsExactly("CAFE");
    service.preferences(user, "TRIP_PLANNING");
    assertThat(source.loads.get()).isEqualTo(1);
    assertThat(source.metadata.get()).isEqualTo(2);
    assertThat(cache.data).hasSize(1);
    service.preferences(user, "EXPLORE_RECOMMENDATION");
    service.preferences(UUID.randomUUID(), "TRIP_PLANNING");
    assertThat(cache.data).hasSize(3);
  }

  @Test
  void committedEditDeletionRecreationAndCatalogChangesCannotUseOldKeys() {
    var service = service();
    service.preferences(user, "TRIP_PLANNING");
    source.state.set(snapshot(2, "catalog", "BEACH"));
    assertThat(service.preferences(user, "TRIP_PLANNING"))
        .extracting(PreferenceSignal::valueCode)
        .containsExactly("BEACH");
    source.state.set(
        new PreferenceSnapshot(PreferenceSnapshot.Revision.absent(), "TRIP_PLANNING", List.of()));
    assertThat(service.preferences(user, "TRIP_PLANNING")).isEmpty();
    var recreated =
        new PreferenceSnapshot(
            new PreferenceSnapshot.Revision(UUID.randomUUID(), 1, "COMPLETED", 1, "catalog"),
            "TRIP_PLANNING",
            List.of(signal("LOCAL_FOOD")));
    source.state.set(recreated);
    assertThat(service.preferences(user, "TRIP_PLANNING"))
        .extracting(PreferenceSignal::valueCode)
        .containsExactly("LOCAL_FOOD");
    source.state.set(
        new PreferenceSnapshot(
            new PreferenceSnapshot.Revision(
                recreated.revision().profileId(), 1, "COMPLETED", 1, "reclassified"),
            "TRIP_PLANNING",
            List.of()));
    assertThat(service.preferences(user, "TRIP_PLANNING")).isEmpty();
    assertThat(source.loads.get()).isEqualTo(4);
  }

  @Test
  void disabledCacheLoadsDirectlyAndInvalidPurposeDoesNotReadAnything() {
    cache.enabled = false;
    var service = service();
    service.preferences(user, "TRIP_PLANNING");
    service.preferences(user, "TRIP_PLANNING");
    assertThat(source.loads.get()).isEqualTo(2);
    assertThat(source.metadata.get()).isZero();
    assertThatThrownBy(() -> service.preferences(user, "ALL"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(source.loads.get()).isEqualTo(2);
    assertThat(cache.data).isEmpty();
  }

  @Test
  void revisionChangingBetweenMetadataAndLoadIsReresolvedNotStoredUnderOldKey() {
    var old = source.state.get();
    source.beforeLoad = () -> source.state.set(snapshot(2, "catalog", "BEACH"));
    var service = service();
    assertThat(service.preferences(user, "TRIP_PLANNING"))
        .extracting(PreferenceSignal::valueCode)
        .containsExactly("BEACH");
    assertThat(cache.get(user, old.revision(), "TRIP_PLANNING")).isEmpty();
    assertThat(source.loads.get()).isEqualTo(1);
    assertThat(source.metadata.get()).isEqualTo(2);
    assertThat(service.pendingFlights()).isZero();
  }

  @Test
  void oldReplicaFillAfterSaveCannotOverwriteNewReplicaEntry() throws Exception {
    CountDownLatch captured = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    source.afterCapture =
        () -> {
          captured.countDown();
          await(release);
        };
    var a = service();
    var b = service(); // Independent instance, same DB and cache.
    try (var executor = Executors.newFixedThreadPool(2)) {
      var old = executor.submit(() -> a.preferences(user, "TRIP_PLANNING"));
      assertThat(captured.await(2, TimeUnit.SECONDS)).isTrue();
      source.afterCapture = () -> {};
      source.state.set(snapshot(2, "catalog", "BEACH"));
      assertThat(b.preferences(user, "TRIP_PLANNING"))
          .extracting(PreferenceSignal::valueCode)
          .containsExactly("BEACH");
      release.countDown();
      assertThat(old.get(2, TimeUnit.SECONDS))
          .extracting(PreferenceSignal::valueCode)
          .containsExactly("CAFE");
      assertThat(a.preferences(user, "TRIP_PLANNING"))
          .extracting(PreferenceSignal::valueCode)
          .containsExactly("BEACH");
    } finally {
      release.countDown();
    }
  }

  @Test
  void simultaneousSameKeyMissesShareOneLoadAndRegistryIsCleaned() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    source.afterCapture =
        () -> {
          started.countDown();
          await(release);
        };
    properties.setFollowerWait(Duration.ofSeconds(2));
    var service = service();
    try (var executor = Executors.newFixedThreadPool(8)) {
      List<Future<List<PreferenceSignal>>> requests = new ArrayList<>();
      for (int i = 0; i < 8; i++)
        requests.add(executor.submit(() -> service.preferences(user, "TRIP_PLANNING")));
      assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
      until(() -> count("coalesced") == 7);
      release.countDown();
      for (var request : requests) assertThat(request.get(2, TimeUnit.SECONDS)).hasSize(1);
      assertThat(source.loads.get()).isEqualTo(1);
      assertThat(service.pendingFlights()).isZero();
    } finally {
      release.countDown();
    }
  }

  @Test
  void followerTimeoutDoesNotCancelSharedLoadOrLeakRegistry() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    source.afterCapture =
        () -> {
          started.countDown();
          await(release);
        };
    properties.setFollowerWait(Duration.ofMillis(20));
    var service = service();
    try (var executor = Executors.newSingleThreadExecutor()) {
      var leader = executor.submit(() -> service.preferences(user, "TRIP_PLANNING"));
      assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
      assertThatThrownBy(() -> service.preferences(user, "TRIP_PLANNING"))
          .isInstanceOf(PreferencesBusyException.class);
      release.countDown();
      assertThat(leader.get(2, TimeUnit.SECONDS)).hasSize(1);
      assertThat(service.pendingFlights()).isZero();
      service.preferences(user, "TRIP_PLANNING");
      assertThat(source.loads.get()).isEqualTo(1);
    } finally {
      release.countDown();
    }
  }

  @Test
  void requestAndDistinctLoadAdmissionAreBounded() throws Exception {
    for (boolean requestLimit : List.of(true, false)) {
      CountDownLatch started = new CountDownLatch(1);
      CountDownLatch release = new CountDownLatch(1);
      source.afterCapture =
          () -> {
            started.countDown();
            await(release);
          };
      cache.data.clear();
      properties.setMaxLoads(1);
      properties.setMaxRequests(requestLimit ? 1 : 4);
      var service = service();
      try (var executor = Executors.newSingleThreadExecutor()) {
        var leader = executor.submit(() -> service.preferences(user, "TRIP_PLANNING"));
        assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> service.preferences(UUID.randomUUID(), "TRIP_PLANNING"))
            .isInstanceOf(PreferencesBusyException.class);
        assertThat(service.pendingFlights()).isEqualTo(1);
        release.countDown();
        leader.get(2, TimeUnit.SECONDS);
        assertThat(service.pendingFlights()).isZero();
      } finally {
        release.countDown();
      }
    }
  }

  @Test
  void failedLoadCleansRegistryAndNextRequestCanRecover() {
    source.beforeLoad =
        () -> {
          throw new IllegalStateException("test-only-error");
        };
    var service = service();
    assertThatThrownBy(() -> service.preferences(user, "TRIP_PLANNING"))
        .isInstanceOf(IllegalStateException.class);
    assertThat(service.pendingFlights()).isZero();
    source.beforeLoad = () -> {};
    assertThat(service.preferences(user, "TRIP_PLANNING")).hasSize(1);
  }

  @Test
  void interruptedFollowerRetainsInterruptAndDoesNotCancelLeader() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    source.afterCapture =
        () -> {
          started.countDown();
          await(release);
        };
    properties.setFollowerWait(Duration.ofSeconds(2));
    var service = service();
    AtomicBoolean interrupted = new AtomicBoolean();
    try (var executor = Executors.newSingleThreadExecutor()) {
      var leader = executor.submit(() -> service.preferences(user, "TRIP_PLANNING"));
      assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
      Thread follower =
          new Thread(
              () -> {
                try {
                  service.preferences(user, "TRIP_PLANNING");
                } catch (PreferencesBusyException expected) {
                  interrupted.set(Thread.currentThread().isInterrupted());
                }
              });
      follower.start();
      until(() -> count("coalesced") == 1);
      follower.interrupt();
      follower.join(1000);
      assertThat(follower.isAlive()).isFalse();
      assertThat(interrupted).isTrue();
      release.countDown();
      assertThat(leader.get(2, TimeUnit.SECONDS)).hasSize(1);
      assertThat(service.pendingFlights()).isZero();
    } finally {
      release.countDown();
    }
  }

  private CachedPreferencesService service() {
    return new CachedPreferencesService(source, cache, properties, meters);
  }

  private double count(String outcome) {
    var counter = meters.find("tripsense.context.preferences").tag("outcome", outcome).counter();
    return counter == null ? 0 : counter.count();
  }

  static void until(BooleanSupplier condition) throws Exception {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
    while (!condition.getAsBoolean() && System.nanoTime() < deadline) Thread.sleep(2);
    assertThat(condition.getAsBoolean()).isTrue();
  }

  static void await(CountDownLatch latch) {
    try {
      if (!latch.await(3, TimeUnit.SECONDS)) throw new IllegalStateException("test latch timeout");
    } catch (InterruptedException failure) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(failure);
    }
  }

  private static final UUID PROFILE = UUID.randomUUID();

  private static PreferenceSnapshot snapshot(long version, String catalog, String value) {
    return new PreferenceSnapshot(
        new PreferenceSnapshot.Revision(PROFILE, version, "COMPLETED", 1, catalog),
        "TRIP_PLANNING",
        List.of(signal(value)));
  }

  private static PreferenceSignal signal(String value) {
    return new PreferenceSignal("FOOD_STYLE", value, 1, "ONBOARDING", Instant.EPOCH);
  }

  private static final class Source implements PreferenceSnapshotSource {
    final AtomicReference<PreferenceSnapshot> state =
        new AtomicReference<>(snapshot(1, "catalog", "CAFE"));
    final AtomicInteger loads = new AtomicInteger();
    final AtomicInteger metadata = new AtomicInteger();
    volatile Runnable beforeLoad = () -> {};
    volatile Runnable afterCapture = () -> {};

    public PreferenceSnapshot.Revision revision(UUID owner) {
      metadata.incrementAndGet();
      return state.get().revision();
    }

    public PreferenceSnapshot load(UUID owner, String purpose) {
      loads.incrementAndGet();
      beforeLoad.run();
      var captured = state.get();
      afterCapture.run();
      return new PreferenceSnapshot(captured.revision(), purpose, captured.signals());
    }
  }

  private static final class Cache implements PreferenceSnapshotCache {
    boolean enabled = true;
    final Map<List<Object>, PreferenceSnapshot> data = new ConcurrentHashMap<>();

    public boolean enabled() {
      return enabled;
    }

    public Optional<PreferenceSnapshot> get(
        UUID owner, PreferenceSnapshot.Revision revision, String purpose) {
      return Optional.ofNullable(data.get(List.of(owner, revision, purpose)));
    }

    public void put(UUID owner, PreferenceSnapshot snapshot) {
      if (snapshot.revision().completed())
        data.put(List.of(owner, snapshot.revision(), snapshot.purpose()), snapshot);
    }
  }
}
