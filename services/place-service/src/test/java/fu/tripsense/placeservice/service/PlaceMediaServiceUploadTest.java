package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.repository.PlaceMediaAssetRepository;
import fu.tripsense.placeservice.domain.repository.PlaceMediaBackfillJobRepository;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.providers.PlaceProvider;
import fu.tripsense.placeservice.security.CurrentUserProvider;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadPoolExecutor;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.mock.web.MockMultipartFile;

class PlaceMediaServiceUploadTest {
  private final PlaceRepository places = mock(PlaceRepository.class);
  private final PlaceMediaAssetRepository assets = mock(PlaceMediaAssetRepository.class);
  private final PlaceMediaStorage storage = mock(PlaceMediaStorage.class);
  private final CurrentUserProvider currentUser = mock(CurrentUserProvider.class);
  private final MongoTemplate mongo = mock(MongoTemplate.class);

  private PlaceMediaService service() {
    return new PlaceMediaService(
        places, assets, mock(PlaceMediaBackfillJobRepository.class), storage,
        mock(PlaceProvider.class), currentUser, mongo, mock(ThreadPoolExecutor.class),
        mock(ThreadPoolExecutor.class), false, "");
  }

  @Test
  void removesMetadataBeforeObjectWhenPrimarySelectionConflicts() {
    when(places.findById("place-1")).thenReturn(Optional.of(Place.builder().id("place-1").build()));
    when(currentUser.userId()).thenReturn(UUID.randomUUID());
    when(storage.upload(eq("place-1"), any(), any(org.springframework.web.multipart.MultipartFile.class)))
        .thenReturn(new PlaceMediaStorage.StoredMedia(
            "public-1", "https://example.test/photo", "image/jpeg", 100, 10, 10, "checksum"));
    when(assets.save(any(PlaceMediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
    // Mongo returns null for a stale mediaVersion: the selected primary was not committed.
    when(mongo.findAndModify(any(Query.class), any(Update.class),
        any(org.springframework.data.mongodb.core.FindAndModifyOptions.class), eq(Place.class)))
        .thenReturn(null);

    assertThatThrownBy(() -> service().upload("place-1",
        new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[] {1}),
        PlaceMediaAsset.SourceType.ADMIN_UPLOAD, PlaceMediaAsset.LicenseType.OWNED,
        null, null, null, true))
        .isInstanceOf(PlaceActionException.class);

    InOrder order = inOrder(assets, storage);
    order.verify(assets).save(any(PlaceMediaAsset.class));
    order.verify(assets).deleteById(any());
    order.verify(storage).delete("place-1", "public-1");
  }

  @Test
  void keepsObjectIfMetadataCleanupFails() {
    when(places.findById("place-1")).thenReturn(Optional.of(Place.builder().id("place-1").build()));
    when(currentUser.userId()).thenReturn(UUID.randomUUID());
    when(storage.upload(eq("place-1"), any(), any(org.springframework.web.multipart.MultipartFile.class)))
        .thenReturn(new PlaceMediaStorage.StoredMedia(
            "public-1", "https://example.test/photo", "image/jpeg", 100, 10, 10, "checksum"));
    when(assets.save(any(PlaceMediaAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
    org.mockito.Mockito.doThrow(new IllegalStateException("mongo unavailable"))
        .when(assets).deleteById(any());

    assertThatThrownBy(() -> service().upload("place-1",
        new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[] {1}),
        PlaceMediaAsset.SourceType.ADMIN_UPLOAD, PlaceMediaAsset.LicenseType.OWNED,
        null, null, null, true))
        .isInstanceOf(PlaceActionException.class);

    org.mockito.Mockito.verify(storage, org.mockito.Mockito.never()).delete(any(), any());
  }

  @Test
  void removesAmbiguouslySavedMetadataBeforeObject() {
    when(places.findById("place-1")).thenReturn(Optional.of(Place.builder().id("place-1").build()));
    when(currentUser.userId()).thenReturn(UUID.randomUUID());
    when(storage.upload(eq("place-1"), any(), any(org.springframework.web.multipart.MultipartFile.class)))
        .thenReturn(new PlaceMediaStorage.StoredMedia(
            "public-1", "https://example.test/photo", "image/jpeg", 100, 10, 10, "checksum"));
    when(assets.save(any(PlaceMediaAsset.class)))
        .thenThrow(new IllegalStateException("write acknowledgement lost"));
    when(assets.existsById(any())).thenReturn(true);

    assertThatThrownBy(() -> service().upload("place-1",
        new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[] {1}),
        PlaceMediaAsset.SourceType.ADMIN_UPLOAD, PlaceMediaAsset.LicenseType.OWNED,
        null, null, null, true))
        .isInstanceOf(IllegalStateException.class);

    InOrder order = inOrder(assets, storage);
    order.verify(assets).existsById(any());
    order.verify(assets).deleteById(any());
    order.verify(storage).delete("place-1", "public-1");
  }
}
