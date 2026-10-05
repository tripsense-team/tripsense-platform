package fu.tripsense.socialservice.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "social_trending_destinations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialTrendingDestination {

  @Id
  @Column(name = "id", length = 64)
  private String id;

  @Column(name = "name", nullable = false, length = 120)
  private String name;

  @Column(name = "city_name_key", nullable = false, length = 120)
  private String cityNameKey;

  @Column(name = "image_url", nullable = false, columnDefinition = "TEXT")
  private String imageUrl;

  @Column(name = "base_share_count", nullable = false)
  private int baseShareCount;

  @Column(name = "subtitle", nullable = false, length = 255)
  private String subtitle;

  @Column(name = "subtitle_key", nullable = false, length = 120)
  private String subtitleKey;

  @Column(name = "slug", nullable = false, length = 120, unique = true)
  private String slug;

  @Column(name = "sort_order", nullable = false)
  private short sortOrder;

  @Column(name = "is_active", nullable = false)
  private boolean isActive;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
