package phatnguyen.cicdtemplate.bookingservice;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {

    private final String serviceName;

    HealthController(@Value("${app.service-name}") String serviceName) {
        this.serviceName = serviceName;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of(
                "service", serviceName,
                "status", "UP"
        );
    }
}
