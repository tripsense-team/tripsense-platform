package fu.tripsense.socialservice.service;

import static org.assertj.core.api.Assertions.*;

import fu.tripsense.socialservice.exception.SocialException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SavedPostCursorCodecTest {
  private final SavedPostCursorCodec codec =
      new SavedPostCursorCodec("test-secret-that-is-at-least-thirty-two-bytes");

  @Test
  void roundTripsSignedCursor() {
    Instant createdAt = Instant.parse("2026-10-29T00:00:00Z");
    UUID postId = UUID.randomUUID();

    var decoded = codec.decode(codec.encode(createdAt, postId));

    assertThat(decoded.createdAt()).isEqualTo(createdAt);
    assertThat(decoded.postId()).isEqualTo(postId);
  }

  @Test
  void rejectsTamperedCursor() {
    String cursor = codec.encode(Instant.now(), UUID.randomUUID());
    int changedIndex = cursor.length() / 2;
    char replacement = cursor.charAt(changedIndex) == 'A' ? 'B' : 'A';
    String tampered =
        cursor.substring(0, changedIndex) + replacement + cursor.substring(changedIndex + 1);

    assertThatThrownBy(() -> codec.decode(tampered))
        .isInstanceOf(SocialException.class)
        .hasMessageContaining("cursor is invalid");
  }
}
