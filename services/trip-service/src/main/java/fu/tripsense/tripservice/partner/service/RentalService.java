package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.PartnerBusiness;
import fu.tripsense.tripservice.partner.entity.PartnerBusinessMember;
import fu.tripsense.tripservice.partner.entity.PartnerNotification;
import fu.tripsense.tripservice.partner.entity.PartnerRentalItem;
import fu.tripsense.tripservice.partner.entity.RentalBookingOrder;
import fu.tripsense.tripservice.partner.enums.MembershipRole;
import fu.tripsense.tripservice.partner.enums.MembershipState;
import fu.tripsense.tripservice.partner.enums.OperationState;
import fu.tripsense.tripservice.partner.enums.PickupOption;
import fu.tripsense.tripservice.partner.enums.RentalBookingStatus;
import fu.tripsense.tripservice.partner.enums.RentalCategory;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessMemberRepository;
import fu.tripsense.tripservice.partner.repository.PartnerBusinessRepository;
import fu.tripsense.tripservice.partner.repository.PartnerRentalItemRepository;
import fu.tripsense.tripservice.partner.repository.RentalBookingOrderRepository;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class RentalService {

  private static final String RENTAL_IMAGE_SECTION = "rental-items";

  private final PartnerRentalItemRepository rentalItemRepo;
  private final RentalBookingOrderRepository rentalBookingRepo;
  private final PartnerBusinessRepository businessRepo;
  private final PartnerBusinessMemberRepository memberRepo;
  private final RestaurantMenuImageStorage imageStorage;

  @org.springframework.beans.factory.annotation.Autowired(required = false)
  private PartnerNotificationOutboxService outboxService;

  // =========================================================================
  // Authorization Helper
  // =========================================================================

  public void assertUserCanManageBusiness(AuthenticatedUser user, UUID businessId) {
    if (user == null) {
      throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    if (user.isAdmin()) {
      return;
    }
    PartnerBusiness biz = requireBusiness(businessId);
    boolean isOwner = biz.getOwnerUserId().equals(user.id());
    if (isOwner) {
      return;
    }
    boolean isMember =
        memberRepo.existsByIdBusinessIdAndIdUserIdAndState(
            businessId, user.id(), MembershipState.ACTIVE);
    if (!isMember) {
      throw new TripServiceException(
          "FORBIDDEN", "You do not have permission to manage this business", HttpStatus.FORBIDDEN);
    }
  }

  // =========================================================================
  // Partner Catalog Operations
  // =========================================================================

  @Transactional(readOnly = true)
  public RestaurantMenuImageUploadDto uploadRentalItemImage(
      AuthenticatedUser user, UUID businessId, MultipartFile file) {
    assertUserCanManageBusiness(user, businessId);
    PartnerBusiness business = requireBusiness(businessId);
    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException("BUSINESS_SUSPENDED", "Business is suspended", HttpStatus.FORBIDDEN);
    }
    try {
      return imageStorage.upload(businessId, RENTAL_IMAGE_SECTION, file);
    } catch (IllegalArgumentException exception) {
      throw new TripServiceException("INVALID_RENTAL_IMAGE", "Image is not valid", HttpStatus.BAD_REQUEST);
    } catch (IllegalStateException exception) {
      throw new TripServiceException("RENTAL_IMAGE_UPLOAD_FAILED", "Image upload is unavailable", HttpStatus.BAD_GATEWAY);
    }
  }

  @Transactional(readOnly = true)
  public void deleteUnreferencedRentalItemImage(
      AuthenticatedUser user, UUID businessId, String imagePublicId) {
    assertUserCanManageBusiness(user, businessId);
    if (imagePublicId == null
        || imagePublicId.isBlank()
        || !imageStorage.isValidReference(businessId, RENTAL_IMAGE_SECTION, imagePublicId)) {
      throw new TripServiceException("INVALID_RENTAL_IMAGE", "Image reference is not valid", HttpStatus.BAD_REQUEST);
    }
    boolean stillReferenced = rentalItemRepo.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
        .anyMatch(item -> item.getImages() != null
            && item.getImages().stream().anyMatch(url -> url != null && url.contains(imagePublicId)));
    if (stillReferenced) {
      throw new TripServiceException("RENTAL_IMAGE_IN_USE", "Image is still used by a rental item", HttpStatus.CONFLICT);
    }
    try {
      imageStorage.delete(businessId, RENTAL_IMAGE_SECTION, imagePublicId);
    } catch (Exception exception) {
      throw new TripServiceException("RENTAL_IMAGE_DELETE_FAILED", "Image could not be removed", HttpStatus.BAD_GATEWAY);
    }
  }

  @Transactional
  public RentalItemDto createRentalItem(
      AuthenticatedUser user, UUID businessId, CreateRentalItemRequest req) {
    assertUserCanManageBusiness(user, businessId);

    List<String> images =
        req.images() != null ? new ArrayList<>(req.images()) : new ArrayList<>();
    if (images.isEmpty() && req.thumbnailUrl() != null && !req.thumbnailUrl().isBlank()) {
      images.add(req.thumbnailUrl().trim());
    }

    boolean deliveryAvailable = resolveDeliveryAvailable(req.deliveryAvailable(), req.pickupOption());

    PartnerRentalItem item =
        PartnerRentalItem.builder()
            .businessId(businessId)
            .name(req.name().trim())
            .category(req.category())
            .subcategory(req.subcategory())
            .description(req.description())
            .images(images)
            .pricePerDay(req.pricePerDay())
            .pricePerHour(req.pricePerHour())
            .depositAmount(req.depositAmount() != null ? req.depositAmount() : BigDecimal.ZERO)
            .depositPolicy(req.depositPolicy())
            .totalInventory(req.totalInventory() != null ? req.totalInventory() : 1)
            .deliveryAvailable(deliveryAvailable)
            .deliveryFee(req.deliveryFee() != null ? req.deliveryFee() : BigDecimal.ZERO)
            .specifications(req.specifications() != null ? req.specifications() : Map.of())
            .active(true)
            .build();

    PartnerRentalItem saved = rentalItemRepo.save(item);
    return toDto(saved);
  }

  @Transactional
  public RentalItemDto updateRentalItem(
      AuthenticatedUser user, UUID businessId, UUID itemId, UpdateRentalItemRequest req) {
    assertUserCanManageBusiness(user, businessId);

    PartnerRentalItem item = requireItem(itemId);
    if (!item.getBusinessId().equals(businessId)) {
      throw new TripServiceException("FORBIDDEN", "Item does not belong to business", HttpStatus.FORBIDDEN);
    }

    item.setName(req.name().trim());
    item.setCategory(req.category());
    item.setSubcategory(req.subcategory());
    item.setDescription(req.description());

    if (req.images() != null) {
      item.setImages(new ArrayList<>(req.images()));
    } else if (req.thumbnailUrl() != null && !req.thumbnailUrl().isBlank()) {
      item.setImages(List.of(req.thumbnailUrl().trim()));
    }

    item.setPricePerDay(req.pricePerDay());
    item.setPricePerHour(req.pricePerHour());
    if (req.depositAmount() != null) item.setDepositAmount(req.depositAmount());
    item.setDepositPolicy(req.depositPolicy());
    if (req.totalInventory() != null) item.setTotalInventory(req.totalInventory());

    if (req.deliveryAvailable() != null || req.pickupOption() != null) {
      item.setDeliveryAvailable(resolveDeliveryAvailable(req.deliveryAvailable(), req.pickupOption()));
    }

    if (req.deliveryFee() != null) item.setDeliveryFee(req.deliveryFee());
    if (req.specifications() != null) item.setSpecifications(req.specifications());
    if (req.active() != null) item.setActive(req.active());

    PartnerRentalItem saved = rentalItemRepo.save(item);
    return toDto(saved);
  }

  private static boolean resolveDeliveryAvailable(Boolean deliveryAvailable, PickupOption pickupOption) {
    if (deliveryAvailable != null) {
      return deliveryAvailable;
    }
    return pickupOption == PickupOption.BOTH
        || pickupOption == PickupOption.DELIVERY_TO_LOCATION
        || pickupOption == PickupOption.DOOR_DELIVERY;
  }

  @Transactional
  public void deleteRentalItem(AuthenticatedUser user, UUID businessId, UUID itemId) {
    assertUserCanManageBusiness(user, businessId);

    PartnerRentalItem item = requireItem(itemId);
    if (!item.getBusinessId().equals(businessId)) {
      throw new TripServiceException("FORBIDDEN", "Item does not belong to business", HttpStatus.FORBIDDEN);
    }
    rentalItemRepo.delete(item);
  }

  @Transactional(readOnly = true)
  public List<RentalItemDto> getRentalItemsByBusiness(UUID businessId) {
    return rentalItemRepo.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<RentalItemDto> getActiveRentalItemsByBusiness(UUID businessId) {
    return rentalItemRepo.findByBusinessIdAndActiveTrueOrderByNameAsc(businessId).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public Page<RentalItemDto> searchRentalItems(RentalCategory category, Pageable pageable) {
    if (category != null) {
      return rentalItemRepo
          .findByActiveTrueAndCategoryOrderByCreatedAtDesc(category, pageable)
          .map(this::toDto);
    }
    return rentalItemRepo.findByActiveTrueOrderByCreatedAtDesc(pageable).map(this::toDto);
  }

  @Transactional(readOnly = true)
  public List<RentalItemDto> searchRentalItemsList(RentalCategory category, String query) {
    List<PartnerRentalItem> items =
        category != null
            ? rentalItemRepo.findByActiveTrueAndCategoryOrderByCreatedAtDesc(category)
            : rentalItemRepo.findByActiveTrueOrderByCreatedAtDesc();

    if (query != null && !query.isBlank()) {
      String q = query.trim().toLowerCase();
      items = items.stream()
          .filter(i -> i.getName() != null && i.getName().toLowerCase().contains(q))
          .toList();
    }
    return items.stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public Map<String, Object> checkAvailability(
      UUID itemId, Instant pickupAt, Instant returnAt, int quantity) {
    PartnerRentalItem item = requireItem(itemId);
    int safeQty = quantity > 0 ? quantity : 1;
    if (pickupAt == null || returnAt == null || !returnAt.isAfter(pickupAt)) {
      return Map.of(
          "available", false,
          "allocated", 0,
          "total", item.getTotalInventory(),
          "availableCount", item.getTotalInventory());
    }
    int allocated =
        rentalBookingRepo.calculateOverlappingAllocatedQuantity(item.getId(), pickupAt, returnAt);
    int availableCount = Math.max(0, item.getTotalInventory() - allocated);
    boolean available = item.isActive() && availableCount >= safeQty;

    return Map.of(
        "available", available,
        "allocated", allocated,
        "total", item.getTotalInventory(),
        "availableCount", availableCount);
  }

  @Transactional(readOnly = true)
  public RentalItemDto getRentalItem(UUID id) {
    return toDto(requireItem(id));
  }

  // =========================================================================
  // Booking Lifecycle Operations
  // =========================================================================

  @Transactional
  public RentalBookingOrderDto createBooking(UUID customerId, CreateRentalBookingRequest req) {
    if (customerId == null) {
      throw new TripServiceException("UNAUTHORIZED", "Customer authentication required", HttpStatus.UNAUTHORIZED);
    }
    if (!req.returnAt().isAfter(req.pickupAt())) {
      throw new TripServiceException("INVALID_TIME_RANGE", "Return time must be after pickup time", HttpStatus.BAD_REQUEST);
    }
    if (req.pickupAt().isBefore(Instant.now())) {
      throw new TripServiceException("INVALID_START_TIME", "Pickup time must be in the future", HttpStatus.BAD_REQUEST);
    }

    PartnerRentalItem item = requireItem(req.rentalItemId());
    if (!item.isActive()) {
      throw new TripServiceException("ITEM_UNAVAILABLE", "Rental item is not currently active", HttpStatus.BAD_REQUEST);
    }

    UUID resolvedBizId = req.businessId() != null ? req.businessId() : item.getBusinessId();
    if (!item.getBusinessId().equals(resolvedBizId)) {
      throw new TripServiceException("BUSINESS_MISMATCH", "Item does not belong to specified business", HttpStatus.BAD_REQUEST);
    }

    int requestedQty = req.quantity() != null && req.quantity() > 0 ? req.quantity() : 1;

    // Check inventory availability
    int currentlyAllocated =
        rentalBookingRepo.calculateOverlappingAllocatedQuantity(
            item.getId(), req.pickupAt(), req.returnAt());

    if (currentlyAllocated + requestedQty > item.getTotalInventory()) {
      throw new TripServiceException(
          "RENTAL_ITEM_OUT_OF_STOCK",
          "Not enough available inventory for selected duration. Available: "
              + Math.max(0, item.getTotalInventory() - currentlyAllocated),
          HttpStatus.CONFLICT);
    }

    // Pricing calculation
    Duration duration = Duration.between(req.pickupAt(), req.returnAt());
    long hours = Math.max(1, duration.toHours());
    long days = Math.max(1, (hours + 23) / 24); // ceil to days

    BigDecimal rentalPrice;
    if (hours < 24 && item.getPricePerHour() != null && item.getPricePerHour().compareTo(BigDecimal.ZERO) > 0) {
      rentalPrice = item.getPricePerHour().multiply(BigDecimal.valueOf(hours));
    } else {
      rentalPrice = item.getPricePerDay().multiply(BigDecimal.valueOf(days));
    }
    rentalPrice = rentalPrice.multiply(BigDecimal.valueOf(requestedQty));

    boolean isDelivery =
        req.pickupOption() == PickupOption.DELIVERY_TO_LOCATION
            || req.pickupOption() == PickupOption.DOOR_DELIVERY;

    BigDecimal deliveryFee = BigDecimal.ZERO;
    if (isDelivery && item.isDeliveryAvailable()) {
      deliveryFee = item.getDeliveryFee();
    }

    BigDecimal depositAmount = item.getDepositAmount().multiply(BigDecimal.valueOf(requestedQty));
    BigDecimal totalAmount = rentalPrice.add(deliveryFee);

    String bookingCode = "#TS-RNT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    PartnerBusiness biz = requireBusiness(resolvedBizId);

    PickupOption finalPickupOption =
        isDelivery ? PickupOption.DELIVERY_TO_LOCATION : PickupOption.PICKUP_AT_STORE;

    RentalBookingOrder order =
        RentalBookingOrder.builder()
            .bookingCode(bookingCode)
            .businessId(biz.getId())
            .rentalItemId(item.getId())
            .customerId(customerId)
            .customerName(req.customerName().trim())
            .customerPhone(req.customerPhone().trim())
            .customerEmail(req.customerEmail())
            .pickupAt(req.pickupAt())
            .returnAt(req.returnAt())
            .quantity(requestedQty)
            .pickupOption(finalPickupOption)
            .deliveryAddress(req.deliveryAddress())
            .rentalPrice(rentalPrice)
            .deliveryFee(deliveryFee)
            .depositAmount(depositAmount)
            .totalAmount(totalAmount)
            .currency("VND")
            .status(RentalBookingStatus.PENDING)
            .customerNote(req.effectiveNote())
            .chatOfferId(req.chatOfferId())
            .build();

    RentalBookingOrder saved = rentalBookingRepo.save(order);
    notifyRentalManagers(
        biz.getId(),
        biz.getOwnerUserId(),
        "RENTAL_BOOKING_REQUESTED",
        String.format(
            "Đơn thuê mới %s: %s (x%d) từ khách %s.",
            saved.getBookingCode(), item.getName(), requestedQty, saved.getCustomerName()));
    notifyRentalUser(
        customerId,
        biz.getId(),
        "RENTAL_BOOKING_PLACED",
        String.format(
            "Đã gửi yêu cầu thuê %s tại %s (%s). Vui lòng chờ đối tác xác nhận.",
            item.getName(), biz.getDisplayName(), saved.getBookingCode()));
    return toBookingDto(saved, biz.getDisplayName(), item.getName(), item.getCategory().name());
  }

  @Transactional
  public RentalBookingOrderDto confirmBooking(
      AuthenticatedUser user, UUID businessId, UUID bookingId) {
    assertUserCanManageBusiness(user, businessId);

    RentalBookingOrder order = requireBooking(bookingId);
    requireBusinessMatch(order, businessId);

    if (order.getStatus() != RentalBookingStatus.PENDING) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only confirm pending bookings", HttpStatus.BAD_REQUEST);
    }
    if (order.getPickupAt().isBefore(Instant.now())) {
      order.setStatus(RentalBookingStatus.EXPIRED);
      rentalBookingRepo.save(order);
      throw new TripServiceException("BOOKING_EXPIRED", "Booking pickup time has already passed", HttpStatus.BAD_REQUEST);
    }

    order.setStatus(RentalBookingStatus.CONFIRMED);
    RentalBookingOrder saved = rentalBookingRepo.save(order);
    RentalBookingOrderDto dto = enrichBookingDto(saved);
    notifyRentalUser(
        saved.getCustomerId(),
        saved.getBusinessId(),
        "RENTAL_BOOKING_CONFIRMED",
        String.format("Đơn thuê %s tại %s đã được xác nhận.", saved.getBookingCode(), dto.businessName()));
    return dto;
  }

  @Transactional
  public RentalBookingOrderDto handoverBooking(
      AuthenticatedUser user, UUID businessId, UUID bookingId) {
    assertUserCanManageBusiness(user, businessId);

    RentalBookingOrder order = requireBooking(bookingId);
    requireBusinessMatch(order, businessId);

    if (order.getStatus() != RentalBookingStatus.CONFIRMED) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only handover confirmed bookings", HttpStatus.BAD_REQUEST);
    }

    order.setStatus(RentalBookingStatus.IN_USE);
    order.setHandoverAt(Instant.now());
    RentalBookingOrder saved = rentalBookingRepo.save(order);
    RentalBookingOrderDto dto = enrichBookingDto(saved);
    notifyRentalUser(
        saved.getCustomerId(),
        saved.getBusinessId(),
        "RENTAL_BOOKING_HANDED_OVER",
        String.format("Đơn thuê %s tại %s đã được bàn giao cho bạn.", saved.getBookingCode(), dto.businessName()));
    return dto;
  }

  @Transactional
  public RentalBookingOrderDto returnBooking(
      AuthenticatedUser user,
      UUID businessId,
      UUID bookingId,
      BigDecimal overdueFee,
      String partnerNote) {
    assertUserCanManageBusiness(user, businessId);

    RentalBookingOrder order = requireBooking(bookingId);
    requireBusinessMatch(order, businessId);

    if (order.getStatus() != RentalBookingStatus.IN_USE) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only return items that are in use", HttpStatus.BAD_REQUEST);
    }

    order.setStatus(RentalBookingStatus.RETURNED);
    order.setReturnedAt(Instant.now());
    if (overdueFee != null && overdueFee.compareTo(BigDecimal.ZERO) > 0) {
      order.setOverdueFee(overdueFee);
      order.setTotalAmount(order.getTotalAmount().add(overdueFee));
    }
    if (partnerNote != null) order.setPartnerNote(partnerNote.trim());

    RentalBookingOrder saved = rentalBookingRepo.save(order);
    RentalBookingOrderDto dto = enrichBookingDto(saved);
    notifyRentalUser(
        saved.getCustomerId(),
        saved.getBusinessId(),
        "RENTAL_BOOKING_RETURNED",
        String.format("Đơn thuê %s tại %s đã hoàn tất trả xe/thiết bị.", saved.getBookingCode(), dto.businessName()));
    return dto;
  }

  @Transactional
  public RentalBookingOrderDto rejectBooking(
      AuthenticatedUser user, UUID businessId, UUID bookingId, String reason) {
    assertUserCanManageBusiness(user, businessId);

    RentalBookingOrder order = requireBooking(bookingId);
    requireBusinessMatch(order, businessId);

    if (order.getStatus() != RentalBookingStatus.PENDING) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Can only reject pending bookings", HttpStatus.BAD_REQUEST);
    }

    order.setStatus(RentalBookingStatus.REJECTED);
    order.setRejectionReason(reason);
    RentalBookingOrder saved = rentalBookingRepo.save(order);
    RentalBookingOrderDto dto = enrichBookingDto(saved);
    notifyRentalUser(
        saved.getCustomerId(),
        saved.getBusinessId(),
        "RENTAL_BOOKING_REJECTED",
        String.format("Đơn thuê %s tại %s đã bị từ chối.", saved.getBookingCode(), dto.businessName()));
    return dto;
  }

  @Transactional
  public RentalBookingOrderDto cancelBooking(UUID customerId, UUID bookingId, String reason) {
    RentalBookingOrder order = requireBooking(bookingId);
    if (!order.getCustomerId().equals(customerId)) {
      throw new TripServiceException("FORBIDDEN", "You can only cancel your own bookings", HttpStatus.FORBIDDEN);
    }
    if (order.getStatus() != RentalBookingStatus.PENDING && order.getStatus() != RentalBookingStatus.CONFIRMED) {
      throw new TripServiceException("INVALID_STATE_TRANSITION", "Cannot cancel booking in status " + order.getStatus(), HttpStatus.BAD_REQUEST);
    }

    order.setStatus(RentalBookingStatus.CANCELLED);
    order.setRejectionReason(reason);
    RentalBookingOrder saved = rentalBookingRepo.save(order);
    RentalBookingOrderDto dto = enrichBookingDto(saved);
    notifyRentalManagers(
        saved.getBusinessId(),
        null,
        "RENTAL_BOOKING_CANCELLED",
        String.format("Khách đã hủy đơn thuê %s (%s).", saved.getBookingCode(), dto.rentalItemName()));
    return dto;
  }

  @Transactional(readOnly = true)
  public Page<RentalBookingOrderDto> getBookingsByBusiness(
      AuthenticatedUser user, UUID businessId, Pageable pageable) {
    assertUserCanManageBusiness(user, businessId);
    return rentalBookingRepo.findByBusinessIdOrderByCreatedAtDesc(businessId, pageable)
        .map(this::enrichBookingDto);
  }

  @Transactional(readOnly = true)
  public List<RentalBookingOrderDto> getBookingsByCustomer(UUID customerId) {
    return rentalBookingRepo.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
        .map(this::enrichBookingDto)
        .toList();
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private void notifyRentalManagers(
      UUID businessId, UUID fallbackOwnerId, String eventType, String message) {
    if (outboxService == null || businessId == null) {
      return;
    }
    java.util.Set<UUID> recipientIds = new java.util.LinkedHashSet<>();
    for (PartnerBusinessMember member :
        memberRepo.findByIdBusinessIdAndState(businessId, MembershipState.ACTIVE)) {
      if (member.getRole() == MembershipRole.OWNER || member.getRole() == MembershipRole.MANAGER) {
        recipientIds.add(member.getId().getUserId());
      }
    }
    if (recipientIds.isEmpty() && fallbackOwnerId != null) {
      recipientIds.add(fallbackOwnerId);
    }
    Instant now = Instant.now();
    for (UUID recipientId : recipientIds) {
      outboxService.saveNotificationWithOutbox(
          PartnerNotification.builder()
              .id(UUID.randomUUID())
              .eventId(UUID.randomUUID())
              .recipientId(recipientId)
              .eventType(eventType)
              .businessId(businessId)
              .message(message)
              .createdAt(now)
              .build());
    }
  }

  private void notifyRentalUser(
      UUID recipientId, UUID businessId, String eventType, String message) {
    if (outboxService == null || recipientId == null) {
      return;
    }
    outboxService.saveNotificationWithOutbox(
        PartnerNotification.builder()
            .id(UUID.randomUUID())
            .eventId(UUID.randomUUID())
            .recipientId(recipientId)
            .eventType(eventType)
            .businessId(businessId)
            .message(message)
            .createdAt(Instant.now())
            .build());
  }

  private PartnerBusiness requireBusiness(UUID businessId) {
    return businessRepo
        .findById(businessId)
        .orElseThrow(() -> new TripServiceException("BUSINESS_NOT_FOUND", "Partner business not found", HttpStatus.NOT_FOUND));
  }

  private PartnerRentalItem requireItem(UUID itemId) {
    return rentalItemRepo
        .findById(itemId)
        .orElseThrow(() -> new TripServiceException("RENTAL_ITEM_NOT_FOUND", "Rental item not found", HttpStatus.NOT_FOUND));
  }

  private RentalBookingOrder requireBooking(UUID bookingId) {
    return rentalBookingRepo
        .findById(bookingId)
        .orElseThrow(() -> new TripServiceException("BOOKING_NOT_FOUND", "Rental booking order not found", HttpStatus.NOT_FOUND));
  }

  private void requireBusinessMatch(RentalBookingOrder order, UUID businessId) {
    if (!order.getBusinessId().equals(businessId)) {
      throw new TripServiceException("FORBIDDEN", "Booking does not belong to specified business", HttpStatus.FORBIDDEN);
    }
  }

  /** Converts a persisted rental item entity to its public/partner DTO representation. */
  public RentalItemDto toDto(PartnerRentalItem item) {
    String thumb =
        (item.getImages() != null && !item.getImages().isEmpty())
            ? item.getImages().get(0)
            : null;
    PickupOption opt =
        item.isDeliveryAvailable()
            ? PickupOption.DELIVERY_TO_LOCATION
            : PickupOption.PICKUP_AT_STORE;

    return RentalItemDto.builder()
        .id(item.getId())
        .businessId(item.getBusinessId())
        .name(item.getName())
        .category(item.getCategory())
        .subcategory(item.getSubcategory())
        .description(item.getDescription())
        .thumbnailUrl(thumb)
        .images(item.getImages())
        .pricePerDay(item.getPricePerDay())
        .pricePerHour(item.getPricePerHour())
        .depositAmount(item.getDepositAmount())
        .depositPolicy(item.getDepositPolicy())
        .totalInventory(item.getTotalInventory())
        .deliveryAvailable(item.isDeliveryAvailable())
        .deliveryFee(item.getDeliveryFee())
        .pickupOption(opt)
        .specifications(item.getSpecifications())
        .active(item.isActive())
        .createdAt(item.getCreatedAt())
        .updatedAt(item.getUpdatedAt())
        .build();
  }

  private RentalBookingOrderDto enrichBookingDto(RentalBookingOrder order) {
    String bizName =
        businessRepo
            .findById(order.getBusinessId())
            .map(PartnerBusiness::getDisplayName)
            .orElse("Dịch vụ cho thuê");
    String itemName =
        rentalItemRepo
            .findById(order.getRentalItemId())
            .map(PartnerRentalItem::getName)
            .orElse("Phương tiện/Thiết bị");
    String itemCat =
        rentalItemRepo
            .findById(order.getRentalItemId())
            .map(i -> i.getCategory().name())
            .orElse("VEHICLE");
    return toBookingDto(order, bizName, itemName, itemCat);
  }

  private RentalBookingOrderDto toBookingDto(
      RentalBookingOrder order, String businessName, String itemName, String itemCategory) {
    RentalBookingStatus effectiveStatus = order.getStatus();
    if (order.getStatus() == RentalBookingStatus.PENDING
        && order.getPickupAt().isBefore(Instant.now())) {
      effectiveStatus = RentalBookingStatus.EXPIRED;
    }

    return RentalBookingOrderDto.builder()
        .id(order.getId())
        .bookingCode(order.getBookingCode())
        .businessId(order.getBusinessId())
        .businessName(businessName)
        .rentalItemId(order.getRentalItemId())
        .rentalItemName(itemName)
        .rentalItemCategory(itemCategory)
        .customerId(order.getCustomerId())
        .customerName(order.getCustomerName())
        .customerPhone(order.getCustomerPhone())
        .customerEmail(order.getCustomerEmail())
        .pickupAt(order.getPickupAt())
        .returnAt(order.getReturnAt())
        .quantity(order.getQuantity())
        .pickupOption(order.getPickupOption())
        .deliveryAddress(order.getDeliveryAddress())
        .rentalPrice(order.getRentalPrice())
        .deliveryFee(order.getDeliveryFee())
        .depositAmount(order.getDepositAmount())
        .totalAmount(order.getTotalAmount())
        .currency(order.getCurrency())
        .status(effectiveStatus)
        .handoverAt(order.getHandoverAt())
        .returnedAt(order.getReturnedAt())
        .overdueFee(order.getOverdueFee())
        .customerNote(order.getCustomerNote())
        .partnerNote(order.getPartnerNote())
        .rejectionReason(order.getRejectionReason())
        .chatOfferId(order.getChatOfferId())
        .version(order.getVersion())
        .createdAt(order.getCreatedAt())
        .updatedAt(order.getUpdatedAt())
        .build();
  }
}
