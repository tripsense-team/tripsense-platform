package fu.tripsense.contextservice.adapter.out.persistence;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.contextservice.application.*;
import fu.tripsense.contextservice.application.cache.*;
import fu.tripsense.contextservice.security.FreeTextCryptoService;
import fu.tripsense.contextservice.support.LocalCacheTestServer;
import jakarta.persistence.EntityManagerFactory;
import java.lang.reflect.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

/** Actual PostgreSQL/JPA transactions, isolated disposable cluster; no production credentials. */
@EnabledIfSystemProperty(named = "context.cache.integration", matches = "true")
class PreferenceSnapshotPostgresIntegrationTest {
  private static LocalCacheTestServer server;
  private static AnnotationConfigApplicationContext context;
  private static CountingDataSource data;
  private static OnboardingService onboarding;
  private static JdbcPreferenceSnapshotSource source;
  private static JdbcTemplate jdbc;

  @BeforeAll
  static void start() throws Exception {
    server = LocalCacheTestServer.postgres();
    var driver =
        new DriverManagerDataSource(
            "jdbc:postgresql://127.0.0.1:" + server.port + "/postgres", "cache_test", "");
    data = new CountingDataSource(driver);
    new ResourceDatabasePopulator(
            new ClassPathResource("db/migration/V1__create_onboarding_context.sql"))
        .execute(data);
    context = new AnnotationConfigApplicationContext();
    context.registerBean(DataSource.class, () -> data);
    context.register(TestConfig.class);
    context.refresh();
    onboarding = context.getBean(OnboardingService.class);
    source = context.getBean(JdbcPreferenceSnapshotSource.class);
    jdbc = new JdbcTemplate(data);
  }

  @AfterAll
  static void stop() throws Exception {
    if (context != null) context.close();
    if (server != null) server.close();
  }

  @BeforeEach
  void resetHooksAndCatalog() {
    data.beforeSignals = () -> {};
    jdbc.update(
        "UPDATE preference_dimensions SET sensitivity_class='STANDARD',active=true WHERE code='FOOD_STYLE'");
    data.queries.clear();
  }

  @Test
  void scalarMetadataUsesCommittedJpaVersionAndNoProfileRelationsOrSignalQuery() {
    UUID user = UUID.randomUUID();
    var completed = completed(user);
    data.queries.clear();
    var revision = source.revision(user);
    assertThat(revision.version()).isEqualTo(completed.version());
    assertThat(revision.completed()).isTrue();
    assertThat(data.queries).hasSize(2);
    assertThat(data.queries)
        .noneMatch(
            sql ->
                sql.contains("onboarding_selections")
                    || sql.contains("free_text")
                    || sql.contains("preference_signals"));
    data.queries.clear();
    var loaded = source.load(user, "TRIP_PLANNING");
    assertThat(data.queries).hasSize(3);
    assertThat(loaded.signals())
        .extracting(PreferenceSignalReader.PreferenceSignal::valueCode)
        .containsExactly("CAFE");
    var updated =
        onboarding.save(
            user,
            new OnboardingCommand(
                completed.version(), Map.of("FOOD_STYLE", Set.of("LOCAL_FOOD")), Map.of()));
    assertThat(source.revision(user).version())
        .isEqualTo(updated.version())
        .isGreaterThan(revision.version());
    assertThat(source.load(user, "TRIP_PLANNING").signals())
        .extracting(PreferenceSignalReader.PreferenceSignal::valueCode)
        .containsExactly("LOCAL_FOOD");
  }

  @Test
  void rollbackKeepsRevisionAndSignalsWhileDeleteRecreateGetsNewIdentity() {
    UUID user = UUID.randomUUID();
    var completed = completed(user);
    var before = source.load(user, "TRIP_PLANNING");
    new TransactionTemplate(context.getBean(PlatformTransactionManager.class))
        .execute(
            status -> {
              onboarding.save(
                  user,
                  new OnboardingCommand(
                      completed.version(), Map.of("FOOD_STYLE", Set.of("LOCAL_FOOD")), Map.of()));
              status.setRollbackOnly();
              return null;
            });
    var after = source.load(user, "TRIP_PLANNING");
    assertThat(after.revision()).isEqualTo(before.revision());
    assertThat(after.signals()).isEqualTo(before.signals());
    onboarding.delete(user);
    assertThat(source.revision(user).completed()).isFalse();
    assertThat(source.load(user, "TRIP_PLANNING").signals()).isEmpty();
    var recreated = completed(user);
    assertThat(source.revision(user).profileId()).isNotEqualTo(before.revision().profileId());
    assertThat(source.revision(user).version()).isEqualTo(recreated.version());
  }

  @Test
  void repeatableReadCannotCombineOldRevisionWithNewCommittedSignals() throws Exception {
    UUID user = UUID.randomUUID();
    var completed = completed(user);
    var oldRevision = source.revision(user);
    CountDownLatch entered = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    AtomicBoolean first = new AtomicBoolean(true);
    data.beforeSignals =
        () -> {
          if (!first.compareAndSet(true, false)) return;
          entered.countDown();
          try {
            if (!release.await(3, TimeUnit.SECONDS))
              throw new IllegalStateException("test latch timeout");
          } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(failure);
          }
        };
    try (var executor = Executors.newSingleThreadExecutor()) {
      var oldLoad = executor.submit(() -> source.load(user, "TRIP_PLANNING"));
      assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
      var updated =
          onboarding.save(
              user,
              new OnboardingCommand(
                  completed.version(), Map.of("FOOD_STYLE", Set.of("LOCAL_FOOD")), Map.of()));
      assertThat(source.revision(user).version()).isEqualTo(updated.version());
      release.countDown();
      var oldSnapshot = oldLoad.get(2, TimeUnit.SECONDS);
      assertThat(oldSnapshot.revision()).isEqualTo(oldRevision);
      assertThat(oldSnapshot.signals())
          .extracting(PreferenceSignalReader.PreferenceSignal::valueCode)
          .containsExactly("CAFE");
      assertThat(source.load(user, "TRIP_PLANNING").signals())
          .extracting(PreferenceSignalReader.PreferenceSignal::valueCode)
          .containsExactly("LOCAL_FOOD");
    } finally {
      release.countDown();
      data.beforeSignals = () -> {};
    }
  }

  @Test
  void catalogSensitivityAndActivationChangeFingerprintAndFilteredOutput() {
    UUID user = UUID.randomUUID();
    completed(user);
    var original = source.load(user, "TRIP_PLANNING");
    jdbc.update(
        "UPDATE preference_dimensions SET sensitivity_class='SENSITIVE' WHERE code='FOOD_STYLE'");
    var sensitive = source.load(user, "TRIP_PLANNING");
    assertThat(sensitive.revision().catalogHash()).isNotEqualTo(original.revision().catalogHash());
    assertThat(sensitive.signals()).isEmpty();
    jdbc.update(
        "UPDATE preference_dimensions SET sensitivity_class='STANDARD',active=false WHERE code='FOOD_STYLE'");
    var inactive = source.load(user, "TRIP_PLANNING");
    assertThat(inactive.revision().catalogHash()).isNotEqualTo(sensitive.revision().catalogHash());
    assertThat(inactive.signals()).isEmpty();
  }

  @Test
  void draftDoesNotReadSignalsAndPurposeFilteringKeepsRawNotesOut() {
    UUID user = UUID.randomUUID();
    var draft =
        onboarding.save(
            user,
            new OnboardingCommand(
                0,
                Map.of("FOOD_STYLE", Set.of("CAFE"), "LOYALTY_PROGRAM", Set.of("PRIVATE")),
                Map.of(),
                Map.of(),
                "Thích đi biển"));
    data.queries.clear();
    assertThat(source.load(user, "TRIP_PLANNING").signals()).isEmpty();
    assertThat(data.queries).noneMatch(sql -> sql.contains("FROM preference_signals"));
    onboarding.complete(user, draft.version());
    assertThat(source.load(user, "TRIP_PLANNING").signals())
        .extracting(PreferenceSignalReader.PreferenceSignal::dimensionCode)
        .containsExactly("FOOD_STYLE");
    assertThat(source.load(user, "EXPLORE_RECOMMENDATION").signals())
        .extracting(PreferenceSignalReader.PreferenceSignal::dimensionCode)
        .containsExactly("EXPLORE_AFFINITY", "FOOD_STYLE");
  }

  private static fu.tripsense.contextservice.domain.OnboardingProfile completed(UUID user) {
    var draft =
        onboarding.save(
            user, new OnboardingCommand(0, Map.of("FOOD_STYLE", Set.of("CAFE")), Map.of()));
    return onboarding.complete(user, draft.version());
  }

  @Configuration
  @EnableTransactionManagement
  @EnableJpaRepositories(basePackageClasses = SpringOnboardingProfileJpaRepository.class)
  static class TestConfig {
    @Bean
    LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource ds) {
      var factory = new LocalContainerEntityManagerFactoryBean();
      factory.setDataSource(ds);
      factory.setPackagesToScan(OnboardingProfileEntity.class.getPackageName());
      factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
      factory.setJpaPropertyMap(
          Map.of("hibernate.hbm2ddl.auto", "validate", "hibernate.jdbc.time_zone", "UTC"));
      return factory;
    }

    @Bean
    PlatformTransactionManager transactionManager(EntityManagerFactory emf) {
      return new JpaTransactionManager(emf);
    }

    @Bean
    JdbcTemplate jdbc(DataSource ds) {
      return new JdbcTemplate(ds);
    }

    @Bean
    JpaOnboardingProfileRepository profiles(SpringOnboardingProfileJpaRepository repository) {
      return new JpaOnboardingProfileRepository(
          repository, new FreeTextCryptoService("test-only-encryption-secret"));
    }

    @Bean
    JpaPreferenceSignalPublisher signals(SpringPreferenceSignalJpaRepository repository) {
      return new JpaPreferenceSignalPublisher(repository);
    }

    @Bean
    JpaPreferenceDimensionCatalog catalog(SpringPreferenceDimensionJpaRepository repository) {
      return new JpaPreferenceDimensionCatalog(repository);
    }

    @Bean
    OnboardingService onboarding(
        JpaOnboardingProfileRepository profiles,
        JpaPreferenceSignalPublisher signals,
        JpaPreferenceDimensionCatalog catalog,
        JdbcTemplate jdbc) {
      return new OnboardingService(
          profiles,
          signals,
          catalog,
          new JdbcContextEventOutbox(jdbc, new com.fasterxml.jackson.databind.ObjectMapper()));
    }

    @Bean
    JdbcPreferenceSnapshotSource source(DataSource ds, PlatformTransactionManager tm) {
      return new JdbcPreferenceSnapshotSource(ds, tm);
    }
  }

  private static class CountingDataSource extends DelegatingDataSource {
    final List<String> queries = new CopyOnWriteArrayList<>();
    volatile Runnable beforeSignals = () -> {};

    CountingDataSource(DataSource delegate) {
      super(delegate);
    }

    @Override
    public Connection getConnection() throws SQLException {
      return wrap(super.getConnection());
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
      return wrap(super.getConnection(username, password));
    }

    private Connection wrap(Connection connection) {
      return (Connection)
          Proxy.newProxyInstance(
              Connection.class.getClassLoader(),
              new Class<?>[] {Connection.class},
              (proxy, method, args) -> {
                Object result = invoke(method, connection, args);
                if (result instanceof Statement statement
                    && (method.getName().equals("prepareStatement")
                        || method.getName().equals("createStatement"))) {
                  String preparedSql =
                      args != null && args.length > 0 && args[0] instanceof String sql ? sql : null;
                  Class<?> type =
                      statement instanceof PreparedStatement
                          ? PreparedStatement.class
                          : Statement.class;
                  return Proxy.newProxyInstance(
                      type.getClassLoader(),
                      new Class<?>[] {type},
                      (p, m, a) -> {
                        String query =
                            preparedSql != null
                                ? preparedSql
                                : a != null && a.length > 0 && a[0] instanceof String sql
                                    ? sql
                                    : "";
                        if (m.getName().equals("executeQuery")
                            && query.stripLeading().startsWith("SELECT")) {
                          queries.add(query);
                          if (query.contains("FROM preference_signals")) beforeSignals.run();
                        }
                        return invoke(m, statement, a);
                      });
                }
                return result;
              });
    }

    private static Object invoke(Method method, Object target, Object[] args) throws Throwable {
      try {
        return method.invoke(target, args);
      } catch (InvocationTargetException failure) {
        throw failure.getCause();
      }
    }
  }
}
