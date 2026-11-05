package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.RentalCategory;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "partner_rental_item")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartnerRentalItem {

  @Id private UUID id;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "name", nullable = false, length = 200)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "category", nullable = false, length = 50)
  private RentalCategory category;

  @Column(name = "subcategory", length = 50)
  private String subcategory;

  @Column(name = "description", columnDefinition = "text")
  private String description;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "images", columnDefinition = "jsonb")
  @Builder.Default
  private List<String> images = List.of();

  @Column(name = "price_per_day", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal pricePerDay = BigDecimal.ZERO;

  @Column(name = "price_per_hour", precision = 12, scale = 2)
  private BigDecimal pricePerHour;

  @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal depositAmount = BigDecimal.ZERO;

  @Column(name = "deposit_policy", length = 500)
  private String depositPolicy;

  @Column(name = "total_inventory", nullable = false)
  @Builder.Default
  private int totalInventory = 1;

  @Column(name = "delivery_available", nullable = false)
  @Builder.Default
  private boolean deliveryAvailable = false;

  @Column(name = "delivery_fee", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal deliveryFee = BigDecimal.ZERO;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "specifications", columnDefinition = "jsonb")
  private Map<String, Object> specifications;

  @Column(name = "is_active", nullable = false)
  @Builder.Default
  private boolean active = true;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void prePersist() {
    if (id == null) id = UUID.randomUUID();
    if (createdAt == null) createdAt = Instant.now();
    if (updatedAt == null) updatedAt = Instant.now();
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = Instant.now();
  }
}

