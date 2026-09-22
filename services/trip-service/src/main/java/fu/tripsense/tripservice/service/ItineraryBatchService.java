package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.ItineraryBatchRequest;
import fu.tripsense.tripservice.dto.response.ItineraryBatchResponse;

import java.util.UUID;

public interface ItineraryBatchService {
    ItineraryBatchResponse apply(UUID ownerUserId, UUID tripId, String idempotencyKey, ItineraryBatchRequest request);
}
