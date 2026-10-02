package fu.tripsense.tripservice.partner;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import fu.tripsense.tripservice.support.RealInfrastructureTest;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class GuideInquiryIntegrationTest extends RealInfrastructureTest {

  private static final UUID GUIDE_OWNER = UUID.fromString("44444444-4444-4444-4444-444444444444");
  private static final UUID CUSTOMER_USER = UUID.fromString("55555555-5555-5555-5555-555555555555");
  private static final UUID ADMIN_USER = UUID.fromString("99999999-9999-9999-9999-999999999999");

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Value("${jwt.access-secret}")
  private String accessSecret;

  @Test
  @DisplayName("Full Guide Inquiry Lifecycle: Submission, Discussion, Requirements Revision, Proposal, Agreement, Dynamic Consent Revocation, and Suspension Fencing E2E")
  void fullGuideInquiryLifecycle() throws Exception {
    String guideToken = bearer(GUIDE_OWNER, "guide@tripsense.vn", "ROLE_PARTNER");
    String customerToken = bearer(CUSTOMER_USER, "customer@tripsense.vn", "ROLE_USER");
    String adminToken = bearer(ADMIN_USER, "admin@tripsense.vn", "ROLE_ADMIN");

    // 1. Create Business Draft (TOUR_GUIDE)
    String createGuideBizPayload =
        """
        {
          "kind": "TOUR_GUIDE",
          "displayName": "Da Nang Local Guide Experience",
          "draftProfile": {
            "professionalName": "Le Hoang",
            "bio": "Certified local tour guide with 8 years experience exploring Da Nang and Ba Na",
            "languages": [{"code": "vi", "selfAssessedLevel": "FLUENT"}, {"code": "en", "selfAssessedLevel": "CONVERSATIONAL"}],
            "skillIds": ["trekking", "photography"],
            "expertise": [{"areaId": "area_danang", "topicId": "topic_danang_city", "description": "Marble mountains and coastal culture", "experience": "8 years"}],
            "audienceTags": ["families", "couples"],
            "serviceLimitations": ["no transport included"],
            "yearsExperience": 8,
            "indicativePrice": {"amount": "1200000", "currency": "VND", "unit": "DAY"}
          }
        }
        """;

    MvcResult bizCreateRes =
        mockMvc
            .perform(
                post("/api/partners/businesses")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createGuideBizPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String businessId = JsonPath.read(bizCreateRes.getResponse().getContentAsString(), "$.data.id");

    // 2. Submit Application
    String submitPayload =
        """
        {
          "expectedVersion": 0,
          "checklistId": "CHK-GUIDE-V1",
          "checklistVersion": "1.0",
          "requestedCapabilities": ["GUIDE_LISTING", "GUIDE_INQUIRY"]
        }
        """;

    MvcResult appSubmitRes =
        mockMvc
            .perform(
                post("/api/partners/businesses/" + businessId + "/applications")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String applicationId =
        JsonPath.read(appSubmitRes.getResponse().getContentAsString(), "$.data.id");

    // 3. Admin Decision: APPROVE with capabilities
    String adminDecisionPayload =
        """
        {
          "expectedBusinessVersion": 0,
          "expectedApplicationVersion": 0,
          "decision": "APPROVE",
          "checklistResults": [{"code":"PROFILE","result":"PASS"},{"code":"CONTACT","result":"PASS"},{"code":"OWNERSHIP","result":"PASS"}],
          "reason": "Guide profile approved for consultation",
          "capabilityDecisions": [
            {"capability": "GUIDE_LISTING", "grant": true},
            {"capability": "GUIDE_INQUIRY", "grant": true}
          ]
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/partner-applications/" + applicationId + "/decision")
                .header("Authorization", adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(adminDecisionPayload))
        .andExpect(status().isOk());

    // 4. Guide Owner publishes and enables intake
    String publishPayload = """
        {
          "expectedVersion": 1,
          "state": "PUBLISHED"
        }
        """;
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/publication")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(publishPayload))
        .andExpect(status().isOk());

    String intakePayload = """
        {
          "expectedVersion": 2,
          "acceptingNew": true
        }
        """;
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/intake")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(intakePayload))
        .andExpect(status().isOk());

    // Get Business Detail to get approvedRevisionId
    MvcResult bizDetailRes =
        mockMvc
            .perform(get("/api/partners/businesses/" + businessId).header("Authorization", guideToken))
            .andExpect(status().isOk())
            .andReturn();
    String approvedProfileRevId =
        JsonPath.read(bizDetailRes.getResponse().getContentAsString(), "$.data.approvedRevisionId");

    // 5. Test Anti-Self-Inquiry Check: Guide Owner cannot inquire their own business
    LocalDate dateFrom = LocalDate.now().plusDays(3);
    LocalDate dateTo = LocalDate.now().plusDays(4);

    String selfInquiryPayload = String.format(
        """
        {
          "expectedSourceRevisionId": "%s",
          "areaId": "area_danang",
          "topicIds": ["topic_danang_city"],
          "requiredSkillIds": ["trekking"],
          "languageCode": "vi",
          "dateFrom": "%s",
          "dateTo": "%s",
          "preferredStartTime": "09:00",
          "timeZone": "Asia/Ho_Chi_Minh",
          "durationMinutes": 360,
          "adults": 2,
          "children": 0,
          "goals": "Testing self inquiry blocked",
          "budgetVnd": {"min": 1000000, "max": 2000000}
        }
        """,
        approvedProfileRevId, dateFrom, dateTo);

    mockMvc
        .perform(
            post("/api/guides/" + businessId + "/inquiries")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(selfInquiryPayload))
        .andExpect(status().isForbidden());

    // 6. Customer submits Inquiry (Valid)
    String customerInquiryPayload = String.format(
        """
        {
          "expectedSourceRevisionId": "%s",
          "areaId": "area_danang",
          "topicIds": ["topic_danang_city"],
          "requiredSkillIds": ["trekking", "photography"],
          "languageCode": "vi",
          "dateFrom": "%s",
          "dateTo": "%s",
          "preferredStartTime": "08:30",
          "timeZone": "Asia/Ho_Chi_Minh",
          "durationMinutes": 360,
          "adults": 4,
          "children": 1,
          "goals": "Want to explore Marble Mountain and take sunset photos at Son Tra peninsula",
          "supportNotes": "One elderly person, please keep walking pace relaxed",
          "budgetVnd": {"min": 1500000, "max": 2500000}
        }
        """,
        approvedProfileRevId, dateFrom, dateTo);

    MvcResult inqRes =
        mockMvc
            .perform(
                post("/api/guides/" + businessId + "/inquiries")
                    .header("Authorization", customerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(customerInquiryPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.state").value("SUBMITTED"))
            .andExpect(jsonPath("$.data.currentRequirementsRevision").value(1))
            .andReturn();

    String inquiryId = JsonPath.read(inqRes.getResponse().getContentAsString(), "$.data.id");

    // 7. Discussion: Guide replies -> State transitions to IN_DISCUSSION
    String guideReplyPayload = """
        {
          "expectedVersion": 0,
          "body": "Chào bạn, mình hoàn toàn có thể hỗ trợ lộ trình này với nhịp độ đi bộ vừa phải."
        }
        """;

    mockMvc
        .perform(
            post("/api/guide-inquiries/" + inquiryId + "/responses")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(guideReplyPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.state").value("IN_DISCUSSION"));

    // 8. Requirements Revision: Customer edits requirements -> increments requirementsRevision to 2
    String updateReqPayload = String.format(
        """
        {
          "expectedVersion": 1,
          "areaId": "area_danang",
          "topicIds": ["topic_danang_city"],
          "requiredSkillIds": ["trekking", "photography"],
          "languageCode": "vi",
          "dateFrom": "%s",
          "dateTo": "%s",
          "preferredStartTime": "08:00",
          "timeZone": "Asia/Ho_Chi_Minh",
          "durationMinutes": 420,
          "adults": 4,
          "children": 1,
          "goals": "Updated: We would also like to stop by Linh Ung pagoda in the morning",
          "budgetVnd": {"min": 1500000, "max": 2800000}
        }
        """,
        dateFrom, dateTo);

    mockMvc
        .perform(
            patch("/api/guide-inquiries/" + inquiryId + "/requirements")
                .header("Authorization", customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateReqPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.currentRequirementsRevision").value(2));

    // 9. Guide sends Proposal for Requirements Revision 2
    Instant proposedStartAt = Instant.now().plus(3, ChronoUnit.DAYS);
    Instant proposalValidUntil = Instant.now().plus(2, ChronoUnit.DAYS);

    String proposalPayload = String.format(
        """
        {
          "expectedVersion": 2,
          "requirementsRevision": 2,
          "offeredAreaId": "area_danang",
          "offeredTopicIds": ["topic_danang_city"],
          "offeredSkillIds": ["trekking", "photography"],
          "languageCode": "vi",
          "unmetSoftRequirements": [],
          "explanation": "Chương trình trọn vẹn khám phá Sơn Trà - Linh Ứng và Ngũ Hành Sơn",
          "proposedStartAt": "%s",
          "timeZone": "Asia/Ho_Chi_Minh",
          "durationMinutes": 420,
          "program": "08:00 Đón đoàn -> 09:00 Chùa Linh Ứng -> 11:30 Nghỉ trưa -> 14:00 Ngũ Hành Sơn -> 16:30 Ngắm hoàng hôn",
          "inclusions": ["Hướng dẫn viên tiếng Việt", "Nước uống 2 chai/người", "Hỗ trợ chụp ảnh máy cơ"],
          "exclusions": ["Vé tham quan", "Bữa ăn trưa"],
          "estimatedTotalVnd": 2200000,
          "validUntil": "%s",
          "contactConsent": {
            "shareEmail": true,
            "sharePhone": false,
            "termsVersion": "v1.0"
          }
        }
        """,
        proposedStartAt, proposalValidUntil);

    MvcResult proposalRes =
        mockMvc
            .perform(
                post("/api/guide-inquiries/" + inquiryId + "/proposals")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(proposalPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.state").value("PROPOSAL_SENT"))
            .andExpect(jsonPath("$.data.currentProposalId").isNotEmpty())
            .andReturn();

    String proposalId =
        JsonPath.read(proposalRes.getResponse().getContentAsString(), "$.data.currentProposalId");

    // 10. Customer accepts proposal with Contact Consent -> State becomes CONTACT_AGREED
    String decisionPayload = String.format(
        """
        {
          "expectedVersion": 3,
          "proposalId": "%s",
          "action": "AGREE_TO_CONTACT",
          "note": "Rất mong được đồng hành cùng anh!",
          "contactConsent": {
            "shareEmail": true,
            "sharePhone": false,
            "termsVersion": "v1.0"
          }
        }
        """,
        proposalId);

    mockMvc
        .perform(
            post("/api/guide-inquiries/" + inquiryId + "/proposal-decisions")
                .header("Authorization", customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(decisionPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.state").value("CONTACT_AGREED"));

    // 11. Read Contacts (Active Consent for both channels)
    mockMvc
        .perform(
            get("/api/guide-inquiries/" + inquiryId + "/contacts")
                .header("Authorization", customerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.emailConsented").value(true))
        .andExpect(jsonPath("$.data.email").isNotEmpty())
        .andExpect(jsonPath("$.data.phoneConsented").value(false))
        .andExpect(jsonPath("$.data.phone").value(nullValue()));

    // 12. Dynamic Consent Revocation: Guide revokes EMAIL consent
    String revokePayload = """
        {
          "channel": "EMAIL",
          "reason": "Switching exclusively to phone communication"
        }
        """;

    mockMvc
        .perform(
            post("/api/guide-inquiries/" + inquiryId + "/contact-consents/revoke")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(revokePayload))
        .andExpect(status().isOk());

    // Customer re-reads contacts -> EMAIL is dynamically masked/null, while PHONE remains available!
    mockMvc
        .perform(
            get("/api/guide-inquiries/" + inquiryId + "/contacts")
                .header("Authorization", customerToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.emailConsented").value(false))
        .andExpect(jsonPath("$.data.email").value(nullValue()))
        .andExpect(jsonPath("$.data.phoneConsented").value(false))
        .andExpect(jsonPath("$.data.phone").value(nullValue()));

    // 13. Suspension Fencing check: Admin suspends business
    String suspendPayload = """
        {
          "expectedVersion": 3,
          "reason": "Routine compliance audit"
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/partner-businesses/" + businessId + "/suspension")
                .header("Authorization", adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(suspendPayload))
        .andExpect(status().isOk());

    // Any attempt to create new inquiry while suspended fails closed with 403 BUSINESS_SUSPENDED
    mockMvc
        .perform(
            post("/api/guides/" + businessId + "/inquiries")
                .header("Authorization", customerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(customerInquiryPayload))
        .andExpect(status().isForbidden());
  }

  private String bearer(UUID userId, String email, String primaryRole) {
    Key key = Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
    return "Bearer "
        + Jwts.builder()
            .setSubject(userId.toString())
            .claim("email", email)
            .claim("role", primaryRole)
            .claim("roles", List.of(primaryRole))
            .claim("type", "ACCESS")
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + 3600000))
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
  }
}
