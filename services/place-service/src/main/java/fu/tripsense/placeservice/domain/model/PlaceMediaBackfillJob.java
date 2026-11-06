package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "place_media_backfill_jobs")
public class PlaceMediaBackfillJob {
  @Id private String id;
  @Indexed(unique = true) private String idempotencyKey;
  private String destinationId;
  @Builder.Default private List<PlaceMediaState> states = new ArrayList<>();
  private Integer requestedLimit;
  private Integer maxConcurrency;
  private boolean dryRun;
  private Status status;
  private Integer total;
  private Integer processed;
  private Integer succeeded;
  private Integer failed;
  private String lastReasonCode;
  private String createdBy;
  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;

  public enum Status { QUEUED, RUNNING, COMPLETED, FAILED }
}
