package fu.tripsense.tripservice.partner.service;

import static org.junit.jupiter.api.Assertions.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.DocumentUploadIntentRequest;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PartnerDocumentServiceTest {
  private final PartnerDocumentService service = new PartnerDocumentService();
  private final UUID id = UUID.randomUUID();
  private final AuthenticatedUser user = new AuthenticatedUser(id, "user@example.test", "ROLE_PARTNER");

  private void unavailable(org.junit.jupiter.api.function.Executable operation) {
    var error = assertThrows(TripServiceException.class, operation);
    assertEquals("DOCUMENT_STORAGE_UNAVAILABLE", error.code());
    assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.status());
  }

  @Test void businessDocumentOperationsFailClosed() {
    unavailable(() -> service.createBusinessUploadIntent(user,id,new DocumentUploadIntentRequest("private.pdf","application/pdf",1024L)));
    unavailable(() -> service.completeBusinessUpload(user,id,id));
    unavailable(() -> service.getBusinessDocumentAccess(user,id,id));
  }

  @Test void claimDocumentOperationsFailClosed() {
    unavailable(() -> service.createClaimUploadIntent(user,id,new DocumentUploadIntentRequest("private.pdf","application/pdf",1024L)));
    unavailable(() -> service.completeClaimUpload(user,id,id));
    unavailable(() -> service.getClaimDocumentAccess(user,id,id));
  }
}
