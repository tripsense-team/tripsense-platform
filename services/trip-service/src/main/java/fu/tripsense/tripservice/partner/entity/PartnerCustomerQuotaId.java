package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.time.LocalDate;
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
public class PartnerCustomerQuotaId implements Serializable {

  @Column(name = "customer_id", nullable = false)
  private UUID customerId;

  @Column(name = "quota_date", nullable = false)
  private LocalDate quotaDate;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    PartnerCustomerQuotaId that = (PartnerCustomerQuotaId) o;
    return Objects.equals(customerId, that.customerId) && Objects.equals(quotaDate, that.quotaDate);
  }

  @Override
  public int hashCode() {
    return Objects.hash(customerId, quotaDate);
  }
}
