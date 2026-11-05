package fu.tripsense.placeservice.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PlaceMediaStorageTest {
  private final PlaceMediaStorage storage =
      new PlaceMediaStorage(
          "demo",
          "key",
          "secret",
          "tripsense/places",
          "lh3.googleusercontent.com,ziomap-api.socibi.com",
          new ObjectMapper());

  @Test
  void rejectsDeclaredImageWhoseBytesDoNotMatch() {
    MockMultipartFile file =
        new MockMultipartFile("file", "fake.jpg", "image/jpeg", "not-an-image".getBytes());

    assertThatThrownBy(() -> storage.upload("place-1", "pm-1", file))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("does not match");
  }

  @Test
  void rejectsSvgEvenWhenItContainsImageMarkup() {
    MockMultipartFile file =
        new MockMultipartFile(
            "file", "unsafe.svg", "image/svg+xml", "<svg><script/></svg>".getBytes());

    assertThatThrownBy(() -> storage.upload("place-1", "pm-1", file))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
