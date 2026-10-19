package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration;

class ExploreRedisPoolConfigTest {
  @Test
  void bootUsesBoundedPoolAndTlsWithoutOpeningRedisConnection() throws IOException {
    runner()
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              var factory = context.getBean(LettuceConnectionFactory.class);
              assertThat(factory.getClientConfiguration())
                  .isInstanceOf(LettucePoolingClientConfiguration.class);
              var config = (LettucePoolingClientConfiguration) factory.getClientConfiguration();
              assertThat(config.isUseSsl()).isTrue();
              assertThat(factory.getEagerInitialization()).isFalse();
              assertThat(config.getPoolConfig().getMaxTotal()).isEqualTo(8);
              assertThat(config.getPoolConfig().getMaxIdle()).isEqualTo(4);
              assertThat(config.getPoolConfig().getMinIdle()).isZero();
              assertThat(config.getPoolConfig().getMaxWaitDuration())
                  .isEqualTo(Duration.ofMillis(100));
            });
  }

  @Test
  void standardSpringOverridesCanTunePoolBounds() throws IOException {
    runner()
        .withPropertyValues(
            "spring.data.redis.lettuce.pool.max-active=2",
            "spring.data.redis.lettuce.pool.max-idle=1",
            "spring.data.redis.lettuce.pool.max-wait=50ms")
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              var factory = context.getBean(LettuceConnectionFactory.class);
              var config = (LettucePoolingClientConfiguration) factory.getClientConfiguration();
              assertThat(config.getPoolConfig().getMaxTotal()).isEqualTo(2);
              assertThat(config.getPoolConfig().getMaxIdle()).isEqualTo(1);
              assertThat(config.getPoolConfig().getMaxWaitDuration())
                  .isEqualTo(Duration.ofMillis(50));
            });
  }

  private ApplicationContextRunner runner() throws IOException {
    var source =
        new YamlPropertySourceLoader()
            .load("application", new ClassPathResource("application.yaml"))
            .getFirst();
    return new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(DataRedisAutoConfiguration.class))
        .withPropertyValues("spring.data.redis.url=rediss://localhost:6399/0")
        .withInitializer(context -> context.getEnvironment().getPropertySources().addLast(source));
  }
}
