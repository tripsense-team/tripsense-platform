package fu.tripsense.socialservice.service;

import fu.tripsense.socialservice.client.PlaceClient;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.request.UpdateAdminPlaceReviewStatusRequest;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewPageResponse;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewPageResponse.AdminPlaceReviewItem;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewPageResponse.Summary;
import fu.tripsense.socialservice.dto.response.AdminPlaceReviewStatusResponse;
import fu.tripsense.socialservice.entity.PlaceReview;
import fu.tripsense.socialservice.entity.SocialModerationAudit;
import fu.tripsense.socialservice.entity.SocialReport;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.PlaceReviewRepository;
import fu.tripsense.socialservice.repository.SocialModerationAuditRepository;
import fu.tripsense.socialservice.repository.SocialReportRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminPlaceReviewService {

  private static final String TARGET_PLACE_REVIEW = "PLACE_REVIEW";
  private static final Set<String> ALLOWED_FILTER_STATUSES =
      Set.of("ALL", "PUBLISHED", "REMOVED", "FLAGGED");
  private static final Set<String> ALLOWED_TARGET_STATUSES = Set.of("PUBLISHED", "REMOVED");

  private final JdbcTemplate jdbc;
  private final PlaceReviewRepository reviews;
  private final SocialReportRepository reports;
  private final SocialModerationAuditRepository audits;
  private final UserPublicProfileClient profileClient;
  private final PlaceClient placeClient;

  public void requireAdmin(AuthenticatedUser user) {
    if (user == null) {
      throw new SocialException(
          HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required");
    }
    if (!"ROLE_ADMIN".equals(user.role()) && !"ADMIN".equals(user.role())) {
      throw new SocialException(
          HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Admin privileges are required");
    }
  }

  @Transactional(readOnly = true)
  public AdminPlaceReviewPageResponse listReviews(
      AuthenticatedUser admin,
      int page,
      int size,
      String search,
      String status,
      Integer rating) {
    requireAdmin(admin);

    int safePage = Math.max(page, 0);
    int safeSize = Math.min(Math.max(size, 1), 100);
    String normalizedStatus = normalizeFilterStatus(status);
    if (rating != null && (rating < 1 || rating > 5)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_RATING", "rating must be between 1 and 5");
    }

    StringBuilder where = new StringBuilder(" WHERE r.deleted_at IS NULL");
    List<Object> params = new ArrayList<>();

    if ("PUBLISHED".equals(normalizedStatus) || "REMOVED".equals(normalizedStatus)) {
      where.append(" AND r.status = ?");
      params.add(normalizedStatus);
    } else if ("FLAGGED".equals(normalizedStatus)) {
      where.append(
          " AND EXISTS (SELECT 1 FROM social_reports sr"
              + " WHERE sr.target_type = 'PLACE_REVIEW'"
              + " AND sr.target_id = r.id AND sr.status = 'PENDING')");
    }

    if (rating != null) {
      where.append(" AND r.rating = ?");
      params.add(rating);
    }

    String trimmedSearch = search == null ? "" : search.trim();
    if (!trimmedSearch.isEmpty()) {
      String pattern = "%" + trimmedSearch.toLowerCase(Locale.ROOT) + "%";
      where.append(
          " AND (LOWER(r.content) LIKE ? OR LOWER(r.place_ref) LIKE ?"
              + " OR LOWER(CAST(r.id AS TEXT)) LIKE ? OR LOWER(CAST(r.author_user_id AS TEXT)) LIKE ?)");
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
    }

    Long totalCount =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM place_reviews r" + where, Long.class, params.toArray());
    long totalElements = totalCount == null ? 0L : totalCount;
    int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);

    List<Object> rowParams = new ArrayList<>(params);
    rowParams.add(safeSize);
    rowParams.add((long) safePage * safeSize);

    String rowsSql =
        "SELECT r.id, r.place_ref, r.author_user_id, r.rating, r.content, r.status, r.version,"
            + " r.created_at, r.updated_at,"
            + " (SELECT COUNT(*) FROM social_reports sr"
            + "  WHERE sr.target_type = 'PLACE_REVIEW' AND sr.target_id = r.id AND sr.status = 'PENDING') AS pending_reports,"
            + " (SELECT COUNT(*) FROM social_reports sr"
            + "  WHERE sr.target_type = 'PLACE_REVIEW' AND sr.target_id = r.id) AS total_reports"
            + " FROM place_reviews r"
            + where
            + " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";

    List<RawReviewRow> rawRows =
        jdbc.query(
            rowsSql,
            (rs, rowNum) ->
                new RawReviewRow(
                    rs.getObject("id", UUID.class),
                    rs.getString("place_ref"),
                    rs.getObject("author_user_id", UUID.class),
                    rs.getInt("rating"),
                    rs.getString("content"),
                    rs.getString("status"),
                    rs.getLong("version"),
                    toInstant(rs.getTimestamp("created_at")),
                    toInstant(rs.getTimestamp("updated_at")),
                    rs.getLong("pending_reports"),
                    rs.getLong("total_reports")),
            rowParams.toArray());

    Set<UUID> authorIds =
        rawRows.stream().map(RawReviewRow::authorUserId).collect(Collectors.toSet());
    Set<String> placeRefs = rawRows.stream().map(RawReviewRow::placeRef).collect(Collectors.toSet());

    Map<UUID, PublicProfileClientResponse> profiles = profileClient.fetchPublicProfiles(authorIds);
    Map<String, String> placeNames = placeClient.fetchPlaceNames(placeRefs);

    List<AdminPlaceReviewItem> items =
        rawRows.stream()
            .map(
                row -> {
                  PublicProfileClientResponse profile = profiles.get(row.authorUserId());
                  String authorName =
                      profile != null && profile.displayName() != null && !profile.displayName().isBlank()
                          ? profile.displayName()
                          : shortId(row.authorUserId());
                  String authorAvatar = profile == null ? null : profile.avatarUrl();
                  String placeName = placeNames.getOrDefault(row.placeRef(), row.placeRef());
                  return new AdminPlaceReviewItem(
                      row.id(),
                      row.placeRef(),
                      placeName,
                      row.authorUserId(),
                      authorName,
                      authorAvatar,
                      row.rating(),
                      row.content(),
                      row.status(),
                      row.pendingReportCount(),
                      row.totalReportCount(),
                      row.version(),
                      row.createdAt(),
                      row.updatedAt());
                })
            .toList();

    Summary summary = fetchSummary();
    return new AdminPlaceReviewPageResponse(
        items, safePage, safeSize, totalElements, totalPages, summary);
  }

  @Transactional
  public AdminPlaceReviewStatusResponse updateReviewStatus(
      AuthenticatedUser admin, UUID reviewId, UpdateAdminPlaceReviewStatusRequest request) {
    requireAdmin(admin);

    String nextStatus =
        request.status() == null ? "" : request.status().trim().toUpperCase(Locale.ROOT);
    if (!ALLOWED_TARGET_STATUSES.contains(nextStatus)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_REVIEW_STATUS",
          "status must be PUBLISHED or REMOVED");
    }

    PlaceReview review =
        reviews
            .lockById(reviewId)
            .filter(r -> r.getDeletedAt() == null)
            .orElseThrow(
                () ->
                    new SocialException(
                        HttpStatus.NOT_FOUND, "REVIEW_NOT_FOUND", "Place review not found"));

    if (request.version() != null && !request.version().equals(review.getVersion())) {
      throw new SocialException(
          HttpStatus.CONFLICT,
          "CONFLICTING_UPDATE",
          "Review was modified by another administrator; please refresh");
    }

    Instant now = Instant.now();
    review.setStatus(nextStatus);
    review.setUpdatedAt(now);
    PlaceReview saved = reviews.saveAndFlush(review);

    List<SocialReport> pendingReports =
        reports.findByTargetTypeAndTargetIdAndStatus(TARGET_PLACE_REVIEW, reviewId, "PENDING");
    if (!pendingReports.isEmpty()) {
      boolean removed = "REMOVED".equals(nextStatus);
      String reportStatus = removed ? "RESOLVED" : "DISMISSED";
      String auditAction = removed ? "REMOVE_CONTENT" : "DISMISS";
      String note = normalize(request.reason());
      for (SocialReport report : pendingReports) {
        report.setStatus(reportStatus);
        report.setReviewedAt(now);
        report.setReviewedBy(admin.id());
        report.setModeratorNote(note);
        reports.save(report);
        audits.save(
            SocialModerationAudit.builder()
                .id(UUID.randomUUID())
                .reportId(report.getId())
                .moderatorId(admin.id())
                .action(auditAction)
                .targetType(TARGET_PLACE_REVIEW)
                .targetId(reviewId)
                .note(note)
                .createdAt(now)
                .build());
      }
    }

    return new AdminPlaceReviewStatusResponse(
        saved.getId(), saved.getStatus(), 0L, saved.getVersion(), saved.getUpdatedAt());
  }

  private Summary fetchSummary() {
    String summarySql =
        "SELECT COUNT(*) AS total,"
            + " COUNT(*) FILTER (WHERE r.status = 'PUBLISHED') AS published,"
            + " COUNT(*) FILTER (WHERE r.status = 'REMOVED') AS removed,"
            + " COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM social_reports sr"
            + "   WHERE sr.target_type = 'PLACE_REVIEW' AND sr.target_id = r.id AND sr.status = 'PENDING')) AS flagged"
            + " FROM place_reviews r WHERE r.deleted_at IS NULL";
    return jdbc.queryForObject(
        summarySql,
        (rs, rowNum) ->
            new Summary(
                rs.getLong("total"),
                rs.getLong("published"),
                rs.getLong("removed"),
                rs.getLong("flagged")));
  }

  private String normalizeFilterStatus(String status) {
    if (status == null || status.isBlank()) {
      return "ALL";
    }
    String normalized = status.trim().toUpperCase(Locale.ROOT);
    if (!ALLOWED_FILTER_STATUSES.contains(normalized)) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST,
          "INVALID_REVIEW_STATUS",
          "status filter must be one of ALL, PUBLISHED, REMOVED, or FLAGGED");
    }
    return normalized;
  }

  private static Instant toInstant(Timestamp ts) {
    return ts == null ? null : ts.toInstant();
  }

  private static String shortId(UUID id) {
    return id == null ? "User" : "User-" + id.toString().substring(0, 8);
  }

  private static String normalize(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private record RawReviewRow(
      UUID id,
      String placeRef,
      UUID authorUserId,
      int rating,
      String content,
      String status,
      Long version,
      Instant createdAt,
      Instant updatedAt,
      long pendingReportCount,
      long totalReportCount) {}
}

