package fu.tripsense.placeservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCollectionRequest(@NotBlank @Size(max = 80) String name) {}
