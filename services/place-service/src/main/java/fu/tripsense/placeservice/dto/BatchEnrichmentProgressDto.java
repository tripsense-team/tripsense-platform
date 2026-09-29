package fu.tripsense.placeservice.dto;

import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchEnrichmentProgressDto {
  private String jobId;
  private String status; // "IDLE", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"
  private int total;
  private int processed;
  private int success;
  private int failed;
  private double percentage;
  private long elapsedSeconds;
  private long estimatedRemainingSeconds;
  private String currentPlaceName;
  @Builder.Default private List<String> recentLogs = new ArrayList<>();
}
