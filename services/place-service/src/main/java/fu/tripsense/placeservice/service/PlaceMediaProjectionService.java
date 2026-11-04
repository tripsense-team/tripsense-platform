package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceMediaState;
import fu.tripsense.placeservice.domain.repository.PlaceMediaAssetRepository;
import fu.tripsense.placeservice.dto.PlaceDto;
import fu.tripsense.placeservice.dto.PlaceMediaAssetDto;
import fu.tripsense.placeservice.dto.PlaceMediaDto;
import fu.tripsense.placeservice.dto.PlacePhotoDto;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class PlaceMediaProjectionService {
  private final PlaceMediaAssetRepository assets;
  private final PlaceMediaStorage storage;

  public PlaceMediaProjectionService(
      PlaceMediaAssetRepository assets, PlaceMediaStorage storage) {
    this.assets = assets;
    this.storage = storage;
  }

  public PlaceDto decorate(PlaceDto dto, Place place) {
    if (dto == null || place == null || place.getId() == null) return dto;
    List<PlaceMediaAsset> approved =
        new ArrayList<>(
            assets.findByPlaceIdAndModerationStatusAndHealthStatusAndDeletedAtIsNullOrderByCreatedAtAsc(
                place.getId(),
                PlaceMediaAsset.ModerationStatus.APPROVED,
                PlaceMediaAsset.HealthStatus.HEALTHY));
    if (place.getPrimaryMediaAssetId() != null) {
      approved.sort(
          Comparator.comparing(
              asset -> !place.getPrimaryMediaAssetId().equals(asset.getId())));
    }
    List<PlaceMediaAssetDto> gallery = approved.stream().limit(5).map(asset -> toDto(asset, place)).toList();
    PlaceMediaAssetDto primary = gallery.isEmpty() ? null : gallery.getFirst();
    PlaceMediaState state =
        primary == null
            ? (place.getMediaState() == null ? PlaceMediaState.PENDING : place.getMediaState())
            : PlaceMediaState.READY;
    dto.setMedia(
        new PlaceMediaDto(
            state.name(), primary, gallery, primary == null ? "LOCATION" : null));
    if (primary != null) {
      List<String> urls = gallery.stream().map(PlaceMediaAssetDto::url).toList();
      dto.setPhotos(urls);
      dto.setPrimaryPhoto(
          new PlacePhotoDto(primary.url(), "cloudinary", List.of(), Instant.now(), true));
      dto.setPhotoGallery(
          gallery.stream()
              .map(item -> new PlacePhotoDto(item.url(), "cloudinary", List.of(), Instant.now(), true))
              .toList());
    } else {
      dto.setPhotos(List.of());
      dto.setPrimaryPhoto(null);
      dto.setPhotoGallery(List.of());
    }
    return dto;
  }

  private PlaceMediaAssetDto toDto(PlaceMediaAsset asset, Place place) {
    return new PlaceMediaAssetDto(
        asset.getId(),
        storage.deliveryUrl(asset.getStoragePublicId()),
        asset.getWidth(),
        asset.getHeight(),
        place.getName(),
        asset.getAttribution() == null
            ? List.of()
            : asset.getAttribution().stream()
                .map(value -> new PlaceMediaAssetDto.AttributionDto(value.label(), value.url()))
                .toList());
  }
}
