package fu.tripsense.placeservice.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SavedPlaceDto(
    String placeRef, PlaceDto place, List<UUID> collectionIds, Instant savedAt) {}
