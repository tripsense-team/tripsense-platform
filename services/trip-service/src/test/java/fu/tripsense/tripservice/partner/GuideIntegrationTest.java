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
class GuideIntegrationTest extends RealInfrastructureTest {

  private static final UUID GUIDE_OWNER = UUID.fromString("33333333-3333-3333-3333-333333333333");
  private static final UUID INDEPENDENT_ADMIN = UUID.fromString("88888888-8888-8888-8888-888888888888");

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Value("${jwt.access-secret}")
  private String accessSecret;

  @Test
  @DisplayName("Full Guide Profile, Taxonomy, Promotion Approval, and Material Change Fencing E2E")
  void fullGuideLifecycle() throws Exception {
    // 1. Guide Taxonomy
    mockMvc
        .perform(get("/api/guide-taxonomy"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.catalogVersion").value(1))
        .andExpect(jsonPath("$.data.areas", not(empty())))
        .andExpect(jsonPath("$.data.topics", not(empty())));

    // 2. Create Business Draft (TOUR_GUIDE)
    String createGuideBizPayload =
        """
        {
          "kind": "TOUR_GUIDE",
          "displayName": "Hoi An Heritage Explorer",
          "draftProfile": {
            "professionalName": "Minh Tran Local Expert",
            "bio": "Certified cultural tour guide with 10 years experience",
            "yearsExperience": 10,
            "languages": [
              {"code": "vi", "selfAssessedLevel": "FLUENT"},
              {"code": "en", "selfAssessedLevel": "FLUENT"}
            ],
            "skillIds": ["HISTORICAL_KNOWLEDGE", "PHOTOGRAPHY_SKILLS"],
            "expertise": [
              {"areaId": "HOI_AN", "topicId": "HERITAGE_CULTURE", "description": "Old Town Walks", "experience": "10 yrs"},
              {"areaId": "HOI_AN", "topicId": "FOOD_STREET", "description": "Street Food Tasting", "experience": "8 yrs"},
              {"areaId": "DA_NANG", "topicId": "HERITAGE_CULTURE", "description": "Marble Mountains", "experience": "6 yrs"}
            ],
            "indicativePrice": {"amount": "300000", "currency": "VND", "unit": "HOUR"}
          }
        }
        """;

    MvcResult createBizResult =
        mockMvc
            .perform(
                post("/api/partners/businesses")
                    .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createGuideBizPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.kind").value("TOUR_GUIDE"))
            .andReturn();

    String businessId = JsonPath.read(createBizResult.getResponse().getContentAsString(), "$.data.id");
    int bizVersion = JsonPath.read(createBizResult.getResponse().getContentAsString(), "$.data.version");

    // 3. Submit Application for Guide Business
    String submitBizAppPayload =
        """
        {
          "expectedVersion": 0,
          "requestedCapabilities": ["GUIDE_LISTING", "GUIDE_PROMOTION"],
          "checklistVersion": "2026-Q3-V1",
          "documentIds": []
        }
        """;

    MvcResult submitBizAppResult =
        mockMvc
            .perform(
                post("/api/partners/businesses/" + businessId + "/applications")
                    .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitBizAppPayload))
            .andExpect(status().isCreated())
            .andReturn();

    String applicationId = JsonPath.read(submitBizAppResult.getResponse().getContentAsString(), "$.data.id");

    // 4. Admin approves guide business application
    String approveBizPayload =
        """
        {
          "expectedBusinessVersion": 0,
          "expectedApplicationVersion": 0,
          "decision": "APPROVE",
          "checklistResults": [
            {"code": "PROFILE_COMPLETENESS", "result": "PASS"}
          ],
          "capabilityDecisions": [
            {"capability": "GUIDE_LISTING", "grant": true},
            {"capability": "GUIDE_PROMOTION", "grant": true}
          ],
          "reason": "Expertise and credentials validated"
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/partner-applications/" + applicationId + "/decision")
                .header("Authorization", bearer(INDEPENDENT_ADMIN, "ROLE_ADMIN", List.of("ROLE_USER", "ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(approveBizPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.state").value("APPROVED"));

    // 5. Guide owner publishes profile
    String pubBizPayload = "{\"expectedVersion\": 1, \"state\": \"PUBLISHED\"}";
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/publication")
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(pubBizPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.publicationState").value("PUBLISHED"));

    // 6. Public Guide Profile verification
    mockMvc
        .perform(get("/api/guides/" + businessId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.displayName").value("Minh Tran Local Expert"))
        .andExpect(jsonPath("$.data.yearsExperience").value(10))
        .andExpect(jsonPath("$.data.languages", hasSize(2)))
        .andExpect(jsonPath("$.data.skillIds", hasItem("HISTORICAL_KNOWLEDGE")));

    mockMvc
        .perform(get("/api/guides").param("areaId", "HOI_AN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data", not(empty())));

    // 7. Create Guide Promotion Draft
    String promoDraftPayload =
        """
        {
          "title": "Moonlit Lanterns & Ancient Architecture",
          "summary": "Walk the historic quarters under silk lantern lights with architectural commentary",
          "areaId": "HOI_AN",
          "topicIds": ["HERITAGE_CULTURE"],
          "skillIds": ["HISTORICAL_KNOWLEDGE"],
          "experienceDuration": "2.5 hours",
          "inclusions": ["Lantern lighting", "Herbal tea"],
          "exclusions": ["Dinner"],
          "indicativePriceAmount": 350000.00,
          "indicativePriceCurrency": "VND",
          "indicativePriceUnit": "PERSON",
          "coverImageRef": "https://example.test/lanterns.jpg",
          "galleryImageRefs": ["https://example.test/g1.jpg"]
        }
        """;

    MvcResult createPromoResult =
        mockMvc
            .perform(
                post("/api/partners/businesses/" + businessId + "/guide-promotions")
                    .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(promoDraftPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.currentRevision.title").value("Moonlit Lanterns & Ancient Architecture"))
            .andExpect(jsonPath("$.data.currentRevision.state").value("DRAFT"))
            .andReturn();

    String promoId = JsonPath.read(createPromoResult.getResponse().getContentAsString(), "$.data.id");
    String promoRevId = JsonPath.read(createPromoResult.getResponse().getContentAsString(), "$.data.currentRevision.id");

    // 8. Submit Promotion Revision
    mockMvc
        .perform(
            post("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/submit")
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentRevision.state").value("SUBMITTED"));

    // 9. Self-Review Block: Guide Owner attempts to review own promotion
    String reviewPayload =
        """
        {
          "expectedBusinessVersion": 2,
          "expectedPromotionVersion": 1,
          "decision": "APPROVED",
          "reason": "Self-approval test"
        }
        """;

    mockMvc
        .perform(
            post("/api/admin/guide-promotion-revisions/" + promoRevId + "/decision")
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_ADMIN", List.of("ROLE_USER", "ROLE_ADMIN", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewPayload))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("SELF_REVIEW_NOT_ALLOWED"));

    // 10. Independent Admin reviews and approves promotion
    mockMvc
        .perform(
            post("/api/admin/guide-promotion-revisions/" + promoRevId + "/decision")
                .header("Authorization", bearer(INDEPENDENT_ADMIN, "ROLE_ADMIN", List.of("ROLE_USER", "ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reviewPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.state").value("APPROVED"));

    // 11. Guide Owner publishes promotion
    mockMvc
        .perform(
            put("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/publication")
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 2, \"state\": \"PUBLISHED\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.publicationState").value("PUBLISHED"));

    // 12. Public Promotion access
    mockMvc
        .perform(get("/api/guide-promotions/" + promoId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.title").value("Moonlit Lanterns & Ancient Architecture"))
        .andExpect(jsonPath("$.data.areaId").value("HOI_AN"));

    mockMvc
        .perform(get("/api/guide-promotions").param("areaId", "HOI_AN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data", not(empty())));

    // 13. Material Change Fencing:
    // Update draft to change areaId from HOI_AN to DA_NANG
    String materialChangeDraftPayload =
        """
        {
          "expectedVersion": 3,
          "title": "Da Nang Beach Walk",
          "summary": "Walk along My Khe Beach",
          "areaId": "DA_NANG",
          "topicIds": ["HERITAGE_CULTURE"],
          "skillIds": ["HISTORICAL_KNOWLEDGE"],
          "indicativePriceUnit": "PERSON"
        }
        """;

    mockMvc
        .perform(
            patch("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId)
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(materialChangeDraftPayload))
        .andExpect(status().isOk());

    // When attempting to submit the material change revision, it must be rejected!
    mockMvc
        .perform(
            post("/api/partners/businesses/" + businessId + "/guide-promotions/" + promoId + "/submit")
                .header("Authorization", bearer(GUIDE_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": 4}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("MATERIAL_CHANGE_REQUIRES_NEW_PROMOTION"));
  }

  private String bearer(UUID userId, String primaryRole, List<String> roles) {
    return "Bearer "
        + Jwts.builder()
            .setSubject(userId.toString())
            .claim("email", userId + "@tripsense.test")
            .claim("role", primaryRole)
            .claim("roles", roles)
            .claim("type", "ACCESS")
            .setIssuedAt(Date.from(Instant.now()))
            .setExpiration(Date.from(Instant.now().plusSeconds(3600)))
            .signWith(signingKey(), SignatureAlgorithm.HS256)
            .compact();
  }

  private Key signingKey() {
    return Keys.hmacShaKeyFor(accessSecret.getBytes(StandardCharsets.UTF_8));
  }
}
