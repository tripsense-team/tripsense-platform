package fu.tripsense.socialservice.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

  @Bean
  RestClient.Builder restClientBuilder(
      @Value("${trip-service.connect-timeout:2s}") Duration connectTimeout,
      @Value("${trip-service.read-timeout:5s}") Duration readTimeout) {
    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
    JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
    requestFactory.setReadTimeout(readTimeout);
    return RestClient.builder().requestFactory(requestFactory);
  }
}
