package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RestaurantService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerBusinessMemberRepository memberRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final RestaurantMenuItemRepository menuRepository;
  private final ObjectMapper objectMapper;

  @Transactional(readOnly = true)
  public List<RestaurantMenuItemDto> getMenu(AuthenticatedUser user, UUID businessId) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    return menuRepository.findByBusinessIdOrderByDisplayOrderAscNameAsc(businessId).stream()
        .map(this::toDto)
        .toList();
  }

  @Transactional
  public List<RestaurantMenuItemDto> updateMenu(
      AuthenticatedUser user, UUID businessId, RestaurantMenuBatchRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER, MembershipRole.MANAGER));
    PartnerBusiness business = getBusiness(businessId);

    if (business.getOperationState() == OperationState.SUSPENDED) {
      throw new TripServiceException(
          "BUSINESS_SUSPENDED", "Cannot update menu while business is suspended", HttpStatus.FORBIDDEN);
    }

    requireCapability(businessId, PartnerCapability.RESTAURANT_MENU);

    // Replace menu items
    menuRepository.deleteByBusinessId(businessId);

    List<RestaurantMenuItem> entities = new ArrayList<>();
    if (request.items() != null) {
      int order = 0;
      for (RestaurantMenuItemDto item : request.items()) {
        String tagsJson = null;
        if (item.tags() != null && !item.tags().isEmpty()) {
          try {
            tagsJson = objectMapper.writeValueAsString(item.tags());
          } catch (Exception ignored) {
          }
        }
        entities.add(
            RestaurantMenuItem.builder()
                .id(UUID.randomUUID())
                .businessId(businessId)
                .name(item.name())
                .category(item.category())
                .description(item.description())
                .price(item.price())
                .currency(item.currency() != null ? item.currency() : "VND")
                .tags(tagsJson)
                .available(item.available())
                .displayOrder(item.displayOrder() > 0 ? item.displayOrder() : order++)
                .build());
      }
    }

    List<RestaurantMenuItem> saved = menuRepository.saveAll(entities);
    return saved.stream().map(this::toDto).toList();
  }

  @Transactional
  public void updateContactSharing(
      AuthenticatedUser user, UUID businessId, PublicContactConsentRequest request) {
    requireMember(user, businessId, Set.of(MembershipRole.OWNER));
    PartnerBusiness business = getBusiness(businessId);

    if (!Objects.equals(business.getVersion(), request.expectedVersion())) {
      throw new TripServiceException(
          "VERSION_CONFLICT", "Business version conflict", HttpStatus.CONFLICT);
    }

    business.setPublicContactConsent(request.publicContactConsent());
    businessRepository.save(business);
  }

  @Transactional(readOnly = true)
  public PublicRestaurantListingDto getPublicRestaurant(UUID businessId) {
    PartnerBusiness business = getBusiness(businessId);

    if (business.getKind() != BusinessKind.RESTAURANT) {
      throw new TripServiceException(
          "RESTAURANT_NOT_FOUND", "Restaurant not found", HttpStatus.NOT_FOUND);
    }

    boolean hasListingCap =
        capabilityRepository
            .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.RESTAURANT_LISTING)
            .filter(c -> c.getRevokedAt() == null)
            .isPresent();

    if (!business.isPublicEligible(hasListingCap)) {
      throw new TripServiceException(
          "RESTAURANT_NOT_FOUND", "Restaurant is not public eligible", HttpStatus.NOT_FOUND);
    }

    // Retrieve approved application snapshot
    PartnerApplication approvedApp =
        applicationRepository
            .findById(business.getApprovedRevisionId())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "RESTAURANT_NOT_FOUND", "Approved revision not found", HttpStatus.NOT_FOUND));

    Map<String, Object> snapshot =
        approvedApp.getProfileSnapshot() != null ? approvedApp.getProfileSnapshot() : Map.of();

    String address = (String) snapshot.getOrDefault("address", "");
    String destination = (String) snapshot.getOrDefault("destination", "");
    String openingHours = (String) snapshot.getOrDefault("openingHours", "");

    List<String> cuisineTags = new ArrayList<>();
    Object tagsObj = snapshot.get("cuisineTags");
    if (tagsObj instanceof List<?> list) {
      for (Object tag : list) {
        if (tag != null) cuisineTags.add(tag.toString());
      }
    }

    List<RestaurantMenuItemDto> menu =
        menuRepository.findByBusinessIdAndAvailableTrueOrderByDisplayOrderAscNameAsc(businessId)
            .stream()
            .map(this::toDto)
            .toList();

    String publicEmail = null;
    String publicPhone = null;
    if (business.isPublicContactConsent()) {
      publicEmail = (String) snapshot.get("email");
      publicPhone = (String) snapshot.get("phone");
    }

    return PublicRestaurantListingDto.builder()
        .id(businessId)
        .displayName(business.getDisplayName())
        .address(address)
        .destination(destination)
        .openingHours(openingHours)
        .cuisineTags(cuisineTags)
        .menu(menu)
        .publicEmail(publicEmail)
        .publicPhone(publicPhone)
        .build();
  }

  private RestaurantMenuItemDto toDto(RestaurantMenuItem item) {
    List<String> tags = Collections.emptyList();
    if (item.getTags() != null) {
      try {
        tags = objectMapper.readValue(item.getTags(), new TypeReference<>() {});
      } catch (Exception ignored) {
      }
    }
    return RestaurantMenuItemDto.builder()
        .id(item.getId())
        .name(item.getName())
        .category(item.getCategory())
        .description(item.getDescription())
        .price(item.getPrice())
        .currency(item.getCurrency())
        .tags(tags)
        .available(item.isAvailable())
        .displayOrder(item.getDisplayOrder())
        .build();
  }

  private PartnerBusiness getBusiness(UUID id) {
    return businessRepository
        .findById(id)
        .orElseThrow(
            () ->
                new TripServiceException(
                    "BUSINESS_NOT_FOUND", "Partner business not found", HttpStatus.NOT_FOUND));
  }

  private void requireMember(AuthenticatedUser user, UUID businessId, Set<MembershipRole> allowedRoles) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }
    PartnerBusinessMember member =
        memberRepository
            .findByIdBusinessIdAndIdUserId(businessId, user.id())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "FORBIDDEN", "User is not a member of this business", HttpStatus.FORBIDDEN));

    if (member.getState() != MembershipState.ACTIVE || !allowedRoles.contains(member.getRole())) {
      throw new TripServiceException(
          "FORBIDDEN", "Insufficient membership permissions", HttpStatus.FORBIDDEN);
    }
  }

  private void requireCapability(UUID businessId, PartnerCapability capability) {
    boolean active =
        capabilityRepository
            .findByIdBusinessIdAndIdCapability(businessId, capability)
            .filter(c -> c.getRevokedAt() == null)
            .isPresent();
    if (!active) {
      throw new TripServiceException(
          "CAPABILITY_REQUIRED",
          "Business does not have active capability: " + capability,
          HttpStatus.FORBIDDEN);
    }
  }

  private Map<String, Object> parseJson(String json) {
    if (json == null || json.isBlank()) return Collections.emptyMap();
    try {
      return objectMapper.readValue(json, new TypeReference<>() {});
    } catch (Exception e) {
      return Collections.emptyMap();
    }
  }
}
