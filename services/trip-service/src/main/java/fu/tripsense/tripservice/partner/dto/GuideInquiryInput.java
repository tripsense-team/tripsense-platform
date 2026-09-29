package fu.tripsense.tripservice.partner.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GuideInquiryInput(
    UUID promotionId,
    @NotNull UUID expectedSourceRevisionId,
    UUID sourceCommunityPostId,
    @NotBlank String areaId,
    @NotEmpty List<String> topicIds,
    List<String> requiredSkillIds,
    @NotBlank String languageCode,
    @NotNull LocalDate dateFrom,
    @NotNull LocalDate dateTo,
    @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", message = "Invalid time format (HH:mm)")
        String preferredStartTime,
    @NotBlank String timeZone,
    @Min(30) @Max(1440) int durationMinutes,
    @Min(1) @Max(30) int adults,
    @Min(0) @Max(30) int children,
    @NotBlank @Size(max = 4000) String goals,
    @Size(max = 2000) String supportNotes,
    BudgetRange budgetVnd
) {}
