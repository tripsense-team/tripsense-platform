package phatnguyen.cicdtemplate.userservice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class UserServiceApplicationTests {

    @Test
    void healthEndpointReturnsUp() {
        var response = new HealthController("user-service").health();

        assertThat(response).containsEntry("service", "user-service");
        assertThat(response).containsEntry("status", "UP");
    }
}
