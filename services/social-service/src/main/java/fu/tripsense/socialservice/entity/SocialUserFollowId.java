package fu.tripsense.socialservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SocialUserFollowId implements Serializable {

  @Column(name = "follower_user_id", nullable = false)
  private UUID followerUserId;

  @Column(name = "followed_user_id", nullable = false)
  private UUID followedUserId;
}
