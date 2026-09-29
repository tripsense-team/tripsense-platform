package fu.tripsense.placeservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchEnrichmentRequest {
  @Builder.Default private Integer concurrency = 5;
  @Builder.Default private Integer limit = 1000;
  @Builder.Default private Boolean forceAll = false;
}
