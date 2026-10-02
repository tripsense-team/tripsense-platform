package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PublicationState;
import java.util.UUID;
import lombok.Builder;

@Builder
public record PartnerCandidateDto(
    UUID id,
    BusinessKind kind,
    String displayName,
    PublicationState publicationState,
    String destination,
    String address
) {}
