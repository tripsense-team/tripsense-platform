package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.BlockSide;
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
public class GuideInquiryBlockId implements Serializable {

  @Column(name = "guide_business_id", nullable = false)
  private UUID guideBusinessId;

  @Column(name = "customer_id", nullable = false)
  private UUID customerId;

  @Enumerated(EnumType.STRING)
  @Column(name = "blocked_by_side", nullable = false, length = 20)
  private BlockSide blockedBySide;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    GuideInquiryBlockId that = (GuideInquiryBlockId) o;
    return Objects.equals(guideBusinessId, that.guideBusinessId)
        && Objects.equals(customerId, that.customerId)
        && blockedBySide == that.blockedBySide;
  }

  @Override
  public int hashCode() {
    return Objects.hash(guideBusinessId, customerId, blockedBySide);
  }
}
