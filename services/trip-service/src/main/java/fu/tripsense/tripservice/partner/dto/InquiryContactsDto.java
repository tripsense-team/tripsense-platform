package fu.tripsense.tripservice.partner.dto;

import java.util.UUID;

public record InquiryContactsDto(
    UUID inquiryId,
    UUID counterpartyUserId,
    String email,
    boolean emailConsented,
    String phone,
    boolean phoneConsented,
    String notice
) {}
