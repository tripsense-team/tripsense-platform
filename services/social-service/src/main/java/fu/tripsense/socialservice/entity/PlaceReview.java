package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "place_reviews")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceReview {
  @Id private UUID id;

  @Column(name = "place_ref", nullable = false, length = 200)
  private String placeRef;

  @Column(name = "author_user_id", nullable = false)
  private UUID authorUserId;

  @Column(nullable = false)
  private short rating;

  @Column(nullable = false, length = 2000)
  private String content;

  @Column(nullable = false, length = 16)
  private String status;

  @Version private Long version;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "deleted_at")
  private Instant deletedAt;
}
