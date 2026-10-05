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
public class GuideInquiryRequirementsId implements Serializable {

  @Column(name = "inquiry_id", nullable = false)
  private UUID inquiryId;

  @Column(name = "revision", nullable = false)
  private Integer revision;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    GuideInquiryRequirementsId that = (GuideInquiryRequirementsId) o;
    return Objects.equals(inquiryId, that.inquiryId) && Objects.equals(revision, that.revision);
  }

  @Override
  public int hashCode() {
    return Objects.hash(inquiryId, revision);
  }
}
