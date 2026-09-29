package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.ContactConsentChannel;
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
public class PartnerInquiryContactConsentId implements Serializable {

  @Column(name = "inquiry_id", nullable = false)
  private UUID inquiryId;

  @Column(name = "grantor_user_id", nullable = false)
  private UUID grantorUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "channel", nullable = false, length = 20)
  private ContactConsentChannel channel;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    PartnerInquiryContactConsentId that = (PartnerInquiryContactConsentId) o;
    return Objects.equals(inquiryId, that.inquiryId)
        && Objects.equals(grantorUserId, that.grantorUserId)
        && channel == that.channel;
  }

  @Override
  public int hashCode() {
    return Objects.hash(inquiryId, grantorUserId, channel);
  }
}
