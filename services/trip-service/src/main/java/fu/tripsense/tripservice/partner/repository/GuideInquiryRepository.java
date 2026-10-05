package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.GuideInquiry;
import fu.tripsense.tripservice.partner.enums.GuideInquiryState;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GuideInquiryRepository extends JpaRepository<GuideInquiry, UUID> {

  List<GuideInquiry> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

  List<GuideInquiry> findByCustomerIdAndStateOrderByCreatedAtDesc(
      UUID customerId, GuideInquiryState state);

  List<GuideInquiry> findByGuideBusinessIdOrderByCreatedAtDesc(UUID guideBusinessId);

  List<GuideInquiry> findByGuideBusinessIdAndStateOrderByCreatedAtDesc(
      UUID guideBusinessId, GuideInquiryState state);

  @Query(
      "SELECT i FROM GuideInquiry i WHERE i.customerId = :customerId AND i.guideBusinessId = :guideBusinessId "
          + "AND i.state IN (fu.tripsense.tripservice.partner.enums.GuideInquiryState.SUBMITTED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.IN_DISCUSSION, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.PROPOSAL_SENT)")
  Optional<GuideInquiry> findActiveInquiry(
      @Param("customerId") UUID customerId, @Param("guideBusinessId") UUID guideBusinessId);

  @Query(
      "SELECT i FROM GuideInquiry i WHERE i.guideBusinessId = :businessId "
          + "AND i.createdAt <= :suspendedAt AND i.boundSuspensionVersion <= :maxSuspensionVersion "
          + "AND i.state NOT IN (fu.tripsense.tripservice.partner.enums.GuideInquiryState.CONTACT_AGREED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.DECLINED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.WITHDRAWN, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.EXPIRED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.CLOSED)")
  List<GuideInquiry> findInquiriesForSuspensionClosure(
      @Param("businessId") UUID businessId,
      @Param("maxSuspensionVersion") int maxSuspensionVersion,
      @Param("suspendedAt") Instant suspendedAt);

  @Query(
      "SELECT i FROM GuideInquiry i WHERE i.expiresAt < :now "
          + "AND i.state NOT IN (fu.tripsense.tripservice.partner.enums.GuideInquiryState.CONTACT_AGREED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.DECLINED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.WITHDRAWN, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.EXPIRED, "
          + "fu.tripsense.tripservice.partner.enums.GuideInquiryState.CLOSED)")
  List<GuideInquiry> findExpiredInquiries(@Param("now") Instant now);
}
