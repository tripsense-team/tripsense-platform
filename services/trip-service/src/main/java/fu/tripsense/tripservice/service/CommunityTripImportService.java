package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.ImportCommunityTripRequest;
import fu.tripsense.tripservice.dto.response.ImportedTripResponse;
import java.util.UUID;

public interface CommunityTripImportService {
  ImportedTripResponse importTrip(
      UUID userId,
      String bearerToken,
      UUID postId,
      UUID idempotencyKey,
      ImportCommunityTripRequest request);
}
