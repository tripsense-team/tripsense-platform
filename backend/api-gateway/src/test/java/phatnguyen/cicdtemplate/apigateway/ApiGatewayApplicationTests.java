package phatnguyen.cicdtemplate.apigateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class ApiGatewayApplicationTests {

    @Test
    void healthEndpointReturnsUp() {
        var response = new HealthController("api-gateway").health();

        assertThat(response).containsEntry("service", "api-gateway");
        assertThat(response).containsEntry("status", "UP");
    }
}
