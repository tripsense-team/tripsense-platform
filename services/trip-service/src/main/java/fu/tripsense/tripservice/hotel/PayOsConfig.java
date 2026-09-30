package fu.tripsense.tripservice.hotel;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.payos.PayOS;

@Configuration
public class PayOsConfig {
  @Bean
  @ConditionalOnProperty(name = "payos.enabled", havingValue = "true")
  PayOS payOS(
      @Value("${payos.client-id}") String clientId,
      @Value("${payos.api-key}") String apiKey,
      @Value("${payos.checksum-key}") String checksumKey) {
    if (clientId.isBlank() || apiKey.isBlank() || checksumKey.isBlank()) {
      throw new IllegalStateException("payOS enabled but PAY_OS_CLIENT_ID / PAY_OS_API_KEY / PAY_OS_CHECKSUM_KEY missing");
    }
    return new PayOS(clientId, apiKey, checksumKey);
  }
}
