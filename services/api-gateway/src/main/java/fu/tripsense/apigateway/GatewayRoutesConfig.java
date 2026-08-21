package fu.tripsense.apigateway;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
class GatewayRoutesConfig {

    static final String PLACE_SERVICE_ROUTE_ID = "place-service";
    static final String PLACE_SERVICE_PATH = "/api/places/**";
    static final String PLACE_SERVICE_URI = "lb://place-service";

    static final String USER_SERVICE_ROUTE_ID = "user-service";
    static final String USER_SERVICE_AUTH_PATH = "/api/auth/**";
    static final String USER_SERVICE_USERS_PATH = "/api/users/**";
    static final String USER_SERVICE_URI = "lb://user-service";

    static final String MAIL_SERVICE_ROUTE_ID = "mail-service";
    static final String MAIL_SERVICE_PATH = "/api/email/**";
    static final String MAIL_SERVICE_URI = "lb://mail-service";

    @Bean
    RouteLocator tripSenseRoutes(
            RouteLocatorBuilder routes,
            RedisRateLimiter placeRedisRateLimiter,
            KeyResolver clientIpKeyResolver
    ) {
        return routes.routes()
                .route(PLACE_SERVICE_ROUTE_ID, route -> route
                        .path(PLACE_SERVICE_PATH)
                        .filters(filters -> filters.requestRateLimiter(config -> {
                            config.setRateLimiter(placeRedisRateLimiter);
                            config.setKeyResolver(clientIpKeyResolver);
                            config.setDenyEmptyKey(true);
                        }))
                        .uri(PLACE_SERVICE_URI))
                .route(USER_SERVICE_ROUTE_ID, route -> route
                        .path(USER_SERVICE_AUTH_PATH, USER_SERVICE_USERS_PATH)
                        .uri(USER_SERVICE_URI))
                .route(MAIL_SERVICE_ROUTE_ID, route -> route
                        .path(MAIL_SERVICE_PATH)
                        .uri(MAIL_SERVICE_URI))
                .build();
    }

    @Bean
    RedisRateLimiter placeRedisRateLimiter(
            @Value("${tripsense.gateway.places-rate-limit.replenish-rate:10}") int replenishRate,
            @Value("${tripsense.gateway.places-rate-limit.burst-capacity:20}") int burstCapacity
    ) {
        return new RedisRateLimiter(replenishRate, burstCapacity);
    }

    @Bean
    TrustedProxyClientIpResolver trustedProxyClientIpResolver(
            @Value("${tripsense.gateway.client-ip.trusted-proxies:127.0.0.1/32,::1/128}")
            List<String> trustedProxyCidrs
    ) {
        return new TrustedProxyClientIpResolver(trustedProxyCidrs);
    }

    @Bean
    KeyResolver clientIpKeyResolver(TrustedProxyClientIpResolver clientIpResolver) {
        return exchange -> reactor.core.publisher.Mono.just(clientIpResolver.resolve(exchange));
    }
}
