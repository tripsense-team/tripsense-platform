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
public class PlaceReviewDto implements Serializable {
  private String authorName;
  private String profilePhotoUrl;
  private Integer rating;
  private String text;
  private String relativeTimeDescription;
  private Long time;
}
