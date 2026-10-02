package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "partner_customer_quota")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerCustomerQuota {

  @EmbeddedId private PartnerCustomerQuotaId id;

  @Column(name = "new_inquiries_count", nullable = false)
  @Builder.Default
  private int newInquiriesCount = 0;

  @Column(name = "open_inquiries_count", nullable = false)
  @Builder.Default
  private int openInquiriesCount = 0;

  @Column(name = "updated_at", nullable = false)
  @Builder.Default
  private Instant updatedAt = Instant.now();

  @PreUpdate
  public void preUpdate() {
    this.updatedAt = Instant.now();
  }
}
