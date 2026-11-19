package fu.tripsense.userservice.controller;

import fu.tripsense.userservice.dto.request.UpdateAdminUserRoleRequest;
import fu.tripsense.userservice.dto.request.UpdateAdminUserStatusRequest;
import fu.tripsense.userservice.dto.response.AdminUserItemDto;
import fu.tripsense.userservice.dto.response.AdminUserPageResponseDto;
import fu.tripsense.userservice.dto.response.ApiResponse;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.service.AdminUserManagementService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users/admin/users")
@RequiredArgsConstructor
public class AdminUserManagementController {

  private final AdminUserManagementService adminUserManagementService;

  @GetMapping
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<ApiResponse<AdminUserPageResponseDto>> listUsers(
      @AuthenticationPrincipal User currentUser,
      @RequestParam(name = "page", defaultValue = "0") int page,
      @RequestParam(name = "size", defaultValue = "20") int size,
      @RequestParam(name = "search", required = false) String search,
      @RequestParam(name = "role", required = false) String role,
      @RequestParam(name = "status", required = false) String status) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Users fetched successfully",
            adminUserManagementService.listUsers(currentUser, page, size, search, role, status)));
  }

  @PatchMapping("/{userId}/status")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<ApiResponse<AdminUserItemDto>> updateUserStatus(
      @AuthenticationPrincipal User currentUser,
      @PathVariable UUID userId,
      @Valid @RequestBody UpdateAdminUserStatusRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "User status updated successfully",
            adminUserManagementService.updateUserStatus(currentUser, userId, request.status())));
  }

  @PatchMapping("/{userId}/role")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<ApiResponse<AdminUserItemDto>> updateUserRole(
      @AuthenticationPrincipal User currentUser,
      @PathVariable UUID userId,
      @Valid @RequestBody UpdateAdminUserRoleRequest request) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "User role updated successfully",
            adminUserManagementService.updateUserRole(currentUser, userId, request.role())));
  }
}

