package fu.tripsense.userservice.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateAdminUserStatusRequest(
    @NotBlank(message = "Status is required") String status) {}

