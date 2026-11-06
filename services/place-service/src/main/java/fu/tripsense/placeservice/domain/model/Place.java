package fu.tripsense.placeservice.domain.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "places")
@CompoundIndex(
    name = "provider_place_unique_idx",
    def = "{'provider': 1, 'providerPlaceId': 1}",
    unique = true)
@CompoundIndex(
    name = "place_media_coverage_idx",
    def = "{'mediaState': 1, 'city': 1, 'primaryType': 1}")
@CompoundIndex(
    name = "place_admin_catalog_idx",
    def = "{'lifecycleStatus': 1, 'managementSource': 1, 'updatedAt': -1, '_id': -1}")
@CompoundIndex(
    name = "place_lifecycle_updated_idx",
    def = "{'lifecycleStatus': 1, 'updatedAt': -1, '_id': -1}")
@CompoundIndex(
    name = "place_lifecycle_category_updated_idx",
    def = "{'lifecycleStatus': 1, 'city': 1, 'primaryType': 1, 'updatedAt': -1}")
public class Place {

  @Id private String id;

  private String provider;
  private String providerPlaceId;

  @Builder.Default private PlaceManagementSource managementSource = PlaceManagementSource.PROVIDER;

  @Builder.Default private PlaceLifecycleStatus lifecycleStatus = PlaceLifecycleStatus.ACTIVE;

  @Builder.Default private Set<String> manualOverrideFields = new HashSet<>();

  private String manualCreatedBy;
  private String lastEditedBy;
  private String lastAdminAction;
  private String lastAdminRequestId;
  private Instant archivedAt;
  private String archivedBy;

  @Version private Long version;

  @TextIndexed(weight = 5)
  private String name;

  @Indexed private String normalizedName;

  @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
  private GeoJsonPoint location;

  @TextIndexed(weight = 2)
  private String address;

  private String oldAddress;

  private String city;
  private String district;

  @Builder.Default
  @TextIndexed(weight = 3)
  private List<String> categories = new ArrayList<>();

  /** Explicit provider type; never inferred from category order. */
  private String primaryType;

  private Double rating;
  private Integer userRatingCount;
  private QuietnessEvidence quietnessEvidence;
  private PriceEvidence priceEvidence;
  private Instant priceEvidenceEditedAt;
  private String priceEvidenceEditedBy;

  @Builder.Default private List<String> photos = new ArrayList<>();

  @Builder.Default private PlaceMediaState mediaState = PlaceMediaState.PENDING;

  @Indexed(sparse = true)
  private String primaryMediaAssetId;

  private Instant mediaLastVerifiedAt;
  private String mediaStateReason;
  @Builder.Default private Long mediaVersion = 0L;

  private String phone;
  private String website;

  @Builder.Default private List<String> socials = new ArrayList<>();

  private String openingHours;
  private String businessStatus;

  @Builder.Default private List<PlaceReview> reviews = new ArrayList<>();

  @TextIndexed(weight = 1)
  private String description;

  private Map<String, Object> sourceData;

  @CreatedDate private Instant createdAt;

  @LastModifiedDate private Instant updatedAt;

  private Instant lastFetchedAt;
}
