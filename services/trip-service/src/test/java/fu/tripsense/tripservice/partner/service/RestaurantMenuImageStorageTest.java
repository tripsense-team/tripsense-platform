package fu.tripsense.tripservice.partner.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class RestaurantMenuImageStorageTest {

  @Test
  void rejectsUnsupportedMimeBeforeUsingProviderConfiguration() {
    RestaurantMenuImageStorage storage = new RestaurantMenuImageStorage("", "", "", "tripsense/partners");
    MockMultipartFile svg = new MockMultipartFile(
        "file", "dish.svg", "image/svg+xml", "<svg></svg>".getBytes());

    assertThatThrownBy(() -> storage.upload(UUID.randomUUID(), svg))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Unsupported image type");
  }

  @Test
  void rejectsMimeContentMismatchBeforeUsingProviderConfiguration() {
    RestaurantMenuImageStorage storage = new RestaurantMenuImageStorage("", "", "", "tripsense/partners");
    MockMultipartFile invalidPng = new MockMultipartFile(
        "file", "dish.png", "image/png", "not a png".getBytes());

    assertThatThrownBy(() -> storage.upload(UUID.randomUUID(), invalidPng))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Image content does not match its declared type");
  }
}
