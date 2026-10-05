package fu.tripsense.socialservice.entity;

import java.io.Serializable;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class SocialTripShareSnapshotId implements Serializable {
  private UUID postId;
  private Integer snapshotVersion;
}
