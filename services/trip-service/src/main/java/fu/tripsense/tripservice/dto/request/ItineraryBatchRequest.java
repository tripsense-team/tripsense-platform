package fu.tripsense.tripservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ItineraryBatchRequest(
        @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String proposalId,
        @NotBlank @Pattern(regexp = "^[a-f0-9]{64}$") String proposalHash,
        @NotNull Long expectedTripRevision,
        @NotBlank @Pattern(regexp = "FULL|SELECTED_DAYS") String scope,
        @NotEmpty @Size(max = 200) List<@Valid ItineraryBatchOperation> operations
) {
}
