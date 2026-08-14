package fu.tripsense.apigateway;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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
    RouteLocator tripSenseRoutes(RouteLocatorBuilder routes) {
        return routes.routes()
                .route(PLACE_SERVICE_ROUTE_ID, route -> route
                        .path(PLACE_SERVICE_PATH)
                        .uri(PLACE_SERVICE_URI))
                .route(USER_SERVICE_ROUTE_ID, route -> route
                        .path(USER_SERVICE_AUTH_PATH, USER_SERVICE_USERS_PATH)
                        .uri(USER_SERVICE_URI))
                .route(MAIL_SERVICE_ROUTE_ID, route -> route
                        .path(MAIL_SERVICE_PATH)
                        .uri(MAIL_SERVICE_URI))
                .build();
    }
}
