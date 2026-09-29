package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.DocumentScanState;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class PartnerDocumentServiceTest {

  @Mock private PartnerDocumentRepository documentRepository;
  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;
  @Mock private PartnerManagementClaimRepository claimRepository;

  @InjectMocks private PartnerDocumentService documentService;

  private AuthenticatedUser ownerUser;
  private AuthenticatedUser otherUser;
  private AuthenticatedUser adminUser;
  private UUID ownerId;
  private UUID businessId;
  private UUID claimId;

  @BeforeEach
  void setUp() {
    ownerId = UUID.randomUUID();
    ownerUser = new AuthenticatedUser(ownerId, "owner@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    otherUser = new AuthenticatedUser(UUID.randomUUID(), "other@example.com", "ROLE_USER", List.of("ROLE_USER"));
    adminUser = new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.com", "ROLE_ADMIN", List.of("ROLE_ADMIN"));
    businessId = UUID.randomUUID();
    claimId = UUID.randomUUID();
  }

  @Test
  @DisplayName("createBusinessUploadIntent: creates pending document with server-owned key and signed url")
  void createBusinessUploadIntent_success() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    when(documentRepository.findByBusinessId(businessId)).thenReturn(List.of());
    when(documentRepository.save(any(PartnerDocument.class))).thenAnswer(inv -> inv.getArgument(0));

    DocumentUploadIntentRequest req =
        new DocumentUploadIntentRequest("license.pdf", "application/pdf", 1024L * 1024L);

    DocumentUploadIntentResponse res = documentService.createBusinessUploadIntent(ownerUser, businessId, req);

    assertThat(res).isNotNull();
    assertThat(res.documentId()).isNotNull();
    assertThat(res.objectKey()).contains("partners/documents/business/" + businessId);
    assertThat(res.uploadUrl()).contains(res.objectKey());
    assertThat(res.expiresAt()).isNotNull();
  }

  @Test
  @DisplayName("createBusinessUploadIntent: rejects unsupported MIME type with 400")
  void createBusinessUploadIntent_invalidMime_badRequest() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    DocumentUploadIntentRequest req =
        new DocumentUploadIntentRequest("malicious.exe", "application/octet-stream", 1024L);

    assertThatThrownBy(() -> documentService.createBusinessUploadIntent(ownerUser, businessId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");
          assertThat(tse.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        });
  }

  @Test
  @DisplayName("createBusinessUploadIntent: rejects file exceeding 10 MiB with 400")
  void createBusinessUploadIntent_tooLarge_badRequest() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    long overLimit = 11L * 1024L * 1024L;
    DocumentUploadIntentRequest req =
        new DocumentUploadIntentRequest("big.png", "image/png", overLimit);

    assertThatThrownBy(() -> documentService.createBusinessUploadIntent(ownerUser, businessId, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("FILE_TOO_LARGE");
          assertThat(tse.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        });
  }

  @Test
  @DisplayName("completeBusinessUpload: transitions PENDING document to CLEAN and records content hash")
  void completeBusinessUpload_success() {
    when(memberRepository.findByIdBusinessIdAndIdUserId(businessId, ownerId))
        .thenReturn(Optional.of(PartnerBusinessMember.builder()
            .id(new PartnerBusinessMemberId(businessId, ownerId))
            .role(MembershipRole.OWNER)
            .state(MembershipState.ACTIVE)
            .build()));

    UUID docId = UUID.randomUUID();
    PartnerDocument doc =
        PartnerDocument.builder()
            .id(docId)
            .businessId(businessId)
            .objectKey("partners/documents/business/" + businessId + "/" + docId)
            .fileName("license.pdf")
            .mimeType("application/pdf")
            .fileSizeBytes(5000L)
            .scanState(DocumentScanState.PENDING)
            .build();

    when(documentRepository.findByIdAndBusinessId(docId, businessId)).thenReturn(Optional.of(doc));
    when(documentRepository.save(any(PartnerDocument.class))).thenAnswer(inv -> inv.getArgument(0));

    DocumentDetailDto result = documentService.completeBusinessUpload(ownerUser, businessId, docId);

    assertThat(result.scanState()).isEqualTo(DocumentScanState.CLEAN);
    assertThat(doc.getContentHash()).isNotEmpty();
  }

  @Test
  @DisplayName("getClaimDocumentAccess: enforces strict isolation; claimant and admin can access, outsiders forbidden")
  void getClaimDocumentAccess_isolation() {
    UUID docId = UUID.randomUUID();
    PartnerManagementClaim claim =
        PartnerManagementClaim.builder()
            .id(claimId)
            .applicantUserId(ownerId)
            .targetBusinessId(businessId)
            .build();

    PartnerDocument doc =
        PartnerDocument.builder()
            .id(docId)
            .claimId(claimId)
            .objectKey("partners/documents/claim/" + claimId + "/" + docId)
            .fileName("deed.pdf")
            .mimeType("application/pdf")
            .fileSizeBytes(10000L)
            .scanState(DocumentScanState.CLEAN)
            .build();

    when(claimRepository.findById(claimId)).thenReturn(Optional.of(claim));
    when(documentRepository.findByIdAndClaimId(docId, claimId)).thenReturn(Optional.of(doc));

    // Claimant access: Allowed
    DocumentAccessResponse res = documentService.getClaimDocumentAccess(ownerUser, claimId, docId);
    assertThat(res.accessUrl()).contains(doc.getObjectKey());

    // Admin access: Allowed
    DocumentAccessResponse adminRes = documentService.getClaimDocumentAccess(adminUser, claimId, docId);
    assertThat(adminRes.accessUrl()).contains(doc.getObjectKey());

    // Outsider access: Forbidden (403)
    assertThatThrownBy(() -> documentService.getClaimDocumentAccess(otherUser, claimId, docId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("FORBIDDEN");
          assertThat(tse.status()).isEqualTo(HttpStatus.FORBIDDEN);
        });
  }
}
