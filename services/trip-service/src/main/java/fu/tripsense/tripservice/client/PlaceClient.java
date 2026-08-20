package fu.tripsense.tripservice.client;

import fu.tripsense.tripservice.exception.PlaceValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PlaceClient {

    private final RestClient.Builder restClientBuilder;

    @Value("${place-service.url}")
    private String placeServiceUrl;

    public PlaceSnapshot validatePlace(UUID placeId) {
        try {
            PlaceSnapshot snapshot = restClientBuilder.build()
                    .get()
                    .uri(placeServiceUrl + "/api/places/{placeId}", placeId)
                    .retrieve()
                    .body(PlaceSnapshot.class);
            if (snapshot == null) {
                throw new PlaceValidationException("PLACE_NOT_FOUND", "Place not found");
            }
            return snapshot;
        } catch (PlaceValidationException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new PlaceValidationException("PLACE_SERVICE_UNAVAILABLE", "Place Service is unavailable");
        }
    }
}
