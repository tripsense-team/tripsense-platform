package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.dto.request.ModerationDecisionRequest;
import fu.tripsense.socialservice.dto.request.SubmitReportRequest;
import fu.tripsense.socialservice.dto.response.ModerationReportPageResponse;
import fu.tripsense.socialservice.dto.response.ModerationReportResponse;
import fu.tripsense.socialservice.dto.response.ReportReceiptResponse;
import fu.tripsense.socialservice.entity.SocialComment;
import fu.tripsense.socialservice.entity.SocialModerationAudit;
import fu.tripsense.socialservice.entity.SocialPost;
import fu.tripsense.socialservice.entity.SocialReport;
import fu.tripsense.socialservice.entity.SocialTripShare;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialCommentRepository;
import fu.tripsense.socialservice.repository.SocialModerationAuditRepository;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import fu.tripsense.socialservice.repository.SocialReportRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CommunityModerationService {
  private static final Set<String> REASONS =
      Set.of("SPAM", "HARASSMENT", "DANGEROUS_CONTENT", "PRIVACY", "MISINFORMATION", "OTHER");
  private final SocialPostRepository posts;
  private final SocialCommentRepository comments;
  private final SocialTripShareRepository tripShares;
  private final SocialReportRepository reports;
  private final SocialModerationAuditRepository audits;

  @Transactional
  public ReportReceiptResponse reportPost(
      UUID postId, AuthenticatedUser reporter, SubmitReportRequest request) {
    SocialPost post = viewablePost(postId, reporter);
    if (post.getAuthorId().equals(reporter.id())) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "SELF_REPORT_NOT_ALLOWED", "You cannot report your own post");
    }
    return createReport("POST", postId, postId, reporter, request);
  }

  @Transactional
  public ReportReceiptResponse reportComment(
      UUID postId, UUID commentId, AuthenticatedUser reporter, SubmitReportRequest request) {
    viewablePost(postId, reporter);
    SocialComment comment =
        comments
            .findByIdAndPostIdAndDeletedAtIsNull(commentId, postId)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Comment not found"));
    if (comment.getAuthorId().equals(reporter.id())) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "SELF_REPORT_NOT_ALLOWED", "You cannot report your own comment");
    }
    return createReport("COMMENT", commentId, postId, reporter, request);
  }

  @Transactional(readOnly = true)
  public ModerationReportPageResponse listReports(
      String rawStatus, int page, int size, AuthenticatedUser moderator) {
    requireModerator(moderator);
    String status = rawStatus == null ? "PENDING" : rawStatus.trim().toUpperCase(Locale.ROOT);
    if (!Set.of("PENDING", "DISMISSED", "ACTIONED").contains(status)
        || page < 0
        || size < 1
        || size > 100) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid moderation queue query");
    }
    var result = reports.findByStatusOrderByCreatedAtAsc(status, PageRequest.of(page, size));
    return new ModerationReportPageResponse(
        result.getContent().stream().map(this::response).toList(),
        result.getTotalElements(),
        page,
        size,
        result.hasNext());
  }

  @Transactional
  public ModerationReportResponse decide(
      UUID reportId, AuthenticatedUser moderator, ModerationDecisionRequest request) {
    requireModerator(moderator);
    String action = request.action().trim().toUpperCase(Locale.ROOT);
    if (!Set.of("DISMISS", "REMOVE_CONTENT").contains(action)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_MODERATION_ACTION",
          "Action must be DISMISS or REMOVE_CONTENT");
    }
    SocialReport report =
        reports
            .lockById(reportId)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Report not found"));
    if (!"PENDING".equals(report.getStatus())) {
      throw new SocialException(
          HttpStatus.CONFLICT, "REPORT_ALREADY_REVIEWED", "Report was already reviewed");
    }

    Instant now = Instant.now();
    if ("REMOVE_CONTENT".equals(action)) removeTarget(report, moderator, now);
    report.setStatus("REMOVE_CONTENT".equals(action) ? "ACTIONED" : "DISMISSED");
    report.setReviewedAt(now);
    report.setReviewedBy(moderator.id());
    report.setModeratorNote(normalize(request.note()));
    reports.save(report);
    audits.save(
        SocialModerationAudit.builder()
            .id(UUID.randomUUID())
            .reportId(reportId)
            .moderatorId(moderator.id())
            .action(action)
            .targetType(report.getTargetType())
            .targetId(report.getTargetId())
            .note(normalize(request.note()))
            .createdAt(now)
            .build());
    return response(report);
  }

  private ReportReceiptResponse createReport(
      String targetType,
      UUID targetId,
      UUID postId,
      AuthenticatedUser reporter,
      SubmitReportRequest request) {
    String reason = request.reason().trim().toUpperCase(Locale.ROOT);
    if (!REASONS.contains(reason)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_REPORT_REASON", "Unsupported report reason");
    }
    if (reports.existsByReporterIdAndTargetTypeAndTargetId(reporter.id(), targetType, targetId)) {
      throw new SocialException(
          HttpStatus.CONFLICT, "DUPLICATE_REPORT", "You already reported this content");
    }
    if (reports.countByReporterIdAndCreatedAtAfter(
            reporter.id(), Instant.now().minus(1, ChronoUnit.HOURS))
        >= 10) {
      throw new SocialException(
          HttpStatus.TOO_MANY_REQUESTS, "REPORT_RATE_LIMITED", "Too many reports; try again later");
    }
    Instant now = Instant.now();
    SocialReport report;
    try {
      report =
          reports.saveAndFlush(
              SocialReport.builder()
                  .id(UUID.randomUUID())
                  .targetType(targetType)
                  .targetId(targetId)
                  .postId(postId)
                  .reporterId(reporter.id())
                  .reason(reason)
                  .details(normalize(request.details()))
                  .status("PENDING")
                  .createdAt(now)
                  .build());
    } catch (DataIntegrityViolationException ex) {
      throw new SocialException(
          HttpStatus.CONFLICT, "DUPLICATE_REPORT", "You already reported this content");
    }
    return new ReportReceiptResponse(report.getId(), report.getStatus(), report.getCreatedAt());
  }

  private SocialPost viewablePost(UUID postId, AuthenticatedUser viewer) {
    SocialPost post =
        posts
            .findByIdAndDeletedAtIsNull(postId)
            .orElseThrow(
                () ->
                    new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
    if ("TRIP_SHARE".equals(post.getPostType())) {
      SocialTripShare share =
          tripShares
              .findById(postId)
              .filter(value -> value.getRemovedAt() == null)
              .orElseThrow(
                  () ->
                      new SocialException(
                          HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
      if ("PRIVATE".equals(share.getVisibility()) && !post.getAuthorId().equals(viewer.id())) {
        throw new SocialException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found");
      }
    }
    return post;
  }

  private void removeTarget(SocialReport report, AuthenticatedUser moderator, Instant now) {
    if ("POST".equals(report.getTargetType())) {
      SocialPost post =
          posts
              .lockActiveById(report.getPostId())
              .orElseThrow(
                  () ->
                      new SocialException(
                          HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Post not found"));
      post.setDeletedAt(now);
      post.setDeletedByUserId(moderator.id());
      post.setUpdatedAt(now);
      tripShares
          .findById(post.getId())
          .ifPresent(
              share -> {
                share.setRemovedAt(now);
                share.setUpdatedAt(now);
                tripShares.save(share);
              });
      return;
    }
    SocialComment comment =
        comments
            .lockActiveByIdAndPostId(report.getTargetId(), report.getPostId())
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "COMMENT_NOT_FOUND", "Comment not found"));
    comment.setDeletedAt(now);
    comment.setDeletedByUserId(moderator.id());
    comment.setUpdatedAt(now);
    posts
        .lockActiveById(report.getPostId())
        .ifPresent(post -> post.setCommentCount(Math.max(0, post.getCommentCount() - 1)));
  }

  private void requireModerator(AuthenticatedUser user) {
    if (user == null
        || (!"ROLE_MODERATOR".equals(user.role()) && !"ROLE_ADMIN".equals(user.role()))) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "MODERATOR_REQUIRED", "Moderator or Admin role is required");
    }
  }

  private ModerationReportResponse response(SocialReport report) {
    return new ModerationReportResponse(
        report.getId(),
        report.getTargetType(),
        report.getTargetId(),
        report.getPostId(),
        report.getReporterId(),
        report.getReason(),
        report.getDetails(),
        report.getStatus(),
        report.getCreatedAt(),
        report.getReviewedAt(),
        report.getReviewedBy(),
        report.getModeratorNote());
  }

  private String normalize(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
