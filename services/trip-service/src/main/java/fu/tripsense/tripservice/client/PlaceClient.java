package fu.tripsense.tripservice.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class PlaceClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${place-service.url:http://place-service:8082}")
    private String placeServiceUrl;

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlaceApiResponse(
            boolean success,
            PlaceApiData data
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlaceApiData(
            String id,
            String providerPlaceId,
            String name,
            PlaceLocation location,
            String address
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PlaceLocation(
            BigDecimal lat,
            BigDecimal lng
    ) {}

    public PlaceSnapshot validatePlace(UUID placeId) {
        if (placeId == null) {
            return null;
        }

        try {
            PlaceApiResponse envelope = restClientBuilder.build()
                    .get()
                    .uri(placeServiceUrl + "/api/places/{placeId}", placeId)
                    .retrieve()
                    .body(PlaceApiResponse.class);

            if (envelope == null || envelope.data() == null) {
                log.warn("Place not found for placeId: {}", placeId);
                return new PlaceSnapshot(placeId, null, null, null, null);
            }

            PlaceApiData data = envelope.data();
            BigDecimal lat = data.location() != null ? data.location().lat() : null;
            BigDecimal lng = data.location() != null ? data.location().lng() : null;
            return new PlaceSnapshot(
                    placeId,
                    data.name(),
                    data.address(),
                    lat,
                    lng
            );
        } catch (Exception ex) {
            log.warn("Failed to validate place with place-service: {}. Continuing without snapshot.", ex.getMessage());
            return new PlaceSnapshot(placeId, null, null, null, null);
        }
    }
}
