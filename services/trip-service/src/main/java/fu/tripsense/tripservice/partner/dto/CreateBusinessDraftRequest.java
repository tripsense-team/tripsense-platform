package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.BusinessKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateBusinessDraftRequest(
    @NotNull BusinessKind kind,
    @NotBlank String displayName,
    Map<String, Object> draftProfile
) {}
