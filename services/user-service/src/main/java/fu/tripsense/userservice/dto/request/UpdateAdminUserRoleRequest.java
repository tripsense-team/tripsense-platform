package fu.tripsense.userservice.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpdateAdminUserRoleRequest(
    @NotBlank(message = "Role is required") String role) {}

