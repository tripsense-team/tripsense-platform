package fu.tripsense.tripservice.partner.entity;

import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.RentalBookingStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "rental_booking_order")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RentalBookingOrder {

  @Id private UUID id;

  @Column(name = "booking_code", nullable = false, unique = true, length = 32)
  private String bookingCode;

  @Column(name = "business_id", nullable = false)
  private UUID businessId;

  @Column(name = "rental_item_id", nullable = false)
  private UUID rentalItemId;

  @Column(name = "customer_id", nullable = false)
  private UUID customerId;

  @Column(name = "customer_name", nullable = false, length = 120)
  private String customerName;

  @Column(name = "customer_phone", nullable = false, length = 20)
  private String customerPhone;

  @Column(name = "customer_email", length = 160)
  private String customerEmail;

  @Column(name = "pickup_at", nullable = false)
  private Instant pickupAt;

  @Column(name = "return_at", nullable = false)
  private Instant returnAt;

  @Column(name = "quantity", nullable = false)
  @Builder.Default
  private int quantity = 1;

  @Enumerated(EnumType.STRING)
  @Column(name = "pickup_option", nullable = false, length = 30)
  @Builder.Default
  private PickupOption pickupOption = PickupOption.PICKUP_AT_STORE;

  @Column(name = "delivery_address", columnDefinition = "text")
  private String deliveryAddress;

  @Column(name = "rental_price", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal rentalPrice = BigDecimal.ZERO;

  @Column(name = "delivery_fee", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal deliveryFee = BigDecimal.ZERO;

  @Column(name = "deposit_amount", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal depositAmount = BigDecimal.ZERO;

  @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal totalAmount = BigDecimal.ZERO;

  @Column(name = "currency", nullable = false, length = 8)
  @Builder.Default
  private String currency = "VND";

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 30)
  @Builder.Default
  private RentalBookingStatus status = RentalBookingStatus.PENDING;

  @Column(name = "handover_at")
  private Instant handoverAt;

  @Column(name = "returned_at")
  private Instant returnedAt;

  @Column(name = "overdue_fee", precision = 12, scale = 2)
  @Builder.Default
  private BigDecimal overdueFee = BigDecimal.ZERO;

  @Column(name = "customer_note", columnDefinition = "text")
  private String customerNote;

  @Column(name = "partner_note", columnDefinition = "text")
  private String partnerNote;

  @Column(name = "rejection_reason", columnDefinition = "text")
  private String rejectionReason;

  @Column(name = "chat_offer_id")
  private UUID chatOfferId;

  @Version
  @Column(name = "version", nullable = false)
  @Builder.Default
  private Long version = 0L;

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

