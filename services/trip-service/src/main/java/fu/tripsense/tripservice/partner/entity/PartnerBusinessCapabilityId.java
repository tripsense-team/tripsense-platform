package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.PartnerCapability;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PartnerBusinessCapabilityId implements Serializable {

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Enumerated(EnumType.STRING)
  @Column(name = "capability", nullable = false, length = 50)
  private PartnerCapability capability;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    PartnerBusinessCapabilityId that = (PartnerBusinessCapabilityId) o;
    return Objects.equals(businessId, that.businessId) && capability == that.capability;
  }

  @Override
  public int hashCode() {
    return Objects.hash(businessId, capability);
  }
}
