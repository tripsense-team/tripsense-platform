package fu.tripsense.apigateway;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class GatewayRoutesConfig {

    static final String PLACE_SERVICE_ROUTE_ID = "place-service";
    static final String PLACE_SERVICE_PATH = "/api/places/**";
    static final String ROUTES_SERVICE_ROUTE_ID = "place-service-routes";
    static final String ROUTES_SERVICE_ROOT_PATH = "/api/routes";
    static final String ROUTES_SERVICE_PATH = "/api/routes/**";
    static final String PLACE_SERVICE_URI = "lb://place-service";

    @Bean
    RouteLocator tripSenseRoutes(RouteLocatorBuilder routes) {
        return routes.routes()
                .route(PLACE_SERVICE_ROUTE_ID, route -> route
                        .path(PLACE_SERVICE_PATH)
                        .uri(PLACE_SERVICE_URI))
                .route(ROUTES_SERVICE_ROUTE_ID, route -> route
                        .path(ROUTES_SERVICE_ROOT_PATH, ROUTES_SERVICE_PATH)
                        .uri(PLACE_SERVICE_URI))
                .build();
    }
}
