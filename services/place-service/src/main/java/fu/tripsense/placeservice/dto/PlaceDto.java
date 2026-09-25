package fu.tripsense.placeservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.Serializable;
import java.time.Instant;
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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PlaceDto implements Serializable {

  private String id;
  private String provider;
  private String providerPlaceId;
  private String name;
  private LocationDto location;
  private String address;
  private String oldAddress;
  private String city;
  private String district;

  @Builder.Default private List<String> categories = new ArrayList<>();

  private Double rating;
  private Integer userRatingCount;
  private QuietnessEvidenceDto quietnessEvidence;

  @Builder.Default private List<String> photos = new ArrayList<>();

  /** Optional, short-lived display evidence; not stored in Mongo or Redis. */
  private PlacePhotoDto primaryPhoto;

  /** Optional, bounded display-only gallery; not stored in Mongo or Redis. */
  private List<PlacePhotoDto> photoGallery;

  private String phone;
  private String website;

  @Builder.Default private List<String> socials = new ArrayList<>();

  private String openingHours;
  private String businessStatus;
  private String description;

  /** Additive evidence fields used by grounded recommendation consumers. */
  private String source;
  private Instant fetchedAt;
  private String freshness;

  @Builder.Default private List<PlaceReviewDto> reviews = new ArrayList<>();
}
