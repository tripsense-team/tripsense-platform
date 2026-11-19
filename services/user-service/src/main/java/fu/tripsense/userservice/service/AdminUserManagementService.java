package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.response.AdminUserItemDto;
import fu.tripsense.userservice.dto.response.AdminUserPageResponseDto;
import fu.tripsense.userservice.dto.response.AdminUserPageResponseDto.AdminUserSummaryDto;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.entity.UserProfile;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.repository.UserProfileRepository;
import fu.tripsense.userservice.repository.UserRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AdminUserManagementService {

  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;
  private static final Set<String> ALLOWED_ROLES = Set.of("USER", "PARTNER", "ADMIN");
  private static final Set<UserStatus> ALLOWED_TARGET_STATUSES =
      Set.of(UserStatus.ACTIVE, UserStatus.INACTIVE);

  private final NamedParameterJdbcTemplate jdbc;
  private final UserRepository userRepository;
  private final UserProfileRepository userProfileRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final SessionRepository sessionRepository;

  /** Ensures the caller is an authenticated ADMIN user. */
  public void requireAdmin(User currentUser) {
    if (currentUser == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
    List<String> roles = currentUser.getRoles();
    if (roles == null || (!roles.contains("ROLE_ADMIN") && !roles.contains("ADMIN"))) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin privileges are required");
    }
  }

  /** Queries paginated user accounts with optional search, role, and status filters. */
  @Transactional(readOnly = true)
  public AdminUserPageResponseDto listUsers(
      User currentUser, int page, int size, String search, String role, String status) {
    requireAdmin(currentUser);

    int safePage = Math.max(0, page);
    int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, size);
    String normalizedRole = normalizeRoleFilter(role);
    UserStatus normalizedStatus = normalizeStatusFilter(status);
    String searchPattern = buildSearchPattern(search);

    MapSqlParameterSource params = new MapSqlParameterSource();
    StringBuilder where = new StringBuilder(" WHERE 1=1 ");
    if (searchPattern != null) {
      where.append(
          " AND (lower(u.email) LIKE :searchPattern ESCAPE '\\' "
              + "OR lower(COALESCE(p.display_name, '')) LIKE :searchPattern ESCAPE '\\') ");
      params.addValue("searchPattern", searchPattern);
    }
    if (normalizedRole != null) {
      if ("ADMIN".equals(normalizedRole)) {
        where.append(" AND upper(u.role) IN ('ADMIN', 'ROLE_ADMIN') ");
      } else if ("PARTNER".equals(normalizedRole)) {
        where.append(
            " AND upper(u.role) NOT IN ('ADMIN', 'ROLE_ADMIN') "
                + "AND (u.partner_enrolled = true OR upper(u.role) IN ('PARTNER', 'ROLE_PARTNER')) ");
      } else {
        where.append(
            " AND upper(u.role) NOT IN ('ADMIN', 'ROLE_ADMIN', 'PARTNER', 'ROLE_PARTNER') "
                + "AND u.partner_enrolled = false ");
      }
    }
    if (normalizedStatus != null) {
      where.append(" AND u.status = :status ");
      params.addValue("status", normalizedStatus.name());
    }

    String countSql =
        "SELECT COUNT(*) FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id" + where;
    Long totalCountObj = jdbc.queryForObject(countSql, params, Long.class);
    long totalElements = totalCountObj != null ? totalCountObj : 0L;
    int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);

    params.addValue("limit", safeSize);
    params.addValue("offset", (long) safePage * safeSize);

    String dataSql =
        """
        SELECT u.id, u.email, p.display_name, p.avatar_url, u.role, u.status,
               COALESCE(u.auth_provider, 'LOCAL') AS auth_provider,
               u.partner_enrolled,
               COALESCE(p.onboarding_required, false) AS onboarding_required,
               p.location, u.created_at, u.updated_at
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        """
            + where
            + " ORDER BY u.created_at DESC, u.id DESC LIMIT :limit OFFSET :offset";

    List<AdminUserItemDto> items =
        jdbc.query(
            dataSql,
            params,
            (rs, rowNum) ->
                new AdminUserItemDto(
                    rs.getObject("id", UUID.class),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getString("avatar_url"),
                    normalizeRoleValue(rs.getString("role")),
                    rs.getString("status"),
                    rs.getString("auth_provider"),
                    rs.getBoolean("partner_enrolled"),
                    rs.getBoolean("onboarding_required"),
                    rs.getString("location"),
                    toInstant(rs.getTimestamp("created_at")),
                    toInstant(rs.getTimestamp("updated_at"))));

    AdminUserSummaryDto summary = loadGlobalSummary();
    return new AdminUserPageResponseDto(items, safePage, safeSize, totalElements, totalPages, summary);
  }

  /** Updates a user's account status (ACTIVE or INACTIVE) and revokes active tokens when suspended. */
  @Transactional
  public AdminUserItemDto updateUserStatus(User currentUser, UUID targetUserId, String rawStatus) {
    requireAdmin(currentUser);
    UserStatus targetStatus = parseTargetStatus(rawStatus);

    if (targetUserId.equals(currentUser.getId()) && targetStatus == UserStatus.INACTIVE) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Administrators cannot suspend their own account");
    }

    User targetUser =
        userRepository
            .findById(targetUserId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    targetUser.setStatus(targetStatus);
    User saved = userRepository.save(targetUser);

    if (targetStatus == UserStatus.INACTIVE) {
      LocalDateTime now = LocalDateTime.now();
      refreshTokenRepository.revokeAllByUserId(targetUserId, now);
      sessionRepository.revokeAllByUserId(targetUserId, now);
    }

    UserProfile profile = userProfileRepository.findById(targetUserId).orElse(null);
    return toDto(saved, profile);
  }

  /** Updates a user's primary platform role (USER, PARTNER, or ADMIN). */
  @Transactional
  public AdminUserItemDto updateUserRole(User currentUser, UUID targetUserId, String rawRole) {
    requireAdmin(currentUser);
    String targetRole = parseTargetRole(rawRole);

    if (targetUserId.equals(currentUser.getId()) && !"ADMIN".equals(targetRole)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Administrators cannot demote their own account");
    }

    User targetUser =
        userRepository
            .findById(targetUserId)
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    targetUser.setRole(targetRole);
    User saved = userRepository.save(targetUser);

    UserProfile profile = userProfileRepository.findById(targetUserId).orElse(null);
    return toDto(saved, profile);
  }

  private AdminUserSummaryDto loadGlobalSummary() {
    String sql =
        """
        SELECT COUNT(*) AS total_users,
               COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_users,
               COUNT(*) FILTER (WHERE status = 'INACTIVE') AS inactive_users,
               COUNT(*) FILTER (WHERE status = 'UNVERIFIED') AS unverified_users
        FROM users
        """;
    return jdbc.queryForObject(
        sql,
        new MapSqlParameterSource(),
        (rs, rowNum) ->
            new AdminUserSummaryDto(
                rs.getLong("total_users"),
                rs.getLong("active_users"),
                rs.getLong("inactive_users"),
                rs.getLong("unverified_users")));
  }

  private static String normalizeRoleFilter(String role) {
    if (role == null || role.isBlank() || "ALL".equalsIgnoreCase(role.trim())) {
      return null;
    }
    return parseTargetRole(role);
  }

  private static String parseTargetRole(String rawRole) {
    if (rawRole == null || rawRole.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is required");
    }
    String normalized = rawRole.trim().toUpperCase(Locale.ROOT);
    if (normalized.startsWith("ROLE_")) {
      normalized = normalized.substring(5);
    }
    if (!ALLOWED_ROLES.contains(normalized)) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Role must be one of USER, PARTNER, or ADMIN");
    }
    return normalized;
  }

  private static String normalizeRoleValue(String rawRole) {
    if (rawRole == null || rawRole.isBlank()) {
      return "USER";
    }
    String normalized = rawRole.trim().toUpperCase(Locale.ROOT);
    return normalized.startsWith("ROLE_") ? normalized.substring(5) : normalized;
  }

  private static UserStatus normalizeStatusFilter(String status) {
    if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status.trim())) {
      return null;
    }
    try {
      return UserStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Status must be one of ACTIVE, INACTIVE, or UNVERIFIED");
    }
  }

  private static UserStatus parseTargetStatus(String rawStatus) {
    if (rawStatus == null || rawStatus.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
    }
    try {
      UserStatus parsed = UserStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
      if (!ALLOWED_TARGET_STATUSES.contains(parsed)) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Target status must be ACTIVE or INACTIVE");
      }
      return parsed;
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Target status must be ACTIVE or INACTIVE");
    }
  }

  private static String buildSearchPattern(String search) {
    if (search == null || search.isBlank()) {
      return null;
    }
    String escaped =
        search
            .trim()
            .toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_");
    return "%" + escaped + "%";
  }

  private static AdminUserItemDto toDto(User user, UserProfile profile) {
    return new AdminUserItemDto(
        user.getId(),
        user.getEmail(),
        profile != null ? profile.getDisplayName() : null,
        profile != null ? profile.getAvatarUrl() : null,
        normalizeRoleValue(user.getRole()),
        user.getStatus() != null ? user.getStatus().name() : UserStatus.UNVERIFIED.name(),
        user.getAuthProvider() != null ? user.getAuthProvider() : "LOCAL",
        user.isPartnerEnrolled(),
        profile != null && profile.isOnboardingRequired(),
        profile != null ? profile.getLocation() : null,
        toInstant(user.getCreatedAt()),
        toInstant(user.getUpdatedAt()));
  }

  private static Instant toInstant(Timestamp ts) {
    return ts != null ? ts.toInstant() : null;
  }

  private static Instant toInstant(LocalDateTime ldt) {
    return ldt != null ? ldt.atZone(ZoneId.systemDefault()).toInstant() : null;
  }
}

