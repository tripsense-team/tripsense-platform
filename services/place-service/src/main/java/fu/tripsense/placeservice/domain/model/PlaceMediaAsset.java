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
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "place_media_assets")
@CompoundIndex(
    name = "place_media_resolution_idx",
    def = "{'placeId': 1, 'moderationStatus': 1, 'healthStatus': 1}")
@CompoundIndex(
    name = "place_media_source_idx",
    def = "{'sourceProvider': 1, 'sourceReferenceHash': 1}",
    sparse = true)
@CompoundIndex(
    name = "place_media_checksum_active_unique_idx",
    def = "{'checksumSha256': 1}",
    unique = true,
    partialFilter = "{'deletedAt': null}")
public class PlaceMediaAsset {
  @Id private String id;
  @Indexed private String placeId;
  private StorageProvider storageProvider;

  @Indexed(unique = true)
  private String storagePublicId;

  private SourceType sourceType;
  private String sourceProvider;
  private String sourceReferenceHash;
  private LicenseType licenseType;
  private String licenseEvidenceUrl;
  @Builder.Default private List<Attribution> attribution = new ArrayList<>();

  private String checksumSha256;
  private String perceptualHash;
  private String mimeType;
  private Long byteSize;
  private Integer width;
  private Integer height;
  private ModerationStatus moderationStatus;
  private HealthStatus healthStatus;
  private Instant verifiedAt;
  private Instant deletedAt;
  private String createdBy;
  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;
  @Version private Long version;

  public enum StorageProvider { CLOUDINARY }

  public enum SourceType {
    ADMIN_UPLOAD,
    PARTNER_APPROVED,
    COMMUNITY_APPROVED,
    LICENSED_PROVIDER_IMPORT
  }

  public enum LicenseType {
    OWNED,
    PARTNER_GRANTED,
    CC_BY,
    PROVIDER_PERSISTENCE_ALLOWED
  }

  public enum ModerationStatus { PENDING, APPROVED, REJECTED }

  public enum HealthStatus { HEALTHY, DEGRADED, MISSING }

  public record Attribution(String label, String url) {}
}
