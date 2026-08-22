package fu.tripsense.apigateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class ApiGatewayApplicationTests {

    @Autowired
    private RouteLocator routeLocator;

    @Test
    void contextLoads() {
    }

    @Test
    void placeServiceRouteUsesDiscoveryLoadBalancer() {
        List<Route> routes = routeLocator.getRoutes().collectList().block();

        assertThat(routes)
                .isNotNull()
                .anySatisfy(route -> {
                    assertThat(route.getId()).isEqualTo(GatewayRoutesConfig.PLACE_SERVICE_ROUTE_ID);
                    assertThat(route.getUri()).isEqualTo(URI.create("lb://place-service"));
                });
    }

    @Test
    void tripServiceRouteUsesDiscoveryLoadBalancer() {
        List<Route> routes = routeLocator.getRoutes().collectList().block();

        assertThat(routes)
                .isNotNull()
                .anySatisfy(route -> {
                    assertThat(route.getId()).isEqualTo(GatewayRoutesConfig.TRIP_SERVICE_ROUTE_ID);
                    assertThat(route.getUri()).isEqualTo(URI.create("lb://trip-service"));
                });
    }

}
