package fu.tripsense.tripservice.controller;

import com.jayway.jsonpath.JsonPath;
import fu.tripsense.tripservice.support.RealInfrastructureTest;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TripControllerIntegrationTest extends RealInfrastructureTest {

    private static final String SECRET = "test-access-secret-key-that-is-long-enough-for-hs256";
    private static final UUID USER_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID USER_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    @Autowired
    private MockMvc mockMvc;

    @Test
    void rejectsUnauthenticatedTripRequests() throws Exception {
        mockMvc.perform(get("/api/trips"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createsTripWithJwtAndPersistsGeneratedDaysThroughFlywayPostgres() throws Exception {
        String tripId = createTrip(USER_A, "Da Nang", "2026-08-20", "2026-08-22");

        mockMvc.perform(get("/api/trips/{tripId}/itinerary", tripId)
                        .header("Authorization", bearer(USER_A)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tripId").value(tripId))
                .andExpect(jsonPath("$.data.days", hasSize(3)))
                .andExpect(jsonPath("$.data.days[*].dayNumber", contains(1, 2, 3)));
    }

    @Test
    void hidesAnotherUsersTripAsNotFound() throws Exception {
        String tripId = createTrip(USER_A, "Hue", "2026-09-01", "2026-09-02");

        mockMvc.perform(get("/api/trips/{tripId}", tripId)
                        .header("Authorization", bearer(USER_B)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TRIP_NOT_FOUND"));
    }

    @Test
    void managesItineraryItemLifecycleThroughController() throws Exception {
        String tripId = createTrip(USER_A, "Hoi An", "2026-10-01", "2026-10-02");
        String dayId = firstDayId(tripId, USER_A);

        String firstItemId = createItem(tripId, dayId, USER_A, "Breakfast");
        String secondItemId = createItem(tripId, dayId, USER_A, "Museum");

        mockMvc.perform(patch("/api/trips/{tripId}/itinerary/items/{itemId}", tripId, firstItemId)
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Local breakfast",
                                  "startTime": "08:00",
                                  "endTime": "09:00",
                                  "durationMinutes": 60
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Local breakfast"));

        int dayVersion = dayVersion(tripId, dayId, USER_A);
        mockMvc.perform(put("/api/trips/{tripId}/itinerary/days/{dayId}/items/reorder", tripId, dayId)
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "orderedItemIds": ["%s", "%s"],
                                  "version": %d
                                }
                                """.formatted(secondItemId, firstItemId, dayVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(secondItemId))
                .andExpect(jsonPath("$.data.items[1].id").value(firstItemId));

        mockMvc.perform(delete("/api/trips/{tripId}/itinerary/items/{itemId}", tripId, firstItemId)
                        .header("Authorization", bearer(USER_A)))
                .andExpect(status().isNoContent());
    }

    @Test
    void createsSuggestedItineraryItemWithoutTimes() throws Exception {
        String tripId = createTrip(USER_A, "Da Nang", "2026-10-01", "2026-10-02");
        String dayId = firstDayId(tripId, USER_A);

        mockMvc.perform(post("/api/trips/{tripId}/itinerary/days/{dayId}/items", tripId, dayId)
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "MEAL",
                                  "title": "Nha hang Madame Lan",
                                  "startTime": null,
                                  "endTime": null,
                                  "durationMinutes": 90,
                                  "notes": "Popular Vietnamese restaurant suggestion added manually."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Nha hang Madame Lan"))
                .andExpect(jsonPath("$.data.type").value("MEAL"));
    }

    @Test
    void createsItemAfterDeleteWithoutReusingSortOrder() throws Exception {
        String tripId = createTrip(USER_A, "Da Nang", "2026-10-01", "2026-10-02");
        String dayId = firstDayId(tripId, USER_A);
        String firstItemId = createItem(tripId, dayId, USER_A, "Breakfast");
        createItem(tripId, dayId, USER_A, "Museum");

        mockMvc.perform(delete("/api/trips/{tripId}/itinerary/items/{itemId}", tripId, firstItemId)
                        .header("Authorization", bearer(USER_A)))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/trips/{tripId}/itinerary/days/{dayId}/items", tripId, dayId)
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "MEAL",
                                  "title": "Nha hang Madame Lan",
                                  "startTime": "12:00",
                                  "endTime": "13:30",
                                  "durationMinutes": 90
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sortOrder").value(3000));
    }

    @Test
    void blocksDateShrinkThroughControllerWhenItemsWouldFallOutsideRange() throws Exception {
        String tripId = createTrip(USER_A, "Nha Trang", "2026-11-01", "2026-11-03");
        List<String> dayIds = dayIds(tripId, USER_A);
        createItem(tripId, dayIds.get(2), USER_A, "Last day coffee");

        mockMvc.perform(patch("/api/trips/{tripId}", tripId)
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "startDate": "2026-11-01",
                                  "endDate": "2026-11-02",
                                  "dateChangePolicy": "BLOCK_IF_ITEMS_OUTSIDE_RANGE"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DATE_CHANGE_BLOCKED"));
    }

    @Test
    void archiveTripRemovesItFromDefaultList() throws Exception {
        String tripId = createTrip(USER_B, "Da Lat", "2026-12-01", "2026-12-03");

        mockMvc.perform(delete("/api/trips/{tripId}", tripId)
                        .header("Authorization", bearer(USER_B)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/trips")
                        .header("Authorization", bearer(USER_B)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == '%s')]".formatted(tripId), hasSize(0)));
    }

    @Test
    void listTripsFiltersByDateWindow() throws Exception {
        String outsideTripId = createTrip(USER_A, "Sapa", "2027-01-10", "2027-01-12");
        String insideTripId = createTrip(USER_A, "Phu Quoc", "2027-02-10", "2027-02-12");

        mockMvc.perform(get("/api/trips?from=2027-02-01&to=2027-02-28")
                        .header("Authorization", bearer(USER_A)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == '%s')]".formatted(insideTripId), hasSize(1)))
                .andExpect(jsonPath("$.data.content[?(@.id == '%s')]".formatted(outsideTripId), hasSize(0)));
    }

    @Test
    void rejectsInvalidTripDatesThroughController() throws Exception {
        mockMvc.perform(post("/api/trips")
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Past Trip",
                                  "destinationName": "Da Nang",
                                  "startDate": "2026-08-18",
                                  "endDate": "2026-08-20"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TRIP_DATE_RANGE"));

        mockMvc.perform(post("/api/trips")
                        .header("Authorization", bearer(USER_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Same Day Trip",
                                  "destinationName": "Da Nang",
                                  "startDate": "2026-10-01",
                                  "endDate": "2026-10-01"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_TRIP_DATE_RANGE"));
    }

    private String createTrip(UUID userId, String destination, String startDate, String endDate) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/trips")
                        .header("Authorization", bearer(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s Trip",
                                  "destinationName": "%s",
                                  "startDate": "%s",
                                  "endDate": "%s",
                                  "travelerCount": 2,
                                  "budgetAmount": 5000000,
                                  "budgetCurrency": "VND"
                                }
                                """.formatted(destination, destination, startDate, endDate)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").exists())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private String createItem(String tripId, String dayId, UUID userId, String title) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/trips/{tripId}/itinerary/days/{dayId}/items", tripId, dayId)
                        .header("Authorization", bearer(userId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "NOTE",
                                  "title": "%s",
                                  "startTime": "09:00",
                                  "endTime": "10:00",
                                  "durationMinutes": 60
                                }
                                """.formatted(title)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").exists())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
    }

    private String firstDayId(String tripId, UUID userId) throws Exception {
        return dayIds(tripId, userId).getFirst();
    }

    private List<String> dayIds(String tripId, UUID userId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/trips/{tripId}/itinerary", tripId)
                        .header("Authorization", bearer(userId)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.days[*].id");
    }

    private int dayVersion(String tripId, String dayId, UUID userId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/trips/{tripId}/itinerary/days/{dayId}", tripId, dayId)
                        .header("Authorization", bearer(userId)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.version");
    }

    private String bearer(UUID userId) {
        return "Bearer " + Jwts.builder()
                .setSubject(userId.toString())
                .claim("email", userId + "@tripsense.test")
                .claim("role", "USER")
                .claim("type", "ACCESS")
                .setIssuedAt(Date.from(Instant.now()))
                .setExpiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(signingKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    private Key signingKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }
}
