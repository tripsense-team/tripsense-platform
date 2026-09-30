package fu.tripsense.tripservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.dto.request.AiItineraryCommitRequest;
import fu.tripsense.tripservice.dto.response.AiItineraryCommitResponse;
import fu.tripsense.tripservice.dto.response.ApiResponse;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.security.AiCommitSignatureVerifier;
import fu.tripsense.tripservice.security.CurrentUserProvider;
import fu.tripsense.tripservice.service.AiItineraryCommitService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal/ai/itinerary-commits")
@RequiredArgsConstructor
public class AiItineraryCommitController {
  private final ObjectMapper objectMapper;
  private final Validator validator;
  private final CurrentUserProvider currentUserProvider;
  private final AiCommitSignatureVerifier signatureVerifier;
  private final AiItineraryCommitService commitService;

  @PostMapping
  public ApiResponse<AiItineraryCommitResponse> commit(
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      @RequestHeader("X-AI-Commit-Timestamp") String timestamp,
      @RequestHeader("X-AI-Commit-Body-Sha256") String bodyHash,
      @RequestHeader("X-AI-Commit-Signature") String signature,
      @RequestBody String rawBody) {
    String userId = currentUserProvider.userId().toString();
    signatureVerifier.verify(userId, idempotencyKey, timestamp, bodyHash, signature, rawBody);
    AiItineraryCommitRequest request;
    try {
      request = objectMapper.readValue(rawBody, AiItineraryCommitRequest.class);
    } catch (Exception exception) {
      throw new ValidationException("INVALID_AI_COMMIT", "AI commit payload is invalid");
    }
    Set<ConstraintViolation<AiItineraryCommitRequest>> violations = validator.validate(request);
    if (!violations.isEmpty()) {
      throw new ValidationException("INVALID_AI_COMMIT", "AI commit payload is invalid");
    }
    return ApiResponse.success(
        commitService.commit(currentUserProvider.userId(), idempotencyKey, bodyHash, request));
  }
}
