package fu.tripsense.socialservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.client.PlaceClient;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.request.UpdateAdminPlaceReviewStatusRequest;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewPageResponse;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewStatusResponse;
import fu.tripsense.socialservice.entity.PlaceReview;
import fu.tripsense.socialservice.entity.SocialModerationAudit;
import fu.tripsense.socialservice.entity.SocialReport;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.PlaceReviewRepository;
import fu.tripsense.socialservice.repository.SocialModerationAuditRepository;
import fu.tripsense.socialservice.repository.SocialReportRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class AdminPlaceReviewServiceTest {

  private JdbcTemplate jdbcTemplate;
  private PlaceReviewRepository reviewRepository;
  private SocialReportRepository reportRepository;
  private SocialModerationAuditRepository auditRepository;
  private UserPublicProfileClient profileClient;
  private PlaceClient placeClient;
  private AdminPlaceReviewService service;

  private final AuthenticatedUser admin =
      new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN");

  @BeforeEach
  void setUp() {
    jdbcTemplate = mock(JdbcTemplate.class);
    reviewRepository = mock(PlaceReviewRepository.class);
    reportRepository = mock(SocialReportRepository.class);
    auditRepository = mock(SocialModerationAuditRepository.class);
    profileClient = mock(UserPublicProfileClient.class);
    placeClient = mock(PlaceClient.class);
    service =
        new AdminPlaceReviewService(
            jdbcTemplate,
            reviewRepository,
            reportRepository,
            auditRepository,
            profileClient,
            placeClient);
  }

  @Test
  void requireAdmin_rejectsNullAndNonAdminUsers() {
    SocialException unauthenticated =
        assertThrows(SocialException.class, () -> service.requireAdmin(null));
    assertEquals(HttpStatus.UNAUTHORIZED, unauthenticated.status());

    AuthenticatedUser regularUser =
        new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.app", "ROLE_USER");
    SocialException forbidden =
        assertThrows(SocialException.class, () -> service.requireAdmin(regularUser));
    assertEquals(HttpStatus.FORBIDDEN, forbidden.status());
  }

  @Test
  void listReviews_enrichesAuthorAndPlaceNamesAndSummary() throws Exception {
    UUID reviewId = UUID.randomUUID();
    UUID authorId = UUID.randomUUID();
    Instant now = Instant.parse("2026-11-15T10:00:00Z");

    when(jdbcTemplate.queryForObject(
            startsWith("SELECT COUNT(*) FROM place_reviews"), eq(Long.class), any(Object[].class)))
        .thenReturn(1L);

    when(jdbcTemplate.query(
            startsWith("SELECT r.id"), any(RowMapper.class), any(Object[].class)))
        .thenAnswer(
            invocation -> {
              @SuppressWarnings("unchecked")
              RowMapper<Object> mapper = invocation.getArgument(1);
              ResultSet rs = mock(ResultSet.class);
              when(rs.getObject("id", UUID.class)).thenReturn(reviewId);
              when(rs.getString("place_ref")).thenReturn("place-123");
              when(rs.getObject("author_user_id", UUID.class)).thenReturn(authorId);
              when(rs.getInt("rating")).thenReturn(5);
              when(rs.getString("content")).thenReturn("Amazing sunset");
              when(rs.getString("status")).thenReturn("PUBLISHED");
              when(rs.getLong("version")).thenReturn(2L);
              when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(now));
              when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(now));
              when(rs.getLong("pending_reports")).thenReturn(1L);
              when(rs.getLong("total_reports")).thenReturn(2L);
              return List.of(mapper.mapRow(rs, 0));
            });

    when(jdbcTemplate.queryForObject(
            contains("FROM place_reviews r WHERE r.deleted_at IS NULL"),
            any(RowMapper.class)))
        .thenReturn(new AdminPlaceReviewPageResponse.Summary(10L, 7L, 3L, 2L));

    when(profileClient.fetchPublicProfiles(anyCollection()))
        .thenReturn(Map.of(authorId, new PublicProfileClientResponse(authorId, "Hue Phan", null)));
    when(placeClient.fetchPlaceNames(anyCollection()))
        .thenReturn(Map.of("place-123", "Dragon Bridge"));

    AdminPlaceReviewPageResponse page =
        service.listReviews(admin, 0, 20, null, "FLAGGED", null);

    assertEquals(1, page.items().size());
    assertEquals("Hue Phan", page.items().get(0).authorName());
    assertEquals("Dragon Bridge", page.items().get(0).placeName());
    assertEquals(1L, page.items().get(0).pendingReportCount());
    assertEquals(10L, page.summary().total());
    assertEquals(2L, page.summary().flagged());
  }

  @Test
  void updateReviewStatus_removesReviewAndResolvesPendingReports() {
    UUID reviewId = UUID.randomUUID();
    PlaceReview review =
        PlaceReview.builder()
            .id(reviewId)
            .placeRef("place-abc")
            .authorUserId(UUID.randomUUID())
            .rating((short) 1)
            .content("Spam link")
            .status("PUBLISHED")
            .version(3L)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

    SocialReport pendingReport =
        SocialReport.builder()
            .id(UUID.randomUUID())
            .targetType("PLACE_REVIEW")
            .targetId(reviewId)
            .reporterId(UUID.randomUUID())
            .reason("SPAM")
            .status("PENDING")
            .createdAt(Instant.now())
            .build();

    when(reviewRepository.lockById(reviewId)).thenReturn(Optional.of(review));
    when(reviewRepository.saveAndFlush(any(PlaceReview.class))).thenAnswer(inv -> inv.getArgument(0));
    when(reportRepository.findByTargetTypeAndTargetIdAndStatus("PLACE_REVIEW", reviewId, "PENDING"))
        .thenReturn(List.of(pendingReport));

    AdminPlaceReviewStatusResponse response =
        service.updateReviewStatus(
            admin, reviewId, new UpdateAdminPlaceReviewStatusRequest("REMOVED", "Spam", 3L));

    assertEquals("REMOVED", response.status());
    assertEquals(0L, response.pendingReportCount());
    assertEquals("RESOLVED", pendingReport.getStatus());
    assertEquals(admin.id(), pendingReport.getReviewedBy());
    verify(auditRepository, times(1)).save(any(SocialModerationAudit.class));
  }

  @Test
  void updateReviewStatus_throwsConflictWhenVersionMismatches() {
    UUID reviewId = UUID.randomUUID();
    PlaceReview review =
        PlaceReview.builder()
            .id(reviewId)
            .placeRef("place-abc")
            .authorUserId(UUID.randomUUID())
            .rating((short) 4)
            .content("Nice place")
            .status("PUBLISHED")
            .version(5L)
            .createdAt(Instant.now())
            .updatedAt(Instant.now())
            .build();

    when(reviewRepository.lockById(reviewId)).thenReturn(Optional.of(review));

    SocialException conflict =
        assertThrows(
            SocialException.class,
            () ->
                service.updateReviewStatus(
                    admin,
                    reviewId,
                    new UpdateAdminPlaceReviewStatusRequest("REMOVED", null, 4L)));
    assertEquals(HttpStatus.CONFLICT, conflict.status());
  }
}
