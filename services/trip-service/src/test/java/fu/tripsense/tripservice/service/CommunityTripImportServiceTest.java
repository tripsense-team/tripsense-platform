package fu.tripsense.tripservice.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.client.CommunityTripImportClient;
import fu.tripsense.tripservice.dto.request.ImportCommunityTripRequest;
import fu.tripsense.tripservice.exception.ValidationException;
import fu.tripsense.tripservice.repository.TripCommunityImportReceiptRepository;
import fu.tripsense.tripservice.service.impl.CommunityTripImportServiceImpl;
import fu.tripsense.tripservice.service.impl.CommunityTripImportWriter;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CommunityTripImportServiceTest {
  private final CommunityTripImportClient client = mock(CommunityTripImportClient.class);
  private final TripCommunityImportReceiptRepository receipts =
      mock(TripCommunityImportReceiptRepository.class);
  private final CommunityTripImportWriter writer = mock(CommunityTripImportWriter.class);
  private final CommunityTripImportServiceImpl service =
      new CommunityTripImportServiceImpl(client, receipts, writer, new ObjectMapper());

  @Test
  void rejectsInvalidDateRangeBeforeCallingSocial() {
    var request =
        new ImportCommunityTripRequest(
            "My trip", LocalDate.of(2026, 12, 10), LocalDate.of(2026, 12, 9));

    assertThatThrownBy(
            () ->
                service.importTrip(
                    UUID.randomUUID(),
                    "token",
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    request))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("startDate");
    verifyNoInteractions(client, receipts, writer);
  }
}
