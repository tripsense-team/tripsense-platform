package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariDataSource;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;

class ImpressionBatchDataSourceConfigTest {
  @Test
  void applicationYamlEnablesPostgresBatchRewriteWithoutOpeningConnection() throws IOException {
    runner()
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              HikariDataSource dataSource = context.getBean(HikariDataSource.class);
              assertThat(dataSource.getDataSourceProperties().getProperty("reWriteBatchedInserts"))
                  .isEqualTo("true");
              assertThat(dataSource.getHikariPoolMXBean()).isNull();
            });
  }

  @Test
  void recommendationScopedOverrideCanDisableDriverRewrite() throws IOException {
    runner()
        .withPropertyValues("RECOMMENDATION_REWRITE_BATCHED_INSERTS=false")
        .run(
            context -> {
              assertThat(context).hasNotFailed();
              assertThat(
                      context
                          .getBean(HikariDataSource.class)
                          .getDataSourceProperties()
                          .getProperty("reWriteBatchedInserts"))
                  .isEqualTo("false");
            });
  }

  private ApplicationContextRunner runner() throws IOException {
    var source =
        new YamlPropertySourceLoader()
            .load("application", new ClassPathResource("application.yaml"))
            .getFirst();
    return new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class))
        .withPropertyValues(
            "spring.datasource.url=jdbc:postgresql://localhost:5432/offline_test",
            "spring.datasource.username=test",
            "spring.datasource.password=")
        .withInitializer(context -> context.getEnvironment().getPropertySources().addLast(source));
  }
}
