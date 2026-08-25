package fu.tripsense.placeservice.config;

import org.springframework.boot.mongodb.autoconfigure.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class MongoConfig {

    @Bean
    public MongoClientSettingsBuilderCustomizer mongoClientSettingsCustomizer() {
        return builder -> builder
                .applyToClusterSettings(settings -> settings.serverSelectionTimeout(500, TimeUnit.MILLISECONDS))
                .applyToSocketSettings(settings -> settings.connectTimeout(500, TimeUnit.MILLISECONDS));
    }
}
