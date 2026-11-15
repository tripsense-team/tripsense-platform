package fu.tripsense.userservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class AdminUserManagementServiceTest {

  private NamedParameterJdbcTemplate jdbc;
  private UserRepository userRepository;
  private UserProfileRepository userProfileRepository;
  private RefreshTokenRepository refreshTokenRepository;
  private SessionRepository sessionRepository;
  private AdminUserManagementService service;

  private User adminUser;
  private User targetUser;

  @BeforeEach
  void setUp() {
    jdbc = mock(NamedParameterJdbcTemplate.class);
    userRepository = mock(UserRepository.class);
    userProfileRepository = mock(UserProfileRepository.class);
    refreshTokenRepository = mock(RefreshTokenRepository.class);
    sessionRepository = mock(SessionRepository.class);
    service =
        new AdminUserManagementService(
            jdbc,
            userRepository,
            userProfileRepository,
            refreshTokenRepository,
            sessionRepository);

    adminUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("admin@tripsense.app")
            .role("ADMIN")
            .status(UserStatus.ACTIVE)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();

    targetUser =
        User.builder()
            .id(UUID.randomUUID())
            .email("traveler@tripsense.app")
            .role("USER")
            .status(UserStatus.ACTIVE)
            .authProvider("LOCAL")
            .partnerEnrolled(false)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();
  }

  @Test
  void requireAdmin_rejectsNullAndNonAdminCallers() {
    ResponseStatusException unauth =
        assertThrows(ResponseStatusException.class, () -> service.requireAdmin(null));
    assertEquals(HttpStatus.UNAUTHORIZED, unauth.getStatusCode());

    ResponseStatusException forbidden =
        assertThrows(ResponseStatusException.class, () -> service.requireAdmin(targetUser));
    assertEquals(HttpStatus.FORBIDDEN, forbidden.getStatusCode());
  }

  @Test
  @SuppressWarnings("unchecked")
  void listUsers_escapesWildcardsAndReturnsPaginatedSummary() {
    AdminUserItemDto item =
        new AdminUserItemDto(
            targetUser.getId(),
            targetUser.getEmail(),
            "Alex",
            null,
            "USER",
            "ACTIVE",
            "LOCAL",
            false,
            false,
            "Hanoi",
            null,
            null);
    AdminUserSummaryDto summary = new AdminUserSummaryDto(22L, 20L, 1L, 1L);

    when(jdbc.queryForObject(anyString(), any(MapSqlParameterSource.class), eq(Long.class)))
        .thenReturn(1L);
    when(jdbc.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(List.of(item));
    when(jdbc.queryForObject(
            anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(summary);

    AdminUserPageResponseDto response =
        service.listUsers(adminUser, 0, 20, "a%b_c", "USER", "ACTIVE");

    assertEquals(1, response.items().size());
    assertEquals(1L, response.totalElements());
    assertEquals(1, response.totalPages());
    assertEquals(22L, response.summary().totalUsers());

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<MapSqlParameterSource> paramsCaptor =
        ArgumentCaptor.forClass(MapSqlParameterSource.class);
    verify(jdbc).queryForObject(sqlCaptor.capture(), paramsCaptor.capture(), eq(Long.class));
    assertEquals("%a\\%b\\_c%", paramsCaptor.getValue().getValue("searchPattern"));
    assertEquals("ACTIVE", paramsCaptor.getValue().getValue("status"));
    assertTrue(sqlCaptor.getValue().contains("u.partner_enrolled = false"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void listUsers_partnerFilterIncludesPartnerEnrolledUsersExcludingAdmins() {
    when(jdbc.queryForObject(anyString(), any(MapSqlParameterSource.class), eq(Long.class)))
        .thenReturn(3L);
    when(jdbc.query(anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(List.of());
    when(jdbc.queryForObject(
            anyString(), any(MapSqlParameterSource.class), any(RowMapper.class)))
        .thenReturn(new AdminUserSummaryDto(22L, 21L, 0L, 1L));

    service.listUsers(adminUser, 0, 20, null, "PARTNER", null);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(jdbc).queryForObject(sqlCaptor.capture(), any(MapSqlParameterSource.class), eq(Long.class));
    assertTrue(sqlCaptor.getValue().contains("u.partner_enrolled = true"));
    assertTrue(sqlCaptor.getValue().contains("NOT IN ('ADMIN', 'ROLE_ADMIN')"));
  }

  @Test
  void listUsers_rejectsInvalidRoleOrStatusFilter() {
    ResponseStatusException badRole =
        assertThrows(
            ResponseStatusException.class,
            () -> service.listUsers(adminUser, 0, 20, null, "SUPERUSER", null));
    assertEquals(HttpStatus.BAD_REQUEST, badRole.getStatusCode());

    ResponseStatusException badStatus =
        assertThrows(
            ResponseStatusException.class,
            () -> service.listUsers(adminUser, 0, 20, null, null, "DELETED"));
    assertEquals(HttpStatus.BAD_REQUEST, badStatus.getStatusCode());
  }

  @Test
  void updateUserStatus_preventsSelfSuspendAndRevokesTokensWhenSuspendingOtherUser() {
    ResponseStatusException selfEx =
        assertThrows(
            ResponseStatusException.class,
            () -> service.updateUserStatus(adminUser, adminUser.getId(), "INACTIVE"));
    assertEquals(HttpStatus.BAD_REQUEST, selfEx.getStatusCode());

    when(userRepository.findById(targetUser.getId())).thenReturn(Optional.of(targetUser));
    when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    when(userProfileRepository.findById(targetUser.getId()))
        .thenReturn(
            Optional.of(
                UserProfile.builder()
                    .userId(targetUser.getId())
                    .displayName("Alex")
                    .onboardingRequired(false)
                    .build()));

    AdminUserItemDto suspended =
        service.updateUserStatus(adminUser, targetUser.getId(), "INACTIVE");

    assertEquals("INACTIVE", suspended.status());
    assertEquals("Alex", suspended.displayName());
    verify(refreshTokenRepository).revokeAllByUserId(eq(targetUser.getId()), any());
    verify(sessionRepository).revokeAllByUserId(eq(targetUser.getId()), any());

    AdminUserItemDto reactivated =
        service.updateUserStatus(adminUser, targetUser.getId(), "ACTIVE");
    assertEquals("ACTIVE", reactivated.status());
    verify(refreshTokenRepository, times(1)).revokeAllByUserId(any(), any());
  }

  @Test
  void updateUserRole_preventsSelfDemotionAndUpdatesTargetRole() {
    ResponseStatusException selfDemote =
        assertThrows(
            ResponseStatusException.class,
            () -> service.updateUserRole(adminUser, adminUser.getId(), "USER"));
    assertEquals(HttpStatus.BAD_REQUEST, selfDemote.getStatusCode());

    when(userRepository.findById(targetUser.getId())).thenReturn(Optional.of(targetUser));
    when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    when(userProfileRepository.findById(targetUser.getId())).thenReturn(Optional.empty());

    AdminUserItemDto updated =
        service.updateUserRole(adminUser, targetUser.getId(), "PARTNER");

    assertEquals("PARTNER", updated.role());
    verify(userRepository).save(argThat(u -> "PARTNER".equals(u.getRole())));
  }
}

