package fu.tripsense.tripservice.partner.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminReviewDecisionRequest;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.enums.*;
import fu.tripsense.tripservice.partner.repository.PartnerReviewChecklistRepository;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class PartnerChecklistServiceTest {
  private final PartnerReviewChecklistRepository repository=mock(PartnerReviewChecklistRepository.class);
  private final PartnerChecklistService service=new PartnerChecklistService(repository);

  @Test void approvalRequiresEverySeededRequiredItemToPass() {
    var checklist=PartnerReviewChecklist.builder().id(new ChecklistId("CHK-HOTEL-V1","1.0")).kind("HOTEL")
        .itemsJson(List.of(Map.of("code","PROFILE","required",true),Map.of("code","CONTACT","required",true)))
        .effectiveAt(Instant.now().minusSeconds(60)).build();
    when(repository.findById(checklist.getId())).thenReturn(Optional.of(checklist));
    var business=PartnerBusiness.builder().kind(BusinessKind.HOTEL).build();
    var application=PartnerApplication.builder().checklistId("CHK-HOTEL-V1").checklistVersion("1.0")
        .requestedCapabilities(List.of("HOTEL_BOOKING")).build();
    var incomplete=new AdminReviewDecisionRequest(0L,0L,"APPROVE",
        List.of(new AdminReviewDecisionRequest.ChecklistResultDto("PROFILE","PASS",null)),List.of(),null);
    assertEquals("CHECKLIST_INCOMPLETE",assertThrows(TripServiceException.class,()->service.validateApproval(application,business,incomplete)).code());
    var wrongCapability=new AdminReviewDecisionRequest(0L,0L,"APPROVE",
        List.of(new AdminReviewDecisionRequest.ChecklistResultDto("PROFILE","PASS",null),new AdminReviewDecisionRequest.ChecklistResultDto("CONTACT","PASS",null)),
        List.of(new AdminReviewDecisionRequest.CapabilityDecisionDto(PartnerCapability.RESTAURANT_MENU,true,null)),null);
    assertEquals("CAPABILITY_NOT_REQUESTED",assertThrows(TripServiceException.class,()->service.validateApproval(application,business,wrongCapability)).code());
  }
}
