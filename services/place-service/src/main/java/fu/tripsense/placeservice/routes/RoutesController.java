package fu.tripsense.placeservice.routes;

import fu.tripsense.placeservice.routes.RouteModels.RouteRequest;
import fu.tripsense.placeservice.routes.RouteModels.RouteResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/routes")
public class RoutesController {

    private final RouteService routeService;

    public RoutesController(RouteService routeService) {
        this.routeService = routeService;
    }

    @PostMapping
    RouteResponse route(@RequestBody RouteRequest request) {
        return routeService.route(request);
    }
}
