package fu.tripsense.socialservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;
import lombok.*;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SocialPostSaveId implements Serializable {
  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "post_id", nullable = false)
  private UUID postId;
}
