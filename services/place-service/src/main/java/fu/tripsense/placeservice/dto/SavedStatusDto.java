package fu.tripsense.placeservice.dto;

import java.util.List;
import java.util.UUID;

public record SavedStatusDto(String placeRef, boolean saved, List<UUID> collectionIds) {}
