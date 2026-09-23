package fu.tripsense.socialservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "social_user_follows")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialUserFollow {

  @EmbeddedId private SocialUserFollowId id;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;
}
