package fu.tripsense.placeservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceStatsDto {
  private long totalPlaces;
  private long enrichedPlaces;
  private long pendingPlaces;
  private boolean zioMapKeyConfigured;
  private String zioMapKeyMasked;
  private boolean isJobRunning;
}
