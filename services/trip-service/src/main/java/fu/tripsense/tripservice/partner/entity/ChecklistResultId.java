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
public class ChecklistResultId implements Serializable {

  @Column(name = "application_id", nullable = false)
  private UUID applicationId;

  @Column(name = "item_code", nullable = false, length = 100)
  private String itemCode;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    ChecklistResultId that = (ChecklistResultId) o;
    return Objects.equals(applicationId, that.applicationId)
        && Objects.equals(itemCode, that.itemCode);
  }

  @Override
  public int hashCode() {
    return Objects.hash(applicationId, itemCode);
  }
}
