package phatnguyen.cicdtemplate.paymentservice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class PaymentServiceApplicationTests {

    @Test
    void healthEndpointReturnsUp() {
        var response = new HealthController("payment-service").health();

        assertThat(response).containsEntry("service", "payment-service");
        assertThat(response).containsEntry("status", "UP");
    }
}
