package fu.tripsense.placeservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "ziomap")
public class ZioMapProperties {

    private String baseUrl = "https://ziomap-api.socibi.com";
    private String apiKey = "";
    private int timeoutMs = 8000;
}
