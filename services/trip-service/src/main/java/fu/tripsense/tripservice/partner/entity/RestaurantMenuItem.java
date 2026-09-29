package fu.tripsense.tripservice.partner.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "restaurant_menu_item")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantMenuItem {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "name", nullable = false, length = 160)
  private String name;

  @Column(name = "category", length = 80)
  private String category;

  @Column(name = "description", length = 500)
  private String description;

  @Column(name = "price", nullable = false, precision = 16, scale = 2)
  private BigDecimal price;

  @Column(name = "currency", nullable = false, length = 3)
  @Builder.Default
  private String currency = "VND";

  @Column(name = "tags", columnDefinition = "jsonb")
  private String tags;

  @Column(name = "available", nullable = false)
  @Builder.Default
  private boolean available = true;

  @Column(name = "display_order", nullable = false)
  @Builder.Default
  private int displayOrder = 0;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    Instant now = Instant.now();
    if (createdAt == null) createdAt = now;
    if (updatedAt == null) updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}
