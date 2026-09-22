package fu.tripsense.placeservice.config;

import java.util.concurrent.TimeUnit;
import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MongoConfig {

  @Bean
  public MongoClientSettingsBuilderCustomizer mongoClientSettingsCustomizer() {
    return builder ->
        builder
            .applyToClusterSettings(
                settings -> settings.serverSelectionTimeout(500, TimeUnit.MILLISECONDS))
            .applyToSocketSettings(settings -> settings.connectTimeout(500, TimeUnit.MILLISECONDS));
  }
}
