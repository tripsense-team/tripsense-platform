package fu.tripsense.tripservice.service;

import fu.tripsense.tripservice.dto.request.UpdateAdminTripArchiveRequest;
import fu.tripsense.tripservice.dto.response.AdminTripArchiveResponse;
import fu.tripsense.tripservice.dto.response.AdminTripPageResponse;
import fu.tripsense.tripservice.dto.response.AdminTripPageResponse.AdminTripItem;
import fu.tripsense.tripservice.dto.response.AdminTripPageResponse.Summary;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.repository.ItineraryItemRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminTripManagementService {

  private static final Set<String> ALLOWED_VISIBILITIES =
      Set.of("ALL", "PUBLIC", "SHARED", "PRIVATE");
  private static final Set<String> ALLOWED_ARCHIVE_FILTERS = Set.of("ALL", "ACTIVE", "ARCHIVED");

  private final JdbcTemplate jdbc;
  private final TripRepository tripRepository;
  private final ItineraryItemRepository itineraryItemRepository;

  public void requireAdmin(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication is required", HttpStatus.UNAUTHORIZED);
    }
    if (!user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "Admin privileges are required", HttpStatus.FORBIDDEN);
    }
  }

  @Transactional(readOnly = true)
  public AdminTripPageResponse listTrips(
      AuthenticatedUser admin,
      int page,
      int size,
      String search,
      String visibility,
      String archived) {
    requireAdmin(admin);

    int safePage = Math.max(page, 0);
    int safeSize = Math.min(Math.max(size, 1), 100);
    String normalizedVisibility = normalizeVisibility(visibility);
    String normalizedArchived = normalizeArchivedFilter(archived);

    StringBuilder where = new StringBuilder(" WHERE t.deleted_at IS NULL");
    List<Object> params = new ArrayList<>();

    if (!"ALL".equals(normalizedVisibility)) {
      where.append(" AND UPPER(t.visibility) = ?");
      params.add(normalizedVisibility);
    }

    if ("ACTIVE".equals(normalizedArchived)) {
      where.append(" AND t.status <> 'ARCHIVED' AND t.archived_at IS NULL");
    } else if ("ARCHIVED".equals(normalizedArchived)) {
      where.append(" AND (t.status = 'ARCHIVED' OR t.archived_at IS NOT NULL)");
    }

    String trimmedSearch = search == null ? "" : search.trim();
    if (!trimmedSearch.isEmpty()) {
      String escaped =
          trimmedSearch
              .toLowerCase(Locale.ROOT)
              .replace("\\", "\\\\")
              .replace("%", "\\%")
              .replace("_", "\\_");
      String pattern = "%" + escaped + "%";
      where.append(
          " AND (LOWER(t.name) LIKE ? ESCAPE '\\' OR LOWER(t.destination_name) LIKE ? ESCAPE '\\'"
              + " OR LOWER(CAST(t.id AS TEXT)) LIKE ? ESCAPE '\\' OR LOWER(CAST(t.owner_user_id AS TEXT)) LIKE ? ESCAPE '\\')");
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
      params.add(pattern);
    }

    Long totalCount =
        jdbc.queryForObject(
            "SELECT COUNT(*) FROM trips t" + where, Long.class, params.toArray());
    long totalElements = totalCount == null ? 0L : totalCount;
    int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);

    List<Object> rowParams = new ArrayList<>(params);
    rowParams.add(safeSize);
    rowParams.add((long) safePage * safeSize);

    String rowsSql =
        "SELECT t.id, t.owner_user_id, t.name, t.destination_name, t.start_date, t.end_date,"
            + " t.status, t.visibility, t.traveler_count, t.version, t.archived_at,"
            + " t.created_at, t.updated_at,"
            + " GREATEST("
            + "   (SELECT COUNT(*) FROM trip_places tp WHERE tp.trip_id = t.id),"
            + "   (SELECT COUNT(*) FROM itinerary_items ii WHERE ii.trip_id = t.id AND ii.item_type <> 'NOTE')"
            + " ) AS spots_count,"
            + " EXISTS (SELECT 1 FROM itinerary_commit_receipts r WHERE r.trip_id = t.id) AS is_ai_generated"
            + " FROM trips t"
            + where
            + " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";

    List<AdminTripItem> items =
        jdbc.query(
            rowsSql,
            (rs, rowNum) -> {
              LocalDate startDate = toLocalDate(rs.getDate("start_date"));
              LocalDate endDate = toLocalDate(rs.getDate("end_date"));
              int durationDays =
                  startDate != null && endDate != null
                      ? (int) Math.max(1, ChronoUnit.DAYS.between(startDate, endDate) + 1)
                      : 0;
              String statusValue = rs.getString("status");
              Instant archivedAt = toInstant(rs.getTimestamp("archived_at"));
              boolean isArchived =
                  TripStatus.ARCHIVED.name().equals(statusValue) || archivedAt != null;
              Integer travelerCount = (Integer) rs.getObject("traveler_count");
              return new AdminTripItem(
                  rs.getObject("id", UUID.class),
                  rs.getObject("owner_user_id", UUID.class),
                  rs.getString("name"),
                  rs.getString("destination_name"),
                  startDate,
                  endDate,
                  durationDays,
                  statusValue,
                  rs.getString("visibility"),
                  travelerCount,
                  rs.getLong("spots_count"),
                  rs.getBoolean("is_ai_generated"),
                  isArchived,
                  archivedAt,
                  rs.getLong("version"),
                  toInstant(rs.getTimestamp("created_at")),
                  toInstant(rs.getTimestamp("updated_at")));
            },
            rowParams.toArray());

    Summary summary = fetchSummary();
    return new AdminTripPageResponse(items, safePage, safeSize, totalElements, totalPages, summary);
  }

  @Transactional
  @CacheEvict(
      cacheNames = {"trip-detail", "trip-list", "trip-itinerary"},
      allEntries = true)
  public AdminTripArchiveResponse updateArchiveState(
      AuthenticatedUser admin, UUID tripId, UpdateAdminTripArchiveRequest request) {
    requireAdmin(admin);

    Trip trip =
        tripRepository
            .findNonDeletedByIdForUpdate(tripId)
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "TRIP_NOT_FOUND", "Trip not found", HttpStatus.NOT_FOUND));

    if (request.version() != null && !request.version().equals(trip.getVersion())) {
      throw new TripServiceException(
          "CONFLICTING_UPDATE",
          "Trip was modified by another administrator; please refresh",
          HttpStatus.CONFLICT);
    }

    Instant now = Instant.now();
    boolean archive = Boolean.TRUE.equals(request.archived());
    if (archive) {
      trip.setStatus(TripStatus.ARCHIVED);
      if (trip.getArchivedAt() == null) {
        trip.setArchivedAt(now);
      }
    } else {
      trip.setArchivedAt(null);
      if (trip.getStatus() == TripStatus.ARCHIVED) {
        boolean hasItinerary = itineraryItemRepository.existsByTripId(tripId);
        trip.setStatus(hasItinerary ? TripStatus.CONFIRMED : TripStatus.DRAFT);
      }
    }

    trip.setPublicationRevision(Optional.ofNullable(trip.getPublicationRevision()).orElse(0L) + 1L);
    Trip saved = tripRepository.saveAndFlush(trip);
    boolean isArchived =
        saved.getStatus() == TripStatus.ARCHIVED || saved.getArchivedAt() != null;

    return new AdminTripArchiveResponse(
        saved.getId(),
        saved.getStatus().name(),
        isArchived,
        saved.getArchivedAt(),
        saved.getVersion(),
        saved.getUpdatedAt());
  }

  private Summary fetchSummary() {
    String sql =
        "SELECT COUNT(*) AS total_trips,"
            + " COUNT(*) FILTER (WHERE t.status <> 'ARCHIVED' AND t.archived_at IS NULL) AS active_trips,"
            + " COUNT(*) FILTER (WHERE t.status = 'ARCHIVED' OR t.archived_at IS NOT NULL) AS archived_trips,"
            + " COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM itinerary_commit_receipts r WHERE r.trip_id = t.id)) AS ai_crafted_trips,"
            + " COUNT(*) FILTER (WHERE UPPER(t.visibility) = 'PUBLIC') AS public_trips"
            + " FROM trips t WHERE t.deleted_at IS NULL";
    return jdbc.queryForObject(
        sql,
        (rs, rowNum) ->
            new Summary(
                rs.getLong("total_trips"),
                rs.getLong("active_trips"),
                rs.getLong("archived_trips"),
                rs.getLong("ai_crafted_trips"),
                rs.getLong("public_trips")));
  }

  private String normalizeVisibility(String visibility) {
    if (visibility == null || visibility.isBlank()) {
      return "ALL";
    }
    String normalized = visibility.trim().toUpperCase(Locale.ROOT);
    if (!ALLOWED_VISIBILITIES.contains(normalized)) {
      throw new TripServiceException(
          "INVALID_VISIBILITY_FILTER",
          "visibility must be ALL, PUBLIC, SHARED, or PRIVATE",
          HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private String normalizeArchivedFilter(String archived) {
    if (archived == null || archived.isBlank()) {
      return "ALL";
    }
    String normalized = archived.trim().toUpperCase(Locale.ROOT);
    if (!ALLOWED_ARCHIVE_FILTERS.contains(normalized)) {
      throw new TripServiceException(
          "INVALID_ARCHIVE_FILTER",
          "archived must be ALL, ACTIVE, or ARCHIVED",
          HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private static LocalDate toLocalDate(Date date) {
    return date == null ? null : date.toLocalDate();
  }

  private static Instant toInstant(Timestamp ts) {
    return ts == null ? null : ts.toInstant();
  }
}

