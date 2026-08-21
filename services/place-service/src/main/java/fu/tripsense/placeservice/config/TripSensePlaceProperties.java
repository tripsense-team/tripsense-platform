package fu.tripsense.placeservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "tripsense.places")
public class TripSensePlaceProperties {

    private String defaultCity = "Da Nang";
    private String defaultCountry = "Vietnam";
    private double defaultLat = 16.0544;
    private double defaultLng = 108.2022;

    private CacheProperties cache = new CacheProperties();
    private SearchProperties search = new SearchProperties();

    @Data
    public static class CacheProperties {
        private long searchTtlSeconds = 1800;
        private long detailsTtlSeconds = 43200;
        private long autocompleteTtlSeconds = 3600;
        private long providerTtlSeconds = 2592000L; // 30 days (1 month)
    }

    @Data
    public static class SearchProperties {
        private int minLocalResults = 5;
    }
}
