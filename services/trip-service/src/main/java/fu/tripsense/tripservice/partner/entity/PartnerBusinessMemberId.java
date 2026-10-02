package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
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
public class PartnerBusinessMemberId implements Serializable {

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    PartnerBusinessMemberId that = (PartnerBusinessMemberId) o;
    return Objects.equals(businessId, that.businessId) && Objects.equals(userId, that.userId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(businessId, userId);
  }
}
