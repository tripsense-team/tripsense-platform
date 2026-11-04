package fu.tripsense.placeservice.providers.mapvina.config;

import java.net.URI;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class MapVinaClientConfig {
  @Bean
  @Qualifier("mapVinaRestClient")
  public RestClient mapVinaRestClient(MapVinaProperties properties) {
    URI baseUri = URI.create(properties.getBaseUrl());
    if (!"https".equalsIgnoreCase(baseUri.getScheme())
        || !"maps.mapvina.com".equalsIgnoreCase(baseUri.getHost())
        || baseUri.getUserInfo() != null
        || baseUri.getPort() != -1) {
      throw new IllegalArgumentException("MapVina base URL must use https://maps.mapvina.com");
    }
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(properties.getTimeoutMs());
    factory.setReadTimeout(properties.getTimeoutMs());
    return RestClient.builder().baseUrl(baseUri.toString()).requestFactory(factory).build();
  }
}
