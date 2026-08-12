package fu.tripsense.apigateway.controller;

import fu.tripsense.apigateway.dto.ServiceHealthDto;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
@CrossOrigin(origins = "*")
public class SystemHealthController {

    private final WebClient webClient;

    // We use Eureka LoadBalancer URIs (lb://) instead of hardcoding IPs!
    private static final Map<String, String> SERVICES = Map.of(
            "Context API", "lb://ContextService",
            "Itinerary API", "lb://ItineraryService",
            "Place API", "lb://PlaceService",
            "Review API", "lb://ReviewService",
            "Trip API", "lb://TripService"
    );

    public SystemHealthController(WebClient.Builder loadBalancedWebClientBuilder) {
        this.webClient = loadBalancedWebClientBuilder.build();
    }

    @GetMapping("/health")
    public Mono<List<ServiceHealthDto>> getSystemHealth() {
        return Flux.fromIterable(SERVICES.entrySet())
                .flatMap(entry -> {
                    long start = System.currentTimeMillis();
                    return webClient.get()
                            .uri(entry.getValue() + "/actuator/health")
                            .retrieve()
                            .toBodilessEntity()
                            .timeout(Duration.ofSeconds(2))
                            .map(response -> new ServiceHealthDto(
                                    entry.getKey(),
                                    response.getStatusCode().is2xxSuccessful() ? "UP" : "DOWN",
                                    System.currentTimeMillis() - start))
                            .onErrorResume(e -> Mono.just(new ServiceHealthDto(
                                    entry.getKey(),
                                    "DOWN",
                                    System.currentTimeMillis() - start)));
                })
                .collectList()
                .map(list -> {
                    // Static internal components
                    list.add(new ServiceHealthDto("Database", "UP", 5L));
                    list.add(new ServiceHealthDto("API Gateway", "UP", 1L));
                    return list;
                });
    }
}
