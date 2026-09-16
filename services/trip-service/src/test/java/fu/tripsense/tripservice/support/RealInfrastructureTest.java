package fu.tripsense.tripservice.support;

import org.junit.jupiter.api.TestInstance;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.lifecycle.Startables;
import org.testcontainers.utility.DockerImageName;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Import(RealInfrastructureTest.TestClockConfig.class)
public abstract class RealInfrastructureTest {

    private static final boolean TESTCONTAINERS_ENABLED = Boolean.parseBoolean(
            System.getenv().getOrDefault("TRIPSENSE_TESTCONTAINERS_ENABLED", "true")
    );

    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:17-alpine"))
            .withDatabaseName("tripsense_trip_test")
            .withUsername("postgres")
            .withPassword("postgres");

    static final GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void realInfrastructureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.hikari.connection-timeout", () -> "5000");

        if (!TESTCONTAINERS_ENABLED) {
            String dbHost = env("TRIP_DB_HOST", "localhost");
            String dbPort = env("TRIP_DB_PORT", "5432");
            String dbName = env("TRIP_DB_NAME", "tripsense_trip");

            registry.add("spring.datasource.url", () -> "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + dbName);
            registry.add("spring.datasource.username", () -> env("TRIP_DB_USER", "postgres"));
            registry.add("spring.datasource.password", () -> env("TRIP_DB_PASS", "postgres"));
            registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
            registry.add("spring.data.redis.host", () -> env("REDIS_HOST", "localhost"));
            registry.add("spring.data.redis.port", () -> env("REDIS_PORT", "6379"));
            return;
        }

        Startables.deepStart(postgres, redis).join();
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    @TestConfiguration
    static class TestClockConfig {

        @Bean
        @Primary
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC);
        }
    }
}
