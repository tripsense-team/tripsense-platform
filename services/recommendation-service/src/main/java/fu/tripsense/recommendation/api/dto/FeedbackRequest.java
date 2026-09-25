package fu.tripsense.recommendation.api.dto;

import fu.tripsense.recommendation.domain.FeedbackEventType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;

public record FeedbackRequest(
    @NotBlank @Pattern(regexp = "[A-Za-z0-9._:-]{1,200}") String placeId,
    @NotNull FeedbackEventType eventType,
    @Min(1) int position,
    @NotNull @PastOrPresent Instant occurredAt) {}
