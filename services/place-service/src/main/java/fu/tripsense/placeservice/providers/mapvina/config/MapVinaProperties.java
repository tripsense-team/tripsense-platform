package fu.tripsense.placeservice.providers.mapvina.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "mapvina")
public class MapVinaProperties {

  private String baseUrl = "https://maps.mapvina.com";
  private String apiKey = "";
  private int timeoutMs = 8000;
}
