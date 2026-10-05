package fu.tripsense.placeservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZioMapKeyUpdateResponse {
  private boolean valid;
  private String message;
  private String maskedKey;
}
