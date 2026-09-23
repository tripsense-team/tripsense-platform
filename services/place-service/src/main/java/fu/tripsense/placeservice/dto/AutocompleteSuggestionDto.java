package fu.tripsense.placeservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutocompleteSuggestionDto implements Serializable {

  private String id;
  private String title;
  private String subtitle;
  private String category;
}
