package phatnguyen.cicdtemplate.bookingservice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class BookingServiceApplicationTests {

    @Test
    void healthEndpointReturnsUp() {
        var response = new HealthController("booking-service").health();

        assertThat(response).containsEntry("service", "booking-service");
        assertThat(response).containsEntry("status", "UP");
    }
}
