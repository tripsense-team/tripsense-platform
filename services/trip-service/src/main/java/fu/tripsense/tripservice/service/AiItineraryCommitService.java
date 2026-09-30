package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.AiItineraryCommitRequest;
import fu.tripsense.tripservice.dto.response.AiItineraryCommitResponse;
import java.util.UUID;

public interface AiItineraryCommitService {
  AiItineraryCommitResponse commit(
      UUID userId, String idempotencyKey, String requestHash, AiItineraryCommitRequest request);
}
