package fu.tripsense.placeservice.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZioMapKeyUpdateRequest {
  @NotBlank(message = "API key must not be blank")
  private String apiKey;
}
