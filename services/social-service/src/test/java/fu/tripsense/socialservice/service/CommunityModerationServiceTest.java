package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import fu.tripsense.socialservice.dto.request.ModerationDecisionRequest;
import fu.tripsense.socialservice.dto.request.SubmitReportRequest;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.entity.SocialReport;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialCommentRepository;
import fu.tripsense.socialservice.repository.SocialModerationAuditRepository;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import fu.tripsense.socialservice.repository.SocialReportRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class CommunityModerationServiceTest {
  private SocialPostRepository posts;
  private SocialReportRepository reports;
  private SocialModerationAuditRepository audits;
  private CommunityModerationService service;
  private final AuthenticatedUser reporter =
      new AuthenticatedUser(UUID.randomUUID(), "reporter@tripsense.app", "ROLE_USER");

  @BeforeEach
  void setUp() {
    posts = mock(SocialPostRepository.class);
    reports = mock(SocialReportRepository.class);
    audits = mock(SocialModerationAuditRepository.class);
    service =
        new CommunityModerationService(
            posts,
            mock(SocialCommentRepository.class),
            mock(SocialTripShareRepository.class),
            reports,
            audits);
  }

  @Test
  void createsBoundedPrivateReportReceipt() {
    UUID postId = UUID.randomUUID();
    SocialPost post = post(postId, UUID.randomUUID());
    when(posts.findByIdAndDeletedAtIsNull(postId)).thenReturn(Optional.of(post));
    when(reports.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

    var receipt =
        service.reportPost(
            postId, reporter, new SubmitReportRequest("privacy", "Contains a booking reference"));

    assertThat(receipt.status()).isEqualTo("PENDING");
    verify(reports)
        .saveAndFlush(
            argThat(
                report ->
                    report.getReporterId().equals(reporter.id())
                        && report.getReason().equals("PRIVACY")));
  }

  @Test
  void duplicateReportIsRejected() {
    UUID postId = UUID.randomUUID();
    when(posts.findByIdAndDeletedAtIsNull(postId))
        .thenReturn(Optional.of(post(postId, UUID.randomUUID())));
    when(reports.existsByReporterIdAndTargetTypeAndTargetId(reporter.id(), "POST", postId))
        .thenReturn(true);

    assertThatThrownBy(
            () -> service.reportPost(postId, reporter, new SubmitReportRequest("SPAM", null)))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("already reported");
  }

  @Test
  void duplicateReportRaceIsMappedToConflict() {
    UUID postId = UUID.randomUUID();
    when(posts.findByIdAndDeletedAtIsNull(postId))
        .thenReturn(Optional.of(post(postId, UUID.randomUUID())));
    when(reports.saveAndFlush(any()))
        .thenThrow(new DataIntegrityViolationException("unique report"));

    assertThatThrownBy(
            () -> service.reportPost(postId, reporter, new SubmitReportRequest("SPAM", null)))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("already reported");
  }

  @Test
  void reportActorThrottleStopsTheEleventhReportInAnHour() {
    UUID postId = UUID.randomUUID();
    when(posts.findByIdAndDeletedAtIsNull(postId))
        .thenReturn(Optional.of(post(postId, UUID.randomUUID())));
    when(reports.countByReporterIdAndCreatedAtAfter(eq(reporter.id()), any())).thenReturn(10L);

    assertThatThrownBy(
            () -> service.reportPost(postId, reporter, new SubmitReportRequest("SPAM", null)))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Too many reports");
    verify(reports, never()).saveAndFlush(any());
  }

  @Test
  void regularUserCannotUseModeratorQueue() {
    AuthenticatedUser user =
        new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.app", "ROLE_USER");
    assertThatThrownBy(() -> service.listReports("PENDING", 0, 20, user))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("Moderator or Admin role is required");
  }

  @Test
  void adminCanUseModeratorQueue() {
    AuthenticatedUser admin =
        new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN");
    org.springframework.data.domain.Page<SocialReport> page =
        new org.springframework.data.domain.PageImpl<>(List.of());
    when(reports.findByStatusOrderByCreatedAtAsc(eq("PENDING"), any())).thenReturn(page);

    var response = service.listReports("PENDING", 0, 20, admin);
    assertThat(response.items()).isEmpty();
  }

  @Test
  void moderatorRemovalSoftDeletesContentAndCreatesAudit() {
    UUID reportId = UUID.randomUUID();
    UUID postId = UUID.randomUUID();
    SocialPost post = post(postId, UUID.randomUUID());
    SocialReport report =
        SocialReport.builder()
            .id(reportId)
            .targetType("POST")
            .targetId(postId)
            .postId(postId)
            .reporterId(reporter.id())
            .reason("SPAM")
            .status("PENDING")
            .createdAt(Instant.now())
            .build();
    AuthenticatedUser moderator =
        new AuthenticatedUser(UUID.randomUUID(), "mod@tripsense.app", "ROLE_MODERATOR");
    when(reports.lockById(reportId)).thenReturn(Optional.of(report));
    when(posts.lockActiveById(postId)).thenReturn(Optional.of(post));

    var result =
        service.decide(
            reportId, moderator, new ModerationDecisionRequest("REMOVE_CONTENT", "Confirmed spam"));

    assertThat(result.status()).isEqualTo("ACTIONED");
    assertThat(post.getDeletedAt()).isNotNull();
    verify(audits)
        .save(
            argThat(
                audit ->
                    audit.getModeratorId().equals(moderator.id())
                        && audit.getAction().equals("REMOVE_CONTENT")));
  }

  private SocialPost post(UUID id, UUID authorId) {
    return SocialPost.builder()
        .id(id)
        .authorId(authorId)
        .postType("STANDARD")
        .likeCount(0)
        .commentCount(0)
        .createdAt(Instant.now())
        .updatedAt(Instant.now())
        .build();
  }
}
