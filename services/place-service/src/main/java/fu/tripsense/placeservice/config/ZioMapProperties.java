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
    /** Operator-controlled rights gate. No photo API calls or display when false. */
    private boolean photoDisplayApproved = false;
    private int photoMaxWidthPx = 640;
    private String photoAllowedHosts = "lh3.googleusercontent.com,ziomap-api.socibi.com";
}
