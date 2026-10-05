package fu.tripsense.tripservice.partner.dto;

import java.util.List;

public record PartnerContextDto(
    String role,
    List<String> roles,
    List<BusinessDetailDto> businesses
) {}
