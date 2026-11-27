package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "place_recommendation_index_jobs")
public class PlaceRecommendationIndexJob {
  @Id private String placeId;
  private Long desiredVersion;
  private Operation operationHint;
  private Status status;
  private int attempts;
  private Instant nextAttemptAt;
  private String leaseToken;
  private Instant leaseUntil;
  private String lastErrorCode;
  private Instant createdAt;
  private Instant updatedAt;

  public enum Operation {
    UPSERT,
    DELETE
  }

  public enum Status {
    PENDING,
    IN_PROGRESS,
    DEAD_LETTER
  }
}
