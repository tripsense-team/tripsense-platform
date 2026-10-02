package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

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
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class PartnerClaimServiceTest {

  @Mock private PartnerManagementClaimRepository claimRepository;
  @Mock private PartnerBusinessRepository businessRepository;
  @Mock private PartnerBusinessMemberRepository memberRepository;

  @InjectMocks private PartnerClaimService claimService;

  private AuthenticatedUser claimantUser;
  private UUID claimantId;
  private UUID businessId;

  @BeforeEach
  void setUp() {
    claimantId = UUID.randomUUID();
    claimantUser = new AuthenticatedUser(claimantId, "claimant@example.com", "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"));
    businessId = UUID.randomUUID();
  }

  @Test
  @DisplayName("createClaim: creates claim with SUBMITTED state")
  void createClaim_success() {
    when(businessRepository.findById(businessId))
        .thenReturn(Optional.of(PartnerBusiness.builder().id(businessId).build()));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, claimantId, MembershipState.ACTIVE))
        .thenReturn(false);
    when(claimRepository.existsByApplicantUserIdAndTargetBusinessIdAndStateIn(eq(claimantId), eq(businessId), any()))
        .thenReturn(false);

    when(claimRepository.save(any(PartnerManagementClaim.class))).thenAnswer(inv -> {
      PartnerManagementClaim c = inv.getArgument(0);
      c.setId(UUID.randomUUID());
      return c;
    });

    ManagementClaimRequest req = new ManagementClaimRequest(businessId, "I am the real owner of this resort");

    ManagementClaimDto result = claimService.createClaim(claimantUser, req);

    assertThat(result).isNotNull();
    assertThat(result.targetBusinessId()).isEqualTo(businessId);
    assertThat(result.applicantUserId()).isEqualTo(claimantId);
    assertThat(result.state()).isEqualTo(ManagementClaimState.SUBMITTED);
  }

  @Test
  @DisplayName("createClaim: throws CONFLICT if user is already an active member")
  void createClaim_alreadyMember_conflict() {
    when(businessRepository.findById(businessId))
        .thenReturn(Optional.of(PartnerBusiness.builder().id(businessId).build()));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, claimantId, MembershipState.ACTIVE))
        .thenReturn(true);

    ManagementClaimRequest req = new ManagementClaimRequest(businessId, "Claiming my own hotel");

    assertThatThrownBy(() -> claimService.createClaim(claimantUser, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("ALREADY_MEMBER");
          assertThat(tse.status()).isEqualTo(HttpStatus.CONFLICT);
        });
  }

  @Test
  @DisplayName("createClaim: throws CONFLICT if duplicate pending claim exists")
  void createClaim_duplicateClaim_conflict() {
    when(businessRepository.findById(businessId))
        .thenReturn(Optional.of(PartnerBusiness.builder().id(businessId).build()));
    when(memberRepository.existsByIdBusinessIdAndIdUserIdAndState(businessId, claimantId, MembershipState.ACTIVE))
        .thenReturn(false);
    when(claimRepository.existsByApplicantUserIdAndTargetBusinessIdAndStateIn(eq(claimantId), eq(businessId), any()))
        .thenReturn(true);

    ManagementClaimRequest req = new ManagementClaimRequest(businessId, "Claiming duplicate");

    assertThatThrownBy(() -> claimService.createClaim(claimantUser, req))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("DUPLICATE_CLAIM");
          assertThat(tse.status()).isEqualTo(HttpStatus.CONFLICT);
        });
  }

  @Test
  @DisplayName("getClaim: forbidden if user is neither claimant nor admin")
  void getClaim_unauthorizedUser_forbidden() {
    UUID claimId = UUID.randomUUID();
    PartnerManagementClaim claim =
        PartnerManagementClaim.builder()
            .id(claimId)
            .applicantUserId(UUID.randomUUID())
            .targetBusinessId(businessId)
            .build();

    when(claimRepository.findById(claimId)).thenReturn(Optional.of(claim));

    assertThatThrownBy(() -> claimService.getClaim(claimantUser, claimId))
        .isInstanceOf(TripServiceException.class)
        .satisfies(e -> {
          TripServiceException tse = (TripServiceException) e;
          assertThat(tse.code()).isEqualTo("FORBIDDEN");
          assertThat(tse.status()).isEqualTo(HttpStatus.FORBIDDEN);
        });
  }
}
