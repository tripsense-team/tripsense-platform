package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.ManagementClaimDto;
import fu.tripsense.tripservice.partner.dto.ManagementClaimRequest;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.entity.PartnerManagementClaim;
import fu.tripsense.tripservice.partner.enums.ManagementClaimState;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessMemberRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.partner.repository.PartnerManagementClaimRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PartnerClaimService {

  private final PartnerManagementClaimRepository claimRepository;
  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;

  @Transactional
  public ManagementClaimDto createClaim(AuthenticatedUser user, ManagementClaimRequest request) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    PartnerBusiness business =
        businessRepository
            .findById(request.businessId())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "BUSINESS_NOT_FOUND", "Target business not found", HttpStatus.NOT_FOUND));

    if (memberRepository.existsByIdBusinessIdAndIdUserIdAndState(
        request.businessId(), user.id(), MembershipState.ACTIVE)) {
      throw new TripServiceException(
          "ALREADY_MEMBER",
          "You are already an active member of this business",
          HttpStatus.CONFLICT);
    }

    if (claimRepository.existsByApplicantUserIdAndTargetBusinessIdAndStateIn(
        user.id(),
        request.businessId(),
        Set.of(
            ManagementClaimState.DRAFT,
            ManagementClaimState.SUBMITTED,
            ManagementClaimState.UNDER_REVIEW))) {
      throw new TripServiceException(
          "DUPLICATE_CLAIM",
          "You already have an active or pending claim for this business",
          HttpStatus.CONFLICT);
    }

    PartnerManagementClaim claim =
        PartnerManagementClaim.builder()
            .applicantUserId(user.id())
            .targetBusinessId(request.businessId())
            .reason(request.reason() != null ? request.reason().trim() : "")
            .state(ManagementClaimState.SUBMITTED)
            .build();

    claim = claimRepository.save(claim);
    return toDto(claim);
  }

  @Transactional(readOnly = true)
  public List<ManagementClaimDto> getMyClaims(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    return claimRepository.findByApplicantUserId(user.id()).stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public ManagementClaimDto getClaim(AuthenticatedUser user, UUID claimId) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerManagementClaim claim =
        claimRepository
            .findById(claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));

    if (!claim.getApplicantUserId().equals(user.id()) && !user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "You do not have access to view this claim", HttpStatus.FORBIDDEN);
    }
    return toDto(claim);
  }

  @Transactional
  public ManagementClaimDto submitClaim(
      AuthenticatedUser user, UUID claimId, Long expectedVersion) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerManagementClaim claim =
        claimRepository
            .findById(claimId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "CLAIM_NOT_FOUND", "Management claim not found", HttpStatus.NOT_FOUND));

    if (!claim.getApplicantUserId().equals(user.id())) {
      throw new TripServiceException(
          "FORBIDDEN", "Only applicant can submit this claim", HttpStatus.FORBIDDEN);
    }

    if (expectedVersion != null && !Objects.equals(claim.getVersion(), expectedVersion)) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Claim version conflict", HttpStatus.CONFLICT);
    }

    if (claim.getState() != ManagementClaimState.DRAFT) {
      throw new TripServiceException(
          "INVALID_STATE", "Claim is not in DRAFT state", HttpStatus.CONFLICT);
    }

    claim.setState(ManagementClaimState.SUBMITTED);
    claim = claimRepository.save(claim);
    return toDto(claim);
  }

  private ManagementClaimDto toDto(PartnerManagementClaim c) {
    return ManagementClaimDto.builder()
        .id(c.getId())
        .applicantUserId(c.getApplicantUserId())
        .targetBusinessId(c.getTargetBusinessId())
        .reason(c.getReason())
        .state(c.getState())
        .version(c.getVersion())
        .decisionOutcome(c.getDecisionOutcome())
        .decisionReason(c.getDecisionReason())
        .decidedBy(c.getDecidedBy())
        .decidedAt(c.getDecidedAt())
        .createdAt(c.getCreatedAt())
        .updatedAt(c.getUpdatedAt())
        .build();
  }
}
