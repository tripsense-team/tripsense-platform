package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistId implements Serializable {

  @Column(nullable = false, length = 100)
  private String id;

  @Column(nullable = false, length = 50)
  private String version;

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (o == null || getClass() != o.getClass()) return false;
    ChecklistId that = (ChecklistId) o;
    return Objects.equals(id, that.id) && Objects.equals(version, that.version);
  }

  @Override
  public int hashCode() {
    return Objects.hash(id, version);
  }
}
