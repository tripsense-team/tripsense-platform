package fu.tripsense.emailservice.config;

import com.resend.Resend;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class ResendConfig {

    @Value("${resend.api-key}")
    private String apiKey;

    @Bean
    public Resend resend() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY is missing or empty. Resend bean initialized in simulation mode.");
            return new Resend("simulated-api-key");
        }
        log.info("Resend bean configured successfully with API Key.");
        return new Resend(apiKey);
    }
}
