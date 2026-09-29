package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.DocumentScanState;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerDocumentService {

  private static final Set<String> ALLOWED_MIME_TYPES =
      Set.of("image/jpeg", "image/png", "application/pdf");
  private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB

  private final PartnerDocumentRepository documentRepository;
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerManagementClaimRepository claimRepository;

  @Value("${tripsense.storage.base-url:https://storage.tripsense.local}")
  private String storageBaseUrl;

  @Transactional
  public DocumentUploadIntentResponse createBusinessUploadIntent(
      AuthenticatedUser user, UUID businessId, DocumentUploadIntentRequest request) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    validateUploadRequest(request);

    List<PartnerDocument> existing = documentRepository.findByBusinessId(businessId);
    if (existing.size() >= 10) {
      throw new TripServiceException(
          "DOCUMENT_LIMIT_EXCEEDED", "Maximum 10 documents allowed per business", HttpStatus.BAD_REQUEST);
    }

    UUID docId = UUID.randomUUID();
    String objectKey = "partners/documents/business/" + businessId + "/" + docId;
    Instant expiresAt = Instant.now().plus(15, ChronoUnit.MINUTES);

    PartnerDocument doc =
        PartnerDocument.builder()
            .id(docId)
            .businessId(businessId)
            .uploadedBy(user.id())
            .objectKey(objectKey)
            .fileName(request.fileName().trim())
            .mimeType(request.mimeType().trim().toLowerCase(Locale.ROOT))
            .fileSizeBytes(request.fileSizeBytes())
            .scanState(DocumentScanState.PENDING)
            .build();

    documentRepository.save(doc);

    String uploadUrl = "%s/upload/%s?token=%s".formatted(storageBaseUrl, objectKey, generateSignedToken(objectKey, expiresAt));
    return DocumentUploadIntentResponse.builder()
        .documentId(docId)
        .uploadUrl(uploadUrl)
        .objectKey(objectKey)
        .expiresAt(expiresAt)
        .build();
  }

  @Transactional
  public DocumentDetailDto completeBusinessUpload(
      AuthenticatedUser user, UUID businessId, UUID documentId) {
    requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    PartnerDocument doc =
        documentRepository
            .findByIdAndBusinessId(documentId, businessId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "DOCUMENT_NOT_FOUND", "Document not found for business", HttpStatus.NOT_FOUND));

    if (doc.getScanState() != DocumentScanState.PENDING) {
      throw new TripServiceException(
          "INVALID_SCAN_STATE", "Document is not in PENDING state", HttpStatus.CONFLICT);
    }

    doc.setScanState(DocumentScanState.CLEAN);
    doc.setContentHash(hashString(doc.getObjectKey() + doc.getFileSizeBytes()));
    doc = documentRepository.save(doc);

    return toDto(doc);
  }

  @Transactional(readOnly = true)
  public DocumentAccessResponse getBusinessDocumentAccess(
      AuthenticatedUser user, UUID businessId, UUID documentId) {
    if (!user.isAdmin()) {
      requireMemberRole(businessId, user.id(), MembershipRole.OWNER);
    }

    PartnerDocument doc =
        documentRepository
            .findByIdAndBusinessId(documentId, businessId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "DOCUMENT_NOT_FOUND", "Document not found for business", HttpStatus.NOT_FOUND));

    Instant expiresAt = Instant.now().plus(60, ChronoUnit.SECONDS); // TTL max 60s
    String accessUrl = "%s/read/%s?token=%s".formatted(storageBaseUrl, doc.getObjectKey(), generateSignedToken(doc.getObjectKey(), expiresAt));

    return DocumentAccessResponse.builder()
        .documentId(doc.getId())
        .accessUrl(accessUrl)
        .fileName(doc.getFileName())
        .mimeType(doc.getMimeType())
        .expiresAt(expiresAt)
        .build();
  }

  @Transactional
  public DocumentUploadIntentResponse createClaimUploadIntent(
      AuthenticatedUser user, UUID claimId, DocumentUploadIntentRequest request) {
    PartnerManagementClaim claim = getClaimForApplicant(claimId, user.id());
    validateUploadRequest(request);

    List<PartnerDocument> existing = documentRepository.findByClaimId(claimId);
    if (existing.size() >= 10) {
      throw new TripServiceException(
          "DOCUMENT_LIMIT_EXCEEDED", "Maximum 10 documents allowed per claim", HttpStatus.BAD_REQUEST);
    }

    UUID docId = UUID.randomUUID();
    String objectKey = "partners/documents/claim/" + claimId + "/" + docId;
    Instant expiresAt = Instant.now().plus(15, ChronoUnit.MINUTES);

    PartnerDocument doc =
        PartnerDocument.builder()
            .id(docId)
            .claimId(claimId)
            .uploadedBy(user.id())
            .objectKey(objectKey)
            .fileName(request.fileName().trim())
            .mimeType(request.mimeType().trim().toLowerCase(Locale.ROOT))
            .fileSizeBytes(request.fileSizeBytes())
            .scanState(DocumentScanState.PENDING)
            .build();

    documentRepository.save(doc);

    String uploadUrl = "%s/upload/%s?token=%s".formatted(storageBaseUrl, objectKey, generateSignedToken(objectKey, expiresAt));
    return DocumentUploadIntentResponse.builder()
        .documentId(docId)
        .uploadUrl(uploadUrl)
        .objectKey(objectKey)
        .expiresAt(expiresAt)
        .build();
  }

  @Transactional
  public DocumentDetailDto completeClaimUpload(
      AuthenticatedUser user, UUID claimId, UUID documentId) {
    getClaimForApplicant(claimId, user.id());
    PartnerDocument doc =
        documentRepository
            .findByIdAndClaimId(documentId, claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "DOCUMENT_NOT_FOUND", "Document not found for claim", HttpStatus.NOT_FOUND));

    if (doc.getScanState() != DocumentScanState.PENDING) {
      throw new TripServiceException(
          "INVALID_SCAN_STATE", "Document is not in PENDING state", HttpStatus.CONFLICT);
    }

    doc.setScanState(DocumentScanState.CLEAN);
    doc.setContentHash(hashString(doc.getObjectKey() + doc.getFileSizeBytes()));
    doc = documentRepository.save(doc);

    return toDto(doc);
  }

  @Transactional(readOnly = true)
  public DocumentAccessResponse getClaimDocumentAccess(
      AuthenticatedUser user, UUID claimId, UUID documentId) {
    PartnerManagementClaim claim =
        claimRepository
            .findById(claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));

    // Isolation: Only applicant or admin can view claim evidence!
    if (!claim.getApplicantUserId().equals(user.id()) && !user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "You do not have access to view evidence for this claim", HttpStatus.FORBIDDEN);
    }

    PartnerDocument doc =
        documentRepository
            .findByIdAndClaimId(documentId, claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "DOCUMENT_NOT_FOUND", "Document not found for claim", HttpStatus.NOT_FOUND));

    Instant expiresAt = Instant.now().plus(60, ChronoUnit.SECONDS);
    String accessUrl = "%s/read/%s?token=%s".formatted(storageBaseUrl, doc.getObjectKey(), generateSignedToken(doc.getObjectKey(), expiresAt));

    return DocumentAccessResponse.builder()
        .documentId(doc.getId())
        .accessUrl(accessUrl)
        .fileName(doc.getFileName())
        .mimeType(doc.getMimeType())
        .expiresAt(expiresAt)
        .build();
  }

  private void validateUploadRequest(DocumentUploadIntentRequest req) {
    if (req.mimeType() == null || !ALLOWED_MIME_TYPES.contains(req.mimeType().trim().toLowerCase(Locale.ROOT))) {
      throw new TripServiceException(
          "UNSUPPORTED_MEDIA_TYPE",
          "MIME type must be image/jpeg, image/png, or application/pdf",
          HttpStatus.BAD_REQUEST);
    }
    if (req.fileSizeBytes() == null || req.fileSizeBytes() <= 0 || req.fileSizeBytes() > MAX_FILE_SIZE) {
      throw new TripServiceException(
          "FILE_TOO_LARGE", "File size must be positive and not exceed 10 MiB", HttpStatus.BAD_REQUEST);
    }
  }

  private void requireMemberRole(UUID businessId, UUID userId, MembershipRole role) {
    boolean ok =
        memberRepository
            .findByIdBusinessIdAndIdUserId(businessId, userId)
            .filter(m -> m.getState() == MembershipState.ACTIVE)
            .map(m -> m.getRole() == role || m.getRole() == MembershipRole.OWNER)
            .orElse(false);
    if (!ok) {
      throw new TripServiceException(
          "FORBIDDEN", "Insufficient membership permissions for this business", HttpStatus.FORBIDDEN);
    }
  }

  private PartnerManagementClaim getClaimForApplicant(UUID claimId, UUID userId) {
    PartnerManagementClaim claim =
        claimRepository
            .findById(claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));
    if (!claim.getApplicantUserId().equals(userId)) {
      throw new TripServiceException(
          "FORBIDDEN", "Only the claimant can modify evidence for this claim", HttpStatus.FORBIDDEN);
    }
    return claim;
  }

  private DocumentDetailDto toDto(PartnerDocument d) {
    return DocumentDetailDto.builder()
        .id(d.getId())
        .businessId(d.getBusinessId())
        .claimId(d.getClaimId())
        .fileName(d.getFileName())
        .mimeType(d.getMimeType())
        .fileSizeBytes(d.getFileSizeBytes())
        .scanState(d.getScanState())
        .createdAt(d.getCreatedAt())
        .build();
  }

  private String generateSignedToken(String key, Instant expiresAt) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(
        hashString(key + ":" + expiresAt.getEpochSecond()).getBytes());
  }

  private String hashString(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] hash = md.digest(input.getBytes());
      return HexFormat.of().formatHex(hash);
    } catch (Exception e) {
      return UUID.randomUUID().toString();
    }
  }
}
