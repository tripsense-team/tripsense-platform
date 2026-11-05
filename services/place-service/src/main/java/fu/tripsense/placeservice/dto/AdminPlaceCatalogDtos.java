package fu.tripsense.placeservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class AdminPlaceCatalogDtos {
  private AdminPlaceCatalogDtos() {}

  public record Location(
      @DecimalMin("-90") @DecimalMax("90") double lat,
      @DecimalMin("-180") @DecimalMax("180") double lng) {}

  public record MutationRequest(
      @NotBlank @Size(max = 200) String name,
      @Size(max = 80) String primaryType,
      @NotNull @Size(min = 1, max = 20) List<@NotBlank @Size(max = 80) String> categories,
      @NotNull @Valid Location location,
      @NotBlank @Size(max = 500) String address,
      @Size(max = 500) String oldAddress,
      @NotBlank @Size(max = 120) String city,
      @Size(max = 200) String district,
      @Size(max = 40) String phone,
      @Size(max = 2048) String website,
      @Size(max = 10) List<@Size(max = 2048) String> socials,
      @Size(max = 2000) String openingHours,
      @Size(max = 80) String businessStatus,
      @Size(max = 4000) String description) {
    @JsonAnySetter
    public void rejectUnknownField(String name, Object value) {
      throw new IllegalArgumentException("Unknown place field");
    }
  }

  public record Summary(
      String id,
      String name,
      String city,
      String primaryType,
      List<String> categories,
      String provider,
      String managementSource,
      String lifecycleStatus,
      String mediaState,
      String coverPhotoUrl,
      long version,
      Instant updatedAt) {}

  public record Detail(
      String id,
      String name,
      String normalizedName,
      String primaryType,
      List<String> categories,
      Location location,
      String address,
      String oldAddress,
      String city,
      String district,
      String phone,
      String website,
      List<String> socials,
      String openingHours,
      String businessStatus,
      String description,
      String provider,
      String providerPlaceId,
      String managementSource,
      String lifecycleStatus,
      String mediaState,
      String coverPhotoUrl,
      Set<String> manualOverrideFields,
      long version,
      String manualCreatedBy,
      String lastEditedBy,
      String lastAdminAction,
      Instant archivedAt,
      String archivedBy,
      Instant createdAt,
      Instant updatedAt) {}

  public record Page(List<Summary> items, String nextCursor) {}
}
