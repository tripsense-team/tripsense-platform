package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Private evidence is unavailable until trusted object verification and scanning are integrated.
 * Never issue unverifiable signed URLs or label client-reported objects CLEAN. */
@Service
public class PartnerDocumentService {
  private TripServiceException unavailable() {
    return new TripServiceException("DOCUMENT_STORAGE_UNAVAILABLE",
        "Private document storage is not available in this demo. Do not upload personal documents.",
        HttpStatus.SERVICE_UNAVAILABLE);
  }
  public DocumentUploadIntentResponse createBusinessUploadIntent(AuthenticatedUser user,UUID businessId,DocumentUploadIntentRequest request) { throw unavailable(); }
  public DocumentDetailDto completeBusinessUpload(AuthenticatedUser user,UUID businessId,UUID documentId) { throw unavailable(); }
  public DocumentAccessResponse getBusinessDocumentAccess(AuthenticatedUser user,UUID businessId,UUID documentId) { throw unavailable(); }
  public DocumentUploadIntentResponse createClaimUploadIntent(AuthenticatedUser user,UUID claimId,DocumentUploadIntentRequest request) { throw unavailable(); }
  public DocumentDetailDto completeClaimUpload(AuthenticatedUser user,UUID claimId,UUID documentId) { throw unavailable(); }
  public DocumentAccessResponse getClaimDocumentAccess(AuthenticatedUser user,UUID claimId,UUID documentId) { throw unavailable(); }
}
