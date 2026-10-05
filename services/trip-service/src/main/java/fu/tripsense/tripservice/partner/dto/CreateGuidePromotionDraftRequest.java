package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.IndicativePriceUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record CreateGuidePromotionDraftRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String summary,
    @NotBlank String areaId,
    @NotEmpty List<String> topicIds,
    @NotEmpty List<String> skillIds,
    String experienceDuration,
    List<String> inclusions,
    List<String> exclusions,
    BigDecimal indicativePriceAmount,
    String indicativePriceCurrency,
    @NotNull IndicativePriceUnit indicativePriceUnit,
    String coverImageRef,
    List<String> galleryImageRefs
) {}
