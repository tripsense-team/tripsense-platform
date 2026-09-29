package fu.tripsense.tripservice.partner.repository;

import fu.tripsense.tripservice.partner.entity.PartnerInquiryContactConsent;
import fu.tripsense.tripservice.partner.entity.PartnerInquiryContactConsentId;
import fu.tripsense.tripservice.partner.enums.ContactConsentChannel;
import fu.tripsense.tripservice.partner.enums.ContactConsentState;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PartnerInquiryContactConsentRepository
    extends JpaRepository<PartnerInquiryContactConsent, PartnerInquiryContactConsentId> {

  List<PartnerInquiryContactConsent> findByIdInquiryId(UUID inquiryId);

  List<PartnerInquiryContactConsent> findByIdInquiryIdAndState(
      UUID inquiryId, ContactConsentState state);

  List<PartnerInquiryContactConsent> findByIdInquiryIdAndIdGrantorUserId(
      UUID inquiryId, UUID grantorUserId);

  Optional<PartnerInquiryContactConsent> findByIdInquiryIdAndIdGrantorUserIdAndIdChannel(
      UUID inquiryId, UUID grantorUserId, ContactConsentChannel channel);
}
