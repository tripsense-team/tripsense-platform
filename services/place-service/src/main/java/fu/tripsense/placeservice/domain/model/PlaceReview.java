package fu.tripsense.placeservice.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceReview {
    private String authorName;
    private String profilePhotoUrl;
    private Integer rating;
    private String text;
    private String relativeTimeDescription;
    private Long time;
}
