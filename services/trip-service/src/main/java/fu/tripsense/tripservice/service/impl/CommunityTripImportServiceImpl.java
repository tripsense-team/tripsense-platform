package fu.tripsense.tripservice.service.impl;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.*;
import fu.tripsense.tripservice.dto.request.ImportCommunityTripRequest;
import fu.tripsense.tripservice.dto.response.ImportedTripResponse;
import fu.tripsense.tripservice.exception.*;
import fu.tripsense.tripservice.repository.TripCommunityImportReceiptRepository;
import fu.tripsense.tripservice.service.CommunityTripImportService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataIntegrityViolationException;

@Service
@RequiredArgsConstructor
public class CommunityTripImportServiceImpl implements CommunityTripImportService {
  private final CommunityTripImportClient client;
  private final TripCommunityImportReceiptRepository receipts;
  private final CommunityTripImportWriter writer;
  private final ObjectMapper objectMapper;

  @Override
  public ImportedTripResponse importTrip(
      UUID userId,
      String bearerToken,
      UUID postId,
      UUID idempotencyKey,
      ImportCommunityTripRequest request) {
    validateRequest(request);
    String requestFingerprint = requestFingerprint(postId, request);
    var existing = receipts.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
    if (existing.isPresent()) {
      if (!MessageDigest.isEqual(
          existing.get().getRequestFingerprint().getBytes(StandardCharsets.UTF_8),
          requestFingerprint.getBytes(StandardCharsets.UTF_8))) {
        throw new ConflictException(
            "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key was used for another import request");
      }
      return writer.response(existing.get());
    }

    CommunityTripImportProjection projection = client.fetch(postId, bearerToken);
    validateProjection(postId, projection, request);
    try {
      return writer.write(userId, postId, idempotencyKey, requestFingerprint, request, projection);
    } catch (DataIntegrityViolationException exception) {
      var winner = receipts.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
      if (winner.isPresent() && winner.get().getRequestFingerprint().equals(requestFingerprint)) {
        return writer.response(winner.get());
      }
      throw new ConflictException(
          "IDEMPOTENCY_KEY_CONFLICT", "Idempotency key was used for another import request");
    }
  }

  private void validateRequest(ImportCommunityTripRequest request) {
    if (request == null
        || request.name() == null
        || request.name().isBlank()
        || request.name().trim().length() > 160
        || request.startDate() == null
        || request.endDate() == null) {
      throw new ValidationException(
          "VALIDATION_FAILED", "Name, startDate and endDate are required");
    }
    if (request.startDate().isAfter(request.endDate())) {
      throw new ValidationException("INVALID_DATE_RANGE", "startDate must be on or before endDate");
    }
  }

  private void validateProjection(
      UUID expectedPostId,
      CommunityTripImportProjection projection,
      ImportCommunityTripRequest request) {
    if (projection == null
        || !expectedPostId.equals(projection.postId())
        || projection.schemaVersion() != 1
        || projection.snapshot() == null
        || projection.snapshot().schemaVersion() != 1
        || projection.snapshot().summary() == null
        || projection.snapshot().summary().destinationName() == null
        || projection.snapshot().summary().destinationName().isBlank()
        || projection.snapshot().summary().destinationName().length() > 255
        || projection.snapshot().summary().coverImageUrl() != null
            && projection.snapshot().summary().coverImageUrl().length() > 2048
        || projection.snapshot().days() == null
        || projection.snapshot().days().isEmpty()
        || projection.snapshot().days().size() > 60
        || projection.payloadSha256() == null
        || !projection.payloadSha256().matches("[0-9a-f]{64}")) {
      throw notImportable();
    }
    var snapshot = projection.snapshot();
    long requestedDays = ChronoUnit.DAYS.between(request.startDate(), request.endDate()) + 1;
    if (requestedDays != snapshot.summary().dayCount()
        || snapshot.summary().dayCount() != snapshot.days().size()
        || snapshot.summary().itineraryItemCount() < 0
        || snapshot.summary().itineraryItemCount() > 300) {
      throw new TripServiceException(
          "IMPORT_LIMIT_EXCEEDED",
          "Selected date range must match the published trip duration",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }
    int itemCount = 0;
    for (int dayIndex = 0; dayIndex < snapshot.days().size(); dayIndex++) {
      var day = snapshot.days().get(dayIndex);
      if (day == null || day.dayNumber() != dayIndex + 1 || day.items() == null || day.items().size() > 50) {
        throw notImportable();
      }
      itemCount += day.items().size();
      for (int itemIndex = 0; itemIndex < day.items().size(); itemIndex++) {
        var item = day.items().get(itemIndex);
        if (item == null
            || item.order() != itemIndex + 1
            || item.title() == null
            || item.title().isBlank()
            || item.title().length() > 200
            || !Set.of("PLACE", "MEAL", "ACTIVITY", "HOTEL", "FLIGHT", "TRANSFER")
                .contains(item.type())
            || item.durationMinutes() != null
                && (item.durationMinutes() < 1 || item.durationMinutes() > 1440)
            || item.placeName() != null && item.placeName().length() > 255) {
          throw notImportable();
        }
      }
    }
    if (itemCount != snapshot.summary().itineraryItemCount()) throw notImportable();
    try {
      byte[] canonical =
          objectMapper
              .copy()
              .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
              .writeValueAsBytes(snapshot);
      String computed = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
      if (!computed.equals(projection.payloadSha256())) throw notImportable();
    } catch (TripServiceException exception) {
      throw exception;
    } catch (Exception exception) {
      throw notImportable();
    }
  }

  private String requestFingerprint(UUID postId, ImportCommunityTripRequest request) {
    try {
      String normalized =
          postId + "|" + request.name().trim() + "|" + request.startDate() + "|" + request.endDate();
      return HexFormat.of().formatHex(
          MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Import request fingerprint unavailable", exception);
    }
  }

  private TripServiceException notImportable() {
    return new TripServiceException(
        "SHARE_NOT_IMPORTABLE", "Shared trip cannot be imported", HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
