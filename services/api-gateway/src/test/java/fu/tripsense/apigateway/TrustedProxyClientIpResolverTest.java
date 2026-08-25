package fu.tripsense.apigateway;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class TrustedProxyClientIpResolverTest {

    @Test
    void ignoresForwardedHeaderFromUntrustedPeer() throws Exception {
        TrustedProxyClientIpResolver resolver = new TrustedProxyClientIpResolver(List.of("127.0.0.1/32"));

        String clientIp = resolver.resolve(exchange("198.51.100.10", "203.0.113.20"));

        assertThat(clientIp).isEqualTo("198.51.100.10");
    }

    @Test
    void resolvesClientBehindTrustedProxy() throws Exception {
        TrustedProxyClientIpResolver resolver = new TrustedProxyClientIpResolver(List.of("127.0.0.1/32"));

        String clientIp = resolver.resolve(exchange("127.0.0.1", "203.0.113.20"));

        assertThat(clientIp).isEqualTo("203.0.113.20");
    }

    @Test
    void ignoresSpoofedLeftmostAddressAndUsesNearestUntrustedHop() throws Exception {
        TrustedProxyClientIpResolver resolver = new TrustedProxyClientIpResolver(
                List.of("127.0.0.1/32", "10.0.0.0/8"));

        String clientIp = resolver.resolve(exchange(
                "127.0.0.1",
                "192.0.2.99, 203.0.113.20, 10.10.0.4"));

        assertThat(clientIp).isEqualTo("203.0.113.20");
    }

    @Test
    void rejectsInvalidTrustedProxyConfiguration() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new TrustedProxyClientIpResolver(List.of("not-a-cidr")));
    }

    private MockServerWebExchange exchange(String remoteIp, String forwardedFor) throws Exception {
        MockServerHttpRequest.BaseBuilder<?> request = MockServerHttpRequest.get("/api/places/search")
                .remoteAddress(new InetSocketAddress(InetAddress.getByName(remoteIp), 12345));
        if (forwardedFor != null) {
            request.header("X-Forwarded-For", forwardedFor);
        }
        return MockServerWebExchange.from(request.build());
    }
}
