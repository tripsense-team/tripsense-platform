package fu.tripsense.placeservice.config;

import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MongoConfig {

  @Value("${spring.data.mongodb.server-selection-timeout-ms:5000}")
  private long serverSelectionTimeoutMs;

  @Value("${spring.data.mongodb.connect-timeout-ms:5000}")
  private long connectTimeoutMs;

  @Bean
  public MongoClientSettingsBuilderCustomizer mongoClientSettingsCustomizer() {
    return builder ->
        builder
            .applyToClusterSettings(
                settings -> settings.serverSelectionTimeout(serverSelectionTimeoutMs, TimeUnit.MILLISECONDS))
            .applyToSocketSettings(settings -> settings.connectTimeout(connectTimeoutMs, TimeUnit.MILLISECONDS));
  }
}

