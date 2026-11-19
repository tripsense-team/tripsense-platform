package fu.tripsense.userservice.dto.response;

import java.util.List;

public record AdminUserPageResponseDto(
    List<AdminUserItemDto> items,
    int page,
    int size,
    long totalElements,
    int totalPages,
    AdminUserSummaryDto summary) {

  public record AdminUserSummaryDto(
      long totalUsers, long activeUsers, long inactiveUsers, long unverifiedUsers) {}
}

