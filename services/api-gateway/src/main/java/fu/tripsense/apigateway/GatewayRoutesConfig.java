package fu.tripsense.apigateway;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

@Configuration
class GatewayRoutesConfig {

  static final String BLOCK_INTERNAL_ROUTE_ID = "block-internal-endpoints";
  static final String COLLECTION_WRITES_ROUTE_ID = "place-collection-writes";
  static final String SAVED_MEMBERSHIP_WRITES_ROUTE_ID = "saved-membership-writes";
  static final String TRIP_PLACE_WRITES_ROUTE_ID = "trip-place-writes";
  static final String REVIEW_WRITES_ROUTE_ID = "community-review-writes";
  static final String REVIEW_READS_ROUTE_ID = "community-review-reads";

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

  static final String TRIP_SERVICE_ROUTE_ID = "trip-service";
  static final String TRIP_SERVICE_PATH = "/api/trips/**";
  static final String TRIP_SERVICE_URI = "lb://trip-service";
  static final String TRIP_COLLABORATION_STREAM_PATH = "/api/trips/*/collaboration/events";

  static final String SOCIAL_SERVICE_ROUTE_ID = "social-service";
  static final String SOCIAL_SERVICE_PATH = "/api/social/**";
  static final String SOCIAL_SERVICE_URI = "lb://social-service";
  static final String CHAT_STREAM_PATH = "/api/social/chat/events";
  static final String CONTEXT_SERVICE_ROUTE_ID = "context-service";
  static final String CONTEXT_SERVICE_PATH = "/api/context/**";
  static final String CONTEXT_SERVICE_URI = "lb://context-service";

  static final String AI_SERVICE_ROUTE_ID = "ai-service";
  static final String AI_SERVICE_PATH = "/api/ai/**";
  static final String AI_SERVICE_URI = "lb://ai-service";

  static final String RECOMMENDATION_SERVICE_ROUTE_ID = "recommendation-service";
  static final String RECOMMENDATION_SERVICE_PATH = "/api/recommendations/**";
  static final String RECOMMENDATION_SERVICE_URI = "lb://recommendation-service";

  @Bean
  RouteLocator tripSenseRoutes(
      RouteLocatorBuilder routes,
      @Qualifier("placeRedisRateLimiter") RedisRateLimiter placeRedisRateLimiter,
      @Qualifier("socialRedisRateLimiter") RedisRateLimiter socialRedisRateLimiter,
      @Qualifier("chatRedisRateLimiter") RedisRateLimiter chatRedisRateLimiter,
      @Qualifier("recommendationRedisRateLimiter") RedisRateLimiter recommendationRedisRateLimiter,
      @Qualifier("collectionWriteRateLimiter") RedisRateLimiter collectionWriteRateLimiter,
      @Qualifier("savedMembershipWriteRateLimiter")
          RedisRateLimiter savedMembershipWriteRateLimiter,
      @Qualifier("tripPlaceWriteRateLimiter") RedisRateLimiter tripPlaceWriteRateLimiter,
      @Qualifier("reviewWriteRateLimiter") RedisRateLimiter reviewWriteRateLimiter,
      @Qualifier("reviewReadRateLimiter") RedisRateLimiter reviewReadRateLimiter,
      @Qualifier("clientIpKeyResolver") KeyResolver clientIpKeyResolver,
      @Qualifier("authenticatedActorKeyResolver") KeyResolver authenticatedActorKeyResolver,
      @Value("${tripsense.gateway.places-rate-limit.enabled:false}")
          boolean placeRateLimitingEnabled,
      @Value("${tripsense.gateway.social-rate-limit.enabled:false}")
          boolean socialRateLimitingEnabled,
      @Value("${tripsense.gateway.chat-rate-limit.enabled:true}") boolean chatRateLimitingEnabled,
      @Value("${tripsense.gateway.recommendations-rate-limit.enabled:true}")
          boolean recommendationRateLimitingEnabled) {
    return routes
        .routes()
        .route(
            BLOCK_INTERNAL_ROUTE_ID,
            route ->
                route
                    .order(Ordered.HIGHEST_PRECEDENCE)
                    .path(
                        "/api/*/internal/**",
                        "/api/places/internal/**",
                        "/api/recommendations/internal/**")
                    .filters(
                        filters ->
                            filters.filter(
                                (exchange, chain) -> {
                                  exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                                  return exchange.getResponse().setComplete();
                                }))
                    .uri("no://op"))
        .route(
            SAVED_MEMBERSHIP_WRITES_ROUTE_ID,
            route ->
                route
                    .path("/api/places/me/collections/*/places/**")
                    .and()
                    .method(HttpMethod.PUT, HttpMethod.DELETE)
                    .filters(
                        filters ->
                            filters.requestRateLimiter(
                                config -> {
                                  config.setRateLimiter(savedMembershipWriteRateLimiter);
                                  config.setKeyResolver(authenticatedActorKeyResolver);
                                  config.setDenyEmptyKey(true);
                                }))
                    .uri(PLACE_SERVICE_URI))
        .route(
            COLLECTION_WRITES_ROUTE_ID,
            route ->
                route
                    .path("/api/places/me/collections", "/api/places/me/collections/*")
                    .and()
                    .method(HttpMethod.POST, HttpMethod.PATCH, HttpMethod.DELETE)
                    .filters(
                        filters ->
                            filters.requestRateLimiter(
                                config -> {
                                  config.setRateLimiter(collectionWriteRateLimiter);
                                  config.setKeyResolver(authenticatedActorKeyResolver);
                                  config.setDenyEmptyKey(true);
                                }))
                    .uri(PLACE_SERVICE_URI))
        .route(
            PLACE_SERVICE_ROUTE_ID,
            route -> {
              var r = route.path(PLACE_SERVICE_PATH);
              if (placeRateLimitingEnabled) {
                r.filters(
                    filters ->
                        filters.requestRateLimiter(
                            config -> {
                              config.setRateLimiter(placeRedisRateLimiter);
                              config.setKeyResolver(clientIpKeyResolver);
                              config.setDenyEmptyKey(true);
                            }));
              }
              return r.uri(PLACE_SERVICE_URI);
            })
        .route(
            USER_SERVICE_ROUTE_ID,
            route ->
                route.path(USER_SERVICE_AUTH_PATH, USER_SERVICE_USERS_PATH).uri(USER_SERVICE_URI))
        .route(MAIL_SERVICE_ROUTE_ID, route -> route.path(MAIL_SERVICE_PATH).uri(MAIL_SERVICE_URI))
        .route(
            "trip-collaboration-stream",
            route ->
                route
                    .path(TRIP_COLLABORATION_STREAM_PATH)
                    .and()
                    .method(HttpMethod.GET)
                    .filters(
                        filters ->
                            filters
                                .setResponseHeader("Cache-Control", "no-store")
                                .setResponseHeader("X-Accel-Buffering", "no"))
                    .uri(TRIP_SERVICE_URI))
        .route(
            TRIP_PLACE_WRITES_ROUTE_ID,
            route ->
                route
                    .path("/api/trips/*/places/**")
                    .and()
                    .method(HttpMethod.PUT, HttpMethod.DELETE)
                    .filters(
                        filters ->
                            filters.requestRateLimiter(
                                config -> {
                                  config.setRateLimiter(tripPlaceWriteRateLimiter);
                                  config.setKeyResolver(authenticatedActorKeyResolver);
                                  config.setDenyEmptyKey(true);
                                }))
                    .uri(TRIP_SERVICE_URI))
        .route(TRIP_SERVICE_ROUTE_ID, route -> route.path(TRIP_SERVICE_PATH).uri(TRIP_SERVICE_URI))
        .route(
            RECOMMENDATION_SERVICE_ROUTE_ID,
            route -> {
              var r = route.path(RECOMMENDATION_SERVICE_PATH);
              r.filters(
                  filters -> {
                    filters.setResponseHeader("Cache-Control", "no-store");
                    if (recommendationRateLimitingEnabled) {
                      filters.requestRateLimiter(
                          config -> {
                            config.setRateLimiter(recommendationRedisRateLimiter);
                            config.setKeyResolver(clientIpKeyResolver);
                            config.setDenyEmptyKey(true);
                          });
                    }
                    return filters;
                  });
              return r.uri(RECOMMENDATION_SERVICE_URI);
            })
        .route(
            AI_SERVICE_ROUTE_ID,
            route ->
                route
                    .path(AI_SERVICE_PATH)
                    .filters(
                        filters ->
                            filters
                                .setResponseHeader("Cache-Control", "no-store")
                                .setResponseHeader("X-Accel-Buffering", "no"))
                    .uri(AI_SERVICE_URI))
        .route(
            "chat-stream",
            route ->
                route
                    .path(CHAT_STREAM_PATH)
                    .filters(
                        filters ->
                            filters
                                .setResponseHeader("Cache-Control", "no-store")
                                .setResponseHeader("X-Accel-Buffering", "no"))
                    .uri(SOCIAL_SERVICE_URI))
        .route(
            "chat-send",
            route -> {
              var r =
                  route
                      .path("/api/social/chat/conversations/*/messages")
                      .and()
                      .method(HttpMethod.POST);
              if (chatRateLimitingEnabled)
                r.filters(
                    filters ->
                        filters.requestRateLimiter(
                            config -> {
                              config.setRateLimiter(chatRedisRateLimiter);
                              config.setKeyResolver(clientIpKeyResolver);
                              config.setDenyEmptyKey(true);
                            }));
              return r.uri(SOCIAL_SERVICE_URI);
            })
        .route(
            "chat-user-search",
            route -> {
              var r = route.path("/api/social/chat/users").and().method(HttpMethod.GET);
              if (chatRateLimitingEnabled)
                r.filters(
                    filters ->
                        filters.requestRateLimiter(
                            config -> {
                              config.setRateLimiter(chatRedisRateLimiter);
                              config.setKeyResolver(clientIpKeyResolver);
                              config.setDenyEmptyKey(true);
                            }));
              return r.uri(SOCIAL_SERVICE_URI);
            })
        .route(
            REVIEW_WRITES_ROUTE_ID,
            route ->
                route
                    .path("/api/social/places/*/reviews", "/api/social/place-reviews/*")
                    .and()
                    .method(HttpMethod.POST, HttpMethod.PATCH, HttpMethod.DELETE)
                    .filters(
                        filters ->
                            filters.requestRateLimiter(
                                config -> {
                                  config.setRateLimiter(reviewWriteRateLimiter);
                                  config.setKeyResolver(authenticatedActorKeyResolver);
                                  config.setDenyEmptyKey(true);
                                }))
                    .uri(SOCIAL_SERVICE_URI))
        .route(
            REVIEW_READS_ROUTE_ID,
            route ->
                route
                    .path("/api/social/places/*/reviews")
                    .and()
                    .method(HttpMethod.GET)
                    .filters(
                        filters ->
                            filters
                                .setResponseHeader("Cache-Control", "private, no-store")
                                .requestRateLimiter(
                                    config -> {
                                      config.setRateLimiter(reviewReadRateLimiter);
                                      config.setKeyResolver(clientIpKeyResolver);
                                      config.setDenyEmptyKey(true);
                                    }))
                    .uri(SOCIAL_SERVICE_URI))
        .route(
            SOCIAL_SERVICE_ROUTE_ID,
            route -> {
              var r = route.path(SOCIAL_SERVICE_PATH);
              if (socialRateLimitingEnabled) {
                r.filters(
                    filters ->
                        filters.requestRateLimiter(
                            config -> {
                              config.setRateLimiter(socialRedisRateLimiter);
                              config.setKeyResolver(clientIpKeyResolver);
                              config.setDenyEmptyKey(true);
                            }));
              }
              return r.uri(SOCIAL_SERVICE_URI);
            })
        .route(
            CONTEXT_SERVICE_ROUTE_ID,
            route -> route.path(CONTEXT_SERVICE_PATH).uri(CONTEXT_SERVICE_URI))
        .build();
  }

  @Bean
  @Primary
  RedisRateLimiter placeRedisRateLimiter(
      @Value("${tripsense.gateway.places-rate-limit.replenish-rate:10}") int replenishRate,
      @Value("${tripsense.gateway.places-rate-limit.burst-capacity:20}") int burstCapacity) {
    return new RedisRateLimiter(replenishRate, burstCapacity);
  }

  @Bean
  RedisRateLimiter socialRedisRateLimiter(
      @Value("${tripsense.gateway.social-rate-limit.replenish-rate:30}") int replenishRate,
      @Value("${tripsense.gateway.social-rate-limit.burst-capacity:60}") int burstCapacity) {
    return new RedisRateLimiter(replenishRate, burstCapacity);
  }

  @Bean
  RedisRateLimiter chatRedisRateLimiter(
      @Value("${tripsense.gateway.chat-rate-limit.replenish-rate:5}") int replenishRate,
      @Value("${tripsense.gateway.chat-rate-limit.burst-capacity:10}") int burstCapacity) {
    return new RedisRateLimiter(replenishRate, burstCapacity);
  }

  @Bean
  RedisRateLimiter recommendationRedisRateLimiter(
      @Value("${tripsense.gateway.recommendations-rate-limit.replenish-rate:5}") int replenishRate,
      @Value("${tripsense.gateway.recommendations-rate-limit.burst-capacity:10}")
          int burstCapacity) {
    return new RedisRateLimiter(replenishRate, burstCapacity);
  }

  @Bean
  RedisRateLimiter collectionWriteRateLimiter() {
    return perMinuteRateLimiter(10);
  }

  @Bean
  RedisRateLimiter savedMembershipWriteRateLimiter() {
    return perMinuteRateLimiter(60);
  }

  @Bean
  RedisRateLimiter tripPlaceWriteRateLimiter() {
    return perMinuteRateLimiter(30);
  }

  @Bean
  RedisRateLimiter reviewWriteRateLimiter() {
    return perMinuteRateLimiter(5);
  }

  @Bean
  RedisRateLimiter reviewReadRateLimiter() {
    return new RedisRateLimiter(10, 20);
  }

  @Bean
  TrustedProxyClientIpResolver trustedProxyClientIpResolver(
      @Value("${tripsense.gateway.client-ip.trusted-proxies:127.0.0.1/32,::1/128}")
          List<String> trustedProxyCidrs) {
    return new TrustedProxyClientIpResolver(trustedProxyCidrs);
  }

  @Bean
  @Primary
  KeyResolver clientIpKeyResolver(TrustedProxyClientIpResolver clientIpResolver) {
    return exchange -> reactor.core.publisher.Mono.just(clientIpResolver.resolve(exchange));
  }

  @Bean
  KeyResolver authenticatedActorKeyResolver(TrustedProxyClientIpResolver clientIpResolver) {
    return exchange -> {
      String authorization = exchange.getRequest().getHeaders().getFirst("Authorization");
      String key =
          authorization == null || authorization.isBlank()
              ? "ip:" + clientIpResolver.resolve(exchange)
              : "token:" + sha256(authorization);
      return reactor.core.publisher.Mono.just(key);
    };
  }

  private static RedisRateLimiter perMinuteRateLimiter(int requestsPerMinute) {
    int requestedTokens = 60 / requestsPerMinute;
    return new RedisRateLimiter(1, 60, requestedTokens);
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
