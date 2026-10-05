package fu.tripsense.tripservice.partner.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.*;
import fu.tripsense.tripservice.partner.dto.PublicGuideProfileDto.*;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.*;
import java.math.BigDecimal;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class GuideProfileService {

  private final PartnerBusinessRepository businessRepository;
  private final PartnerApplicationRepository applicationRepository;
  private final PartnerBusinessCapabilityRepository capabilityRepository;
  private final PartnerGuidePromotionRepository promotionRepository;
  private final PartnerGuidePromotionRevisionRepository revisionRepository;
  private final ObjectMapper objectMapper;

  @Transactional(readOnly = true)
  public PublicGuideProfileDto getPublicGuide(UUID businessId) {
    PartnerBusiness business =
        businessRepository
            .findById(businessId)
            .orElseThrow(
                () -> new TripServiceException("GUIDE_NOT_FOUND", "Guide not found", HttpStatus.NOT_FOUND));

    if (business.getKind() != BusinessKind.TOUR_GUIDE) {
      throw new TripServiceException("GUIDE_NOT_FOUND", "Guide not found", HttpStatus.NOT_FOUND);
    }

    boolean hasListingCap =
        capabilityRepository
            .findByIdBusinessIdAndIdCapability(businessId, PartnerCapability.GUIDE_LISTING)
            .filter(c -> c.getRevokedAt() == null)
            .isPresent();

    if (!business.isPublicEligible(hasListingCap)) {
      throw new TripServiceException(
          "GUIDE_NOT_FOUND", "Guide is not public eligible", HttpStatus.NOT_FOUND);
    }

    PartnerApplication approvedApp =
        applicationRepository
            .findById(business.getApprovedRevisionId())
            .orElseThrow(
                () ->
                    new TripServiceException(
                        "GUIDE_NOT_FOUND", "Approved guide revision not found", HttpStatus.NOT_FOUND));

    Map<String, Object> snapshot =
        approvedApp.getProfileSnapshot() != null ? approvedApp.getProfileSnapshot() : Map.of();

    List<GuidePromotionSummaryDto> promotions = getPublicPromotionsForGuide(businessId);

    return toPublicDto(business, snapshot, promotions);
  }

  @Transactional(readOnly = true)
  public List<PublicGuideProfileDto> searchPublicGuides(
      String areaId, List<String> topicIds, List<String> skillIds, String language, String cursor) {
    List<PartnerBusiness> businesses =
        businessRepository.findByKindAndPublicationState(BusinessKind.TOUR_GUIDE, PublicationState.PUBLISHED);

    List<PublicGuideProfileDto> results = new ArrayList<>();

    for (PartnerBusiness business : businesses) {
      if (business.getApprovedRevisionId() == null) continue;

      boolean hasListingCap =
          capabilityRepository
              .findByIdBusinessIdAndIdCapability(business.getId(), PartnerCapability.GUIDE_LISTING)
              .filter(c -> c.getRevokedAt() == null)
              .isPresent();

      if (!business.isPublicEligible(hasListingCap)) continue;

      Optional<PartnerApplication> appOpt = applicationRepository.findById(business.getApprovedRevisionId());
      if (appOpt.isEmpty()) continue;

      Map<String, Object> snapshot =
          appOpt.get().getProfileSnapshot() != null ? appOpt.get().getProfileSnapshot() : Map.of();

      // Filters
      if (areaId != null && !areaId.isBlank()) {
        boolean matchesArea = false;
        List<GuideExpertiseDto> expertise = parseExpertise(snapshot.get("expertise"));
        for (GuideExpertiseDto e : expertise) {
          if (areaId.equalsIgnoreCase(e.areaId())) {
            matchesArea = true;
            break;
          }
        }
        if (!matchesArea) continue;
      }

      if (topicIds != null && !topicIds.isEmpty()) {
        List<GuideExpertiseDto> expertise = parseExpertise(snapshot.get("expertise"));
        Set<String> topicsInProfile = new HashSet<>();
        for (GuideExpertiseDto e : expertise) {
          if (e.topicId() != null) topicsInProfile.add(e.topicId().toUpperCase());
        }
        boolean hasAnyTopic = false;
        for (String t : topicIds) {
          if (topicsInProfile.contains(t.toUpperCase())) {
            hasAnyTopic = true;
            break;
          }
        }
        if (!hasAnyTopic) continue;
      }

      if (skillIds != null && !skillIds.isEmpty()) {
        List<String> skills = parseStringList(snapshot.get("skillIds"));
        Set<String> upperSkills = new HashSet<>(skills.stream().map(String::toUpperCase).toList());
        boolean hasAllSkills = true;
        for (String s : skillIds) {
          if (!upperSkills.contains(s.toUpperCase())) {
            hasAllSkills = false;
            break;
          }
        }
        if (!hasAllSkills) continue;
      }

      if (language != null && !language.isBlank()) {
        List<GuideLanguageDto> langs = parseLanguages(snapshot.get("languages"));
        boolean matchesLang = false;
        for (GuideLanguageDto l : langs) {
          if (language.equalsIgnoreCase(l.code())) {
            matchesLang = true;
            break;
          }
        }
        if (!matchesLang) continue;
      }

      List<GuidePromotionSummaryDto> promotions = getPublicPromotionsForGuide(business.getId());
      results.add(toPublicDto(business, snapshot, promotions));
      if (results.size() >= 50) break;
    }

    return results;
  }

  private List<GuidePromotionSummaryDto> getPublicPromotionsForGuide(UUID businessId) {
    List<PartnerGuidePromotion> promos = promotionRepository.findByBusinessId(businessId);
    List<GuidePromotionSummaryDto> summaries = new ArrayList<>();

    for (PartnerGuidePromotion promo : promos) {
      if (promo.getPublicationState() == PublicationState.PUBLISHED && promo.getApprovedRevisionId() != null) {
        revisionRepository.findById(promo.getApprovedRevisionId()).ifPresent(rev -> {
          summaries.add(
              GuidePromotionSummaryDto.builder()
                  .id(promo.getId())
                  .businessId(businessId)
                  .title(rev.getTitle())
                  .summary(rev.getSummary())
                  .areaId(rev.getAreaId())
                  .topicIds(rev.getTopicIds())
                  .skillIds(rev.getSkillIds())
                  .experienceDuration(rev.getExperienceDuration())
                  .indicativePriceAmount(rev.getIndicativePriceAmount())
                  .indicativePriceCurrency(rev.getIndicativePriceCurrency())
                  .indicativePriceUnit(rev.getIndicativePriceUnit())
                  .coverImageRef(rev.getCoverImageRef())
                  .build());
        });
      }
    }
    return summaries;
  }

  private PublicGuideProfileDto toPublicDto(
      PartnerBusiness business, Map<String, Object> snapshot, List<GuidePromotionSummaryDto> promotions) {
    String bio = (String) snapshot.getOrDefault("bio", "");
    String professionalName = (String) snapshot.getOrDefault("professionalName", business.getDisplayName());
    Integer yearsExp = null;
    Object yObj = snapshot.get("yearsExperience");
    if (yObj instanceof Number num) yearsExp = num.intValue();

    IndicativePriceDto priceDto = null;
    Object pObj = snapshot.get("indicativePrice");
    if (pObj instanceof Map<?, ?> pMap) {
      BigDecimal amt = null;
      if (pMap.get("amount") != null) {
        try {
          amt = new BigDecimal(pMap.get("amount").toString());
        } catch (Exception ignored) {
        }
      }
      priceDto =
          new IndicativePriceDto(
              amt,
              Objects.toString(pMap.get("currency"), "VND"),
              Objects.toString(pMap.get("unit"), "HOUR"));
    }

    return PublicGuideProfileDto.builder()
        .businessId(business.getId())
        .displayName(professionalName)
        .bio(bio)
        .languages(parseLanguages(snapshot.get("languages")))
        .skillIds(parseStringList(snapshot.get("skillIds")))
        .expertise(parseExpertise(snapshot.get("expertise")))
        .audienceTags(parseStringList(snapshot.get("audienceTags")))
        .serviceLimitations(parseStringList(snapshot.get("serviceLimitations")))
        .yearsExperience(yearsExp)
        .indicativePrice(priceDto)
        .promotions(promotions)
        .build();
  }

  @SuppressWarnings("unchecked")
  private List<GuideLanguageDto> parseLanguages(Object obj) {
    if (obj instanceof List<?> list) {
      List<GuideLanguageDto> result = new ArrayList<>();
      for (Object item : list) {
        if (item instanceof Map<?, ?> map) {
          result.add(
              new GuideLanguageDto(
                  Objects.toString(map.get("code"), ""),
                  Objects.toString(map.get("selfAssessedLevel"), "CONVERSATIONAL")));
        }
      }
      return result;
    }
    return Collections.emptyList();
  }

  @SuppressWarnings("unchecked")
  private List<GuideExpertiseDto> parseExpertise(Object obj) {
    if (obj instanceof List<?> list) {
      List<GuideExpertiseDto> result = new ArrayList<>();
      for (Object item : list) {
        if (item instanceof Map<?, ?> map) {
          result.add(
              new GuideExpertiseDto(
                  Objects.toString(map.get("areaId"), ""),
                  Objects.toString(map.get("topicId"), ""),
                  Objects.toString(map.get("description"), ""),
                  Objects.toString(map.get("experience"), "")));
        }
      }
      return result;
    }
    return Collections.emptyList();
  }

  private List<String> parseStringList(Object obj) {
    if (obj instanceof List<?> list) {
      List<String> result = new ArrayList<>();
      for (Object item : list) {
        if (item != null) result.add(item.toString());
      }
      return result;
    }
    return Collections.emptyList();
  }
}
