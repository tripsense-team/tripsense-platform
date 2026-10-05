package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuietnessEvidence {
  private Double score;
  private Integer evidenceCount;
  private String source;
  private Instant observedAt;
}
