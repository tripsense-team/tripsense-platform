package fu.tripsense.placeservice.providers;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderHttpClientTest {

    @Test
    void redactsTokenLikeValuesFromProviderErrorBodies() {
        String sanitized = ProviderHttpClient.sanitizeBody(
                "failed url=https://maps.vietmap.vn/api/place/v4?apikey=private-value Authorization: Bearer secret-token"
        );

        assertThat(sanitized).contains("apikey=[REDACTED]");
        assertThat(sanitized).contains("Bearer [REDACTED]");
        assertThat(sanitized).doesNotContain("private-value");
        assertThat(sanitized).doesNotContain("secret-token");
    }
}
