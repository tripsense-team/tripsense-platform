package fu.tripsense.recommendation.adapter.out.semantic;

import fu.tripsense.recommendation.domain.PlaceSnapshot;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class PlaceSemanticDocumentBuilder {
  public PlaceSemanticDocument build(PlaceSnapshot place) {
    String content =
        Stream.of(
                place.name(),
                String.join(" ", place.categories()),
                place.description(),
                place.address(),
                place.city(),
                place.district())
            .filter(value -> value != null && !value.isBlank())
            .map(String::trim)
            .distinct()
            .reduce((left, right) -> left + "\n" + right)
            .orElse("");
    return new PlaceSemanticDocument(place.id(), content, hash(content));
  }

  private String hash(String value) {
    try {
      byte[] encoded =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return java.util.HexFormat.of().formatHex(encoded);
    } catch (Exception exception) {
      throw new IllegalStateException("Could not hash place semantic document", exception);
    }
  }
}
