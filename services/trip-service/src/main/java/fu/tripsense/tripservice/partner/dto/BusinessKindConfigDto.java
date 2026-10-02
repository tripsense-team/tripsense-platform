package fu.tripsense.tripservice.partner.dto;

import fu.tripsense.tripservice.partner.enums.BusinessKind;
import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import java.util.List;
import lombok.Builder;

@Builder
public record BusinessKindConfigDto(
    int schemaVersion,
    String region,
    boolean submitEnabled,
    List<KindDescriptorDto> kinds
) {
  @Builder
  public record KindDescriptorDto(
      BusinessKind kind,
      String title,
      String description,
      String checklistId,
      String checklistVersion,
      List<GoalBundleDto> goalBundles,
      List<PartnerCapability> supportedCapabilities
  ) {}

  @Builder
  public record GoalBundleDto(
      String code,
      String title,
      String description,
      List<PartnerCapability> capabilities
  ) {}
}
