package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "partner_business_member")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerBusinessMember {

  @EmbeddedId private PartnerBusinessMemberId id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private MembershipRole role;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  @Builder.Default
  private MembershipState state = MembershipState.ACTIVE;

  @Version
  @Column(nullable = false)
  @Builder.Default
  private Long version = 0L;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
