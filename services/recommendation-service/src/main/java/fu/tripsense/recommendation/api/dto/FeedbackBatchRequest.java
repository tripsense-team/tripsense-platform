package fu.tripsense.recommendation.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record FeedbackBatchRequest(
    @NotEmpty @Size(max = 50) List<@Valid FeedbackBatchItemRequest> events) {}
