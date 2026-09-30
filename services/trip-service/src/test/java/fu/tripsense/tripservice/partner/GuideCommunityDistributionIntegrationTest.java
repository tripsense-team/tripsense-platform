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
class GuideCommunityDistributionIntegrationTest extends RealInfrastructureTest {

  private static final UUID GUIDE_OWNER = UUID.fromString("66666666-6666-6666-6666-666666666666");
  private static final UUID ADMIN_USER = UUID.fromString("99999999-9999-9999-9999-999999999999");

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Value("${jwt.access-secret}")
  private String accessSecret;

  @Test
  @DisplayName("Community Publication and Batch Summaries Integration Test")
  void testCommunityPublicationAndBatchSummaries() throws Exception {
    String guideToken = bearer(GUIDE_OWNER, "guide-distribution@tripsense.vn", "ROLE_PARTNER");
    String adminToken = bearer(ADMIN_USER, "admin@tripsense.vn", "ROLE_ADMIN");

    // 1. Create TOUR_GUIDE business
    String createBizPayload =
        """
        {
          "kind": "TOUR_GUIDE",
          "displayName": "Hoi An Heritage Explorer",
          "draftProfile": {
            "professionalName": "Tran Van An",
            "bio": "Certified local tour guide with 10 years experience in Hoi An ancient town",
            "languages": [{"code": "vi", "selfAssessedLevel": "FLUENT"}],
            "skillIds": ["photography", "culinary"],
            "expertise": [{"areaId": "area_hoian", "topicId": "topic_ancient_town", "description": "Old town night walking tours", "experience": "10 years"}],
            "audienceTags": ["couples", "solo"],
            "serviceLimitations": ["walking tours only"],
            "yearsExperience": 10,
            "indicativePrice": {"amount": "800000", "currency": "VND", "unit": "DAY"}
          }
        }
        """;

    MvcResult bizCreateRes =
        mockMvc
            .perform(
                post("/api/partners/businesses")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createBizPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String businessId = JsonPath.read(bizCreateRes.getResponse().getContentAsString(), "$.data.id");

    // 2. Submit application and approve it
    String submitAppPayload =
        """
        {
          "expectedVersion": 0,
          "checklistId": "CHK-GUIDE-V1",
          "checklistVersion": "1.0",
          "requestedCapabilities": ["GUIDE_LISTING", "GUIDE_PROMOTION", "GUIDE_INQUIRY"]
        }
        """;

    MvcResult submitAppRes =
        mockMvc
            .perform(
                post("/api/partners/businesses/" + businessId + "/applications")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitAppPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String applicationId = JsonPath.read(submitAppRes.getResponse().getContentAsString(), "$.data.id");

    // Admin approves application
    String approveAppPayload =
        """
        {
          "expectedBusinessVersion": 0,
          "expectedApplicationVersion": 0,
          "decision": "APPROVE",
          "checklistResults": [{"code":"PROFILE","result":"PASS"},{"code":"CONTACT","result":"PASS"},{"code":"OWNERSHIP","result":"PASS"}],
          "reason": "All credentials verified",
          "capabilityDecisions": [
            {"capability": "GUIDE_LISTING", "grant": true},
            {"capability": "GUIDE_PROMOTION", "grant": true},
            {"capability": "GUIDE_INQUIRY", "grant": true}
          ]
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/partner-applications/" + applicationId + "/decision")
                .header("Authorization", adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(approveAppPayload))
        .andExpect(status().isOk());

    // Guide Owner publishes business
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/publication")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 1, \"state\": \"PUBLISHED\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/intake")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 2, \"acceptingNew\": true}"))
        .andExpect(status().isOk());

    // 3. Create Guide Promotion Draft
    String createPromoPayload =
        """
        {
          "title": "Hoi An Lantern Festival Night Photography",
          "summary": "Capture magical lantern-lit streets with a professional local photographer",
          "areaId": "area_hoian",
          "topicIds": ["topic_ancient_town"],
          "skillIds": ["photography"],
          "experienceDuration": "3 hours",
          "inclusions": ["guided tour", "photo tips"],
          "exclusions": ["camera equipment"],
          "indicativePriceAmount": 500000,
          "indicativePriceCurrency": "VND",
          "indicativePriceUnit": "PERSON",
          "coverImageRef": "https://img.tripsense.vn/hoian_cover.jpg",
          "galleryImageRefs": ["https://img.tripsense.vn/hoian_1.jpg"]
        }
        """;

    MvcResult promoRes =
        mockMvc
            .perform(
                post("/api/partners/businesses/" + businessId + "/guide-promotions")
                    .header("Authorization", guideToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createPromoPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String promoId = JsonPath.read(promoRes.getResponse().getContentAsString(), "$.data.id");
    String promoRevId =
        JsonPath.read(promoRes.getResponse().getContentAsString(), "$.data.currentRevision.id");

    // Submit promotion revision
    mockMvc
        .perform(
            post("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/submit")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 0}"))
        .andExpect(status().isOk());

    // Admin approves promotion revision
    String promoDecisionPayload =
        """
        {
          "expectedBusinessVersion": 3,
          "expectedPromotionVersion": 1,
          "decision": "APPROVED",
          "reason": "High quality content"
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/guide-promotion-revisions/" + promoRevId + "/decision")
                .header("Authorization", adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(promoDecisionPayload))
        .andExpect(status().isOk());

    // Guide publishes promotion
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/publication")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 2, \"state\": \"PUBLISHED\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.publicationState", is("PUBLISHED")));

    // 4. Update community publication (Owner opt-in enabled = true)
    String pubOptInPayload =
        """
        {
          "expectedVersion": 3,
          "expectedRevisionId": "%s",
          "enabled": true
        }
        """.formatted(promoRevId);

    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/community-publication")
                .header("Authorization", guideToken)
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(pubOptInPayload))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.data.promotionId", is(promoId)))
        .andExpect(jsonPath("$.data.distributionVersion", is(3)))
        .andExpect(jsonPath("$.data.desiredEnabled", is(true)))
        .andExpect(jsonPath("$.data.syncState", is("PENDING")));

    // 5. Get community publication status
    mockMvc
        .perform(
            get("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/community-publication")
                .header("Authorization", guideToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.promotionId", is(promoId)))
        .andExpect(jsonPath("$.data.distributionVersion", is(3)))
        .andExpect(jsonPath("$.data.desiredEnabled", is(true)));

    // 6. Test Internal Batch Endpoint (called by Social service)
    String batchPayload =
        """
        {
          "promotionIds": ["%s"]
        }
        """.formatted(promoId);

    mockMvc
        .perform(
            post("/internal/partner-guide-summaries/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(batchPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data", hasSize(1)))
        .andExpect(jsonPath("$.data[0].promotionId", is(promoId)))
        .andExpect(jsonPath("$.data[0].businessId", is(businessId)))
        .andExpect(jsonPath("$.data[0].availability", is("AVAILABLE")))
        .andExpect(jsonPath("$.data[0].communityEnabled", is(true)))
        .andExpect(jsonPath("$.data[0].title", is("Hoi An Lantern Festival Night Photography")))
        .andExpect(jsonPath("$.data[0].canRequestInquiry", is(true)));

    // 7. Update community publication to disabled
    String pubOptOutPayload =
        """
        {
          "expectedVersion": 4,
          "expectedRevisionId": "%s",
          "enabled": false
        }
        """.formatted(promoRevId);

    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/community-publication")
                .header("Authorization", guideToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(pubOptOutPayload))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.data.desiredEnabled", is(false)))
        .andExpect(jsonPath("$.data.distributionVersion", is(4)));
  }

  private String bearer(UUID userId, String email, String role) {
    Key key = Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
    Instant now = Instant.now();
    return "Bearer "
        + Jwts.builder()
            .setSubject(userId.toString())
            .claim("userId", userId.toString())
            .claim("email", email)
            .claim("role", role)
            .claim("type", "ACCESS")
            .setIssuedAt(Date.from(now))
            .setExpiration(Date.from(now.plus(1, ChronoUnit.HOURS)))
            .signWith(key, SignatureAlgorithm.HS256)
            .compact();
  }
}
