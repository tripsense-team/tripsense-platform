package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Builder;

@Builder
public record BusinessDetailDto(
    UUID id,
    BusinessKind kind,
    UUID ownerUserId,
    String displayName,
    Map<String, Object> draftProfile,
    Integer draftSchemaVersion,
    ApprovalValidity approvalValidity,
    OperationState operationState,
    PublicationState publicationState,
    boolean acceptingNew,
    boolean requiresReverification,
    UUID reverificationApplicationId,
    int suspensionVersion,
    Instant suspendedAt,
    Instant reinstatedAt,
    UUID approvedRevisionId,
    Long version,
    String contactConsentVersion,
    MembershipRole myRole,
    List<PartnerCapability> capabilities,
    ApplicationState latestApplicationState,
    boolean publicEligible,
    boolean newIntakeEligible,
    Instant createdAt,
    Instant updatedAt
) {}
