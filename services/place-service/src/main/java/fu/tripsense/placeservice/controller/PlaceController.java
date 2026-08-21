package fu.tripsense.placeservice.controller;

import fu.tripsense.placeservice.dto.ApiResponse;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.service.PlaceSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private final PlaceSearchService placeSearchService;

    public PlaceController(PlaceSearchService placeSearchService) {
        this.placeSearchService = placeSearchService;
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<PlaceDto>>> search(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lng", required = false) Double lng,
            @RequestParam(name = "radius", required = false) Integer radius,
            @RequestParam(name = "limit", required = false, defaultValue = "20") Integer limit
    ) {
        if (!StringUtils.hasText(query)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_QUERY", "Query parameter 'q' must not be blank"));
        }
        if (query.length() > 200) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_QUERY", "Query parameter 'q' must not exceed 200 characters"));
        }
        if ((lat == null) != (lng == null)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_COORDINATES", "Latitude and longitude must be provided together"));
        }

        if (lat != null && (lat < -90.0 || lat > 90.0)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_COORDINATES", "Latitude must be between -90 and 90"));
        }
        if (lng != null && (lng < -180.0 || lng > 180.0)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_COORDINATES", "Longitude must be between -180 and 180"));
        }
        if (radius != null && (radius < 100 || radius > 50_000)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_RADIUS", "Radius must be between 100 and 50000 meters"));
        }
        if (limit == null || limit < 1 || limit > 50) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_LIMIT", "Limit must be between 1 and 50"));
        }

        List<PlaceDto> results = placeSearchService.searchPlaces(query, lat, lng, radius, limit);

        Map<String, Object> meta = new HashMap<>();
        meta.put("query", query);
        meta.put("total", results.size());

        return ResponseEntity.ok(ApiResponse.ok(results, meta));
    }

    @GetMapping("/autocomplete")
    public ResponseEntity<ApiResponse<List<AutocompleteSuggestionDto>>> autocomplete(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lng", required = false) Double lng,
            @RequestParam(name = "radius", required = false) Integer radius,
            @RequestParam(name = "limit", required = false, defaultValue = "5") Integer limit
    ) {
        if (!StringUtils.hasText(query)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_QUERY", "Query parameter 'q' must not be blank"));
        }
        if (query.length() > 200 || (lat == null) != (lng == null)
                || (lat != null && (lat < -90.0 || lat > 90.0))
                || (lng != null && (lng < -180.0 || lng > 180.0))) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_REQUEST", "Invalid query or coordinates"));
        }
        if (radius != null && (radius < 100 || radius > 50_000)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_RADIUS", "Radius must be between 100 and 50000 meters"));
        }
        if (limit == null || limit < 1 || limit > 10) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_LIMIT", "Limit must be between 1 and 10"));
        }

        List<AutocompleteSuggestionDto> suggestions = placeSearchService.autocomplete(query, lat, lng, radius, limit);

        Map<String, Object> meta = new HashMap<>();
        meta.put("query", query);
        meta.put("total", suggestions.size());

        return ResponseEntity.ok(ApiResponse.ok(suggestions, meta));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PlaceDto>> getById(
            @PathVariable("id") String id,
            @RequestParam(name = "name", required = false) String name,
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lng", required = false) Double lng
    ) {
        if (!StringUtils.hasText(id) || !id.matches("[A-Za-z0-9._:-]{1,200}")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_ID", "Place ID must not be blank"));
        }

        Optional<PlaceDto> place = placeSearchService.getPlaceDetails(id, name, lat, lng);
        if (place.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error("PLACE_NOT_FOUND", "No place found with ID: " + id));
        }

        return ResponseEntity.ok(ApiResponse.ok(place.get()));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<PlaceDto>>> nearby(
            @RequestParam("lat") Double lat,
            @RequestParam("lng") Double lng,
            @RequestParam(name = "radius", required = false, defaultValue = "5000") Integer radius,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "limit", required = false, defaultValue = "20") Integer limit
    ) {
        if (lat == null || lat < -90.0 || lat > 90.0 || lng == null || lng < -180.0 || lng > 180.0) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_COORDINATES", "Valid lat and lng are required"));
        }
        if (radius == null || radius < 100 || radius > 50_000) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_RADIUS", "Radius must be between 100 and 50000 meters"));
        }
        if (limit == null || limit < 1 || limit > 50) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_LIMIT", "Limit must be between 1 and 50"));
        }

        List<PlaceDto> places = placeSearchService.getNearbyPlaces(lat, lng, radius, category, limit);

        Map<String, Object> meta = new HashMap<>();
        meta.put("lat", lat);
        meta.put("lng", lng);
        meta.put("radius", radius);
        meta.put("total", places.size());

        return ResponseEntity.ok(ApiResponse.ok(places, meta));
    }
}
