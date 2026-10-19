package fu.tripsense.recommendation.config;

import fu.tripsense.recommendation.application.RequestDiagnostics;
import java.net.http.HttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class HttpClientConfig {
  @Bean
  RestClient recommendationRestClient(RecommendationProperties properties) {
    var timeout = properties.getDownstream().getTimeout();
    HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
    JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
    requestFactory.setReadTimeout(timeout);
    return RestClient.builder()
        .requestFactory(requestFactory)
        .requestInterceptor(
            (request, body, execution) -> {
              String requestId = RequestDiagnostics.requestId();
              if (requestId != null) request.getHeaders().set(RequestDiagnostics.HEADER, requestId);
              return execution.execute(request, body);
            })
        .build();
  }
}
