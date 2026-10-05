package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.MembershipRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MemberInvitationRequest(
    @NotBlank @Email String email,
    @NotNull MembershipRole role,
    Integer expiryDays
) {}
