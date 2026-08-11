package phatnguyen.cicdtemplate.authservice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class AuthServiceApplicationTests {

    @Test
    void healthEndpointReturnsUp() {
        var response = new HealthController("auth-service").health();

        assertThat(response).containsEntry("service", "auth-service");
        assertThat(response).containsEntry("status", "UP");
    }
}
