package fu.tripsense.userservice.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record PublicProfileBatchRequest(@NotEmpty @Size(max = 50) List<UUID> userIds) {}
