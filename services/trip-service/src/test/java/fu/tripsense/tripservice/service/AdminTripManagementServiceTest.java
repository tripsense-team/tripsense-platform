package fu.tripsense.tripservice.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.dto.request.UpdateAdminTripArchiveRequest;
import fu.tripsense.tripservice.dto.response.AdminTripArchiveResponse;
import fu.tripsense.tripservice.dto.response.AdminTripPageResponse;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.enums.TripStatus;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.repository.ItineraryItemRepository;
import fu.tripsense.tripservice.repository.TripRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class AdminTripManagementServiceTest {

  private JdbcTemplate jdbcTemplate;
  private TripRepository tripRepository;
  private ItineraryItemRepository itineraryItemRepository;
  private AdminTripManagementService service;

  private final AuthenticatedUser admin =
      new AuthenticatedUser(UUID.randomUUID(), "admin@tripsense.app", "ROLE_ADMIN");

  @BeforeEach
  void setUp() {
    jdbcTemplate = mock(JdbcTemplate.class);
    tripRepository = mock(TripRepository.class);
    itineraryItemRepository = mock(ItineraryItemRepository.class);
    service =
        new AdminTripManagementService(jdbcTemplate, tripRepository, itineraryItemRepository);
  }

  @Test
  void requireAdmin_rejectsUnauthorizedAndForbiddenUsers() {
    TripServiceException unauth =
        assertThrows(TripServiceException.class, () -> service.requireAdmin(null));
    assertEquals(HttpStatus.UNAUTHORIZED, unauth.status());

    AuthenticatedUser regularUser =
        new AuthenticatedUser(UUID.randomUUID(), "user@tripsense.app", "ROLE_USER");
    TripServiceException forbidden =
        assertThrows(TripServiceException.class, () -> service.requireAdmin(regularUser));
    assertEquals(HttpStatus.FORBIDDEN, forbidden.status());
  }

  @Test
  void listTrips_returnsPagedItemsAndSummary() throws Exception {
    UUID tripId = UUID.randomUUID();
    UUID ownerId = UUID.randomUUID();
    Instant now = Instant.parse("2026-11-15T12:00:00Z");

    when(jdbcTemplate.queryForObject(
            startsWith("SELECT COUNT(*) FROM trips"), eq(Long.class), any(Object[].class)))
        .thenReturn(1L);

    when(jdbcTemplate.query(
            startsWith("SELECT t.id"), any(RowMapper.class), any(Object[].class)))
        .thenAnswer(
            invocation -> {
              @SuppressWarnings("unchecked")
              RowMapper<Object> mapper = invocation.getArgument(1);
              ResultSet rs = mock(ResultSet.class);
              when(rs.getObject("id", UUID.class)).thenReturn(tripId);
              when(rs.getObject("owner_user_id", UUID.class)).thenReturn(ownerId);
              when(rs.getString("name")).thenReturn("Da Nang Escape");
              when(rs.getString("destination_name")).thenReturn("Da Nang, Vietnam");
              when(rs.getDate("start_date")).thenReturn(Date.valueOf(LocalDate.of(2026, 12, 1)));
              when(rs.getDate("end_date")).thenReturn(Date.valueOf(LocalDate.of(2026, 12, 3)));
              when(rs.getString("status")).thenReturn("CONFIRMED");
              when(rs.getString("visibility")).thenReturn("PUBLIC");
              when(rs.getObject("traveler_count")).thenReturn(2);
              when(rs.getLong("spots_count")).thenReturn(7L);
              when(rs.getBoolean("is_ai_generated")).thenReturn(true);
              when(rs.getTimestamp("archived_at")).thenReturn(null);
              when(rs.getLong("version")).thenReturn(4L);
              when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(now));
              when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(now));
              return List.of(mapper.mapRow(rs, 0));
            });

    when(jdbcTemplate.queryForObject(
            contains("FROM trips t WHERE t.deleted_at IS NULL"), any(RowMapper.class)))
        .thenReturn(new AdminTripPageResponse.Summary(12L, 10L, 2L, 8L, 6L));

    AdminTripPageResponse response =
        service.listTrips(admin, 0, 20, "Da Nang", "PUBLIC", "ACTIVE");

    assertEquals(1, response.items().size());
    assertEquals("Da Nang Escape", response.items().get(0).name());
    assertEquals(3, response.items().get(0).durationDays());
    assertEquals(7L, response.items().get(0).spotsCount());
    assertTrue(response.items().get(0).isAiGenerated());
    assertFalse(response.items().get(0).archived());
    assertEquals(12L, response.summary().totalTrips());
  }

  @Test
  void updateArchiveState_archivesAndRestoresDeterministically() {
    UUID tripId = UUID.randomUUID();
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(UUID.randomUUID())
            .name("Hoi An")
            .destinationName("Hoi An")
            .startDate(LocalDate.of(2026, 12, 10))
            .endDate(LocalDate.of(2026, 12, 12))
            .status(TripStatus.CONFIRMED)
            .visibility("PRIVATE")
            .version(2L)
            .publicationRevision(1L)
            .build();

    when(tripRepository.findNonDeletedByIdForUpdate(tripId)).thenReturn(Optional.of(trip));
    when(tripRepository.saveAndFlush(any(Trip.class))).thenAnswer(inv -> inv.getArgument(0));
    when(itineraryItemRepository.existsByTripId(tripId)).thenReturn(true);

    AdminTripArchiveResponse archivedRes =
        service.updateArchiveState(admin, tripId, new UpdateAdminTripArchiveRequest(true, 2L));
    assertTrue(archivedRes.archived());
    assertEquals("ARCHIVED", archivedRes.status());
    assertNotNull(archivedRes.archivedAt());
    assertEquals(2L, trip.getPublicationRevision());

    AdminTripArchiveResponse restoredRes =
        service.updateArchiveState(admin, tripId, new UpdateAdminTripArchiveRequest(false, 2L));
    assertFalse(restoredRes.archived());
    assertEquals("CONFIRMED", restoredRes.status());
    assertNull(restoredRes.archivedAt());
    assertEquals(3L, trip.getPublicationRevision());
  }

  @Test
  void updateArchiveState_throwsConflictWhenVersionMismatches() {
    UUID tripId = UUID.randomUUID();
    Trip trip =
        Trip.builder()
            .id(tripId)
            .ownerUserId(UUID.randomUUID())
            .name("Hue")
            .destinationName("Hue")
            .startDate(LocalDate.of(2026, 12, 10))
            .endDate(LocalDate.of(2026, 12, 12))
            .status(TripStatus.DRAFT)
            .visibility("PRIVATE")
            .version(9L)
            .build();

    when(tripRepository.findNonDeletedByIdForUpdate(tripId)).thenReturn(Optional.of(trip));

    TripServiceException ex =
        assertThrows(
            TripServiceException.class,
            () ->
                service.updateArchiveState(
                    admin, tripId, new UpdateAdminTripArchiveRequest(true, 8L)));
    assertEquals(HttpStatus.CONFLICT, ex.status());
  }
}

