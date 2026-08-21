package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.dto.PlaceDto;

public interface PlacePersistenceService {

    PlaceDto upsertProviderPlace(PlaceDto dto, String defaultProvider);

    PlaceDto enrichExistingPlace(Place entity, PlaceDto enrichment);

    PlaceDto toDto(Place place);
}
