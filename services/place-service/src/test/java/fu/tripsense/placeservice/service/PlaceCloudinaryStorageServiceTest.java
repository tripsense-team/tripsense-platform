package fu.tripsense.placeservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class PlaceCloudinaryStorageServiceTest {

  @Test
  void reportsConfiguredWhenCredentialsPresent() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");
    assertTrue(service.isConfigured());
  }

  @Test
  void reportsNotConfiguredWhenAnyCredentialMissing() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("", "key123", "secret456", "tripsense/places");
    assertFalse(service.isConfigured());

    PlaceCloudinaryStorageService service2 =
        new PlaceCloudinaryStorageService("my-cloud", "", "secret456", "tripsense/places");
    assertFalse(service2.isConfigured());

    PlaceCloudinaryStorageService service3 =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "", "tripsense/places");
    assertFalse(service3.isConfigured());
  }

  @Test
  void identifiesCloudinaryUrlsAccurately() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");

    assertTrue(service.isCloudinaryUrl("https://res.cloudinary.com/dejiclsce/image/upload/v1/test.jpg"));
    assertFalse(service.isCloudinaryUrl("https://lh3.googleusercontent.com/places/ABC=s4800-w640"));
    assertFalse(service.isCloudinaryUrl(null));
    assertFalse(service.isCloudinaryUrl(""));
  }

  @Test
  void returnsExistingUrlIfAlreadyCloudinary() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");

    String existingCdnUrl = "https://res.cloudinary.com/dejiclsce/image/upload/v1234/tripsense/places/p1/photo_0.jpg";
    Optional<String> result = service.uploadRemotePhoto(existingCdnUrl, "p1", 0);
    assertTrue(result.isPresent());
    assertEquals(existingCdnUrl, result.get());
  }

  @Test
  void returnsEmptyIfRemoteUrlEmptyOrNotConfigured() {
    PlaceCloudinaryStorageService unconfigured =
        new PlaceCloudinaryStorageService("", "", "", "tripsense/places");

    Optional<String> resultEmptyUrl = unconfigured.uploadRemotePhoto("", "p1", 0);
    assertTrue(resultEmptyUrl.isEmpty());

    Optional<String> resultUnconfigured =
        unconfigured.uploadRemotePhoto("https://lh3.googleusercontent.com/abc", "p1", 0);
    assertTrue(resultUnconfigured.isEmpty());
  }
}

