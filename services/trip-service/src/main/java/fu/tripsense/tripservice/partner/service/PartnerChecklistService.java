package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminReviewDecisionRequest;
import fu.tripsense.tripservice.partner.entity.*;
import fu.tripsense.tripservice.partner.repository.PartnerReviewChecklistRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PartnerChecklistService {
  private final PartnerReviewChecklistRepository repository;

  public PartnerReviewChecklist load(String id,String version,String kind) {
    if(id==null || version==null) throw invalid();
    var checklist=repository.findById(new ChecklistId(id,version)).orElseThrow(PartnerChecklistService::invalid);
    if(!kind.equals(checklist.getKind()) || checklist.getEffectiveAt().isAfter(Instant.now())) throw invalid();
    return checklist;
  }

  public void validateApproval(PartnerApplication application,PartnerBusiness business,AdminReviewDecisionRequest request) {
    var checklist=load(application.getChecklistId(),application.getChecklistVersion(),business.getKind().name());
    var results=new HashMap<String,String>();
    Set<String> codes=new HashSet<>();
    for(var item:checklist.getItemsJson()) codes.add((String)item.get("code"));
    for(var result:request.checklistResults()==null?List.<AdminReviewDecisionRequest.ChecklistResultDto>of():request.checklistResults()) {
      if(!codes.contains(result.code()) || !Set.of("PASS","FAIL","NEEDS_INFO").contains(Objects.toString(result.result(),"")) || results.put(result.code(),result.result())!=null) throw invalid();
    }
    for(var item:checklist.getItemsJson()) {
      if(Boolean.TRUE.equals(item.get("required")) && !"PASS".equals(results.get(item.get("code"))))
        throw new TripServiceException("CHECKLIST_INCOMPLETE","Every required checklist item must pass before approval",HttpStatus.CONFLICT);
    }
    String prefix=switch(business.getKind()) { case HOTEL -> "HOTEL_"; case RESTAURANT -> "RESTAURANT_"; case TOUR_GUIDE -> "GUIDE_"; };
    for(var cap:request.capabilityDecisions()==null?List.<AdminReviewDecisionRequest.CapabilityDecisionDto>of():request.capabilityDecisions()) {
      if(cap.capability()==null || !cap.capability().name().startsWith(prefix) || application.getRequestedCapabilities()==null || !application.getRequestedCapabilities().contains(cap.capability().name()))
        throw new TripServiceException("CAPABILITY_NOT_REQUESTED","Capability must match the application and business kind",HttpStatus.BAD_REQUEST);
    }
  }

  private static TripServiceException invalid() {
    return new TripServiceException("INVALID_CHECKLIST","A valid checklist for this business is required",HttpStatus.BAD_REQUEST);
  }
}
