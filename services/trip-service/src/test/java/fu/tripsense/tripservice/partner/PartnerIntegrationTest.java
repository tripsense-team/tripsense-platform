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
class PartnerIntegrationTest extends RealInfrastructureTest {

  private static final UUID PARTNER_OWNER = UUID.fromString("11111111-1111-1111-1111-111111111111");
  private static final UUID PARTNER_ADMIN = UUID.fromString("99999999-9999-9999-9999-999999999999");
  private static final UUID CLAIMANT = UUID.fromString("22222222-2222-2222-2222-222222222222");

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Value("${jwt.access-secret}")
  private String accessSecret;

  @Test
  @DisplayName("Full partner onboarding, review, reverification lock, suspension fencing, and claims lifecycle")
  void fullPartnerLifecycle() throws Exception {
    // 1. Create Business Draft (HOTEL)
    String createPayload =
        """
        {
          "kind": "HOTEL",
          "displayName": "An Bang Boutique Resort",
          "draftProfile": {
            "address": "123 An Bang Beach",
            "destination": "Hoi An",
            "checkInTime": "14:00",
            "checkOutTime": "12:00"
          }
        }
        """;

    MvcResult createResult =
        mockMvc
            .perform(
                post("/api/partners/businesses")
                    .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(createPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.displayName").value("An Bang Boutique Resort"))
            .andExpect(jsonPath("$.data.kind").value("HOTEL"))
            .andExpect(jsonPath("$.data.publicationState").value("HIDDEN"))
            .andExpect(jsonPath("$.data.acceptingNew").value(false))
            .andExpect(jsonPath("$.data.requiresReverification").value(false))
            .andReturn();

    String businessId = JsonPath.read(createResult.getResponse().getContentAsString(), "$.data.id");
    int businessVersion = JsonPath.read(createResult.getResponse().getContentAsString(), "$.data.version");

    // 2. Query Partner Context
    mockMvc
        .perform(
            get("/api/partners/businesses")
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.businesses[?(@.id == '%s')]", businessId).exists());

    // 2b. Query Supported Business Kinds
    mockMvc
        .perform(
            get("/api/partners/business-kinds?region=Hoi An")
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.submitEnabled").value(true))
        .andExpect(jsonPath("$.data.kinds", hasSize(3)));

    // 3. Submit Application for Review
    String submitPayload =
        """
        {
          "expectedVersion": %d,
          "checklistId": "CHK-HOTEL-V1",
          "checklistVersion": "1.0",
          "requestedCapabilities": ["HOTEL_LISTING", "HOTEL_INVENTORY", "HOTEL_BOOKING"],
          "profileSnapshot": {
            "address": "123 An Bang Beach",
            "destination": "Hoi An"
          },
          "documentIds": ["%s"]
        }
        """
            .formatted(businessVersion, UUID.randomUUID());

    MvcResult submitResult =
        mockMvc
            .perform(
                post("/api/partners/businesses/{id}/applications", businessId)
                    .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(submitPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.state").value("SUBMITTED"))
            .andExpect(jsonPath("$.data.revision").value(1))
            .andReturn();

    String applicationId = JsonPath.read(submitResult.getResponse().getContentAsString(), "$.data.id");

    // 3b. Query Business Applications history
    mockMvc
        .perform(
            get("/api/partners/businesses/{id}/applications", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
        .andExpect(jsonPath("$.data[0].revision").value(1));

    // 4. Admin Review: Self-review by Owner must be blocked (403 SELF_REVIEW_NOT_ALLOWED)
    String approveDecisionPayload =
        """
        {
          "expectedBusinessVersion": %d,
          "expectedApplicationVersion": 0,
          "decision": "APPROVE",
          "checklistResults": [
            {"code": "CHECK_DOCS", "result": "PASS"},
            {"code": "CHECK_LOCATION", "result": "PASS"}
          ],
          "capabilityDecisions": [
            {"capability": "HOTEL_LISTING", "grant": true},
            {"capability": "HOTEL_INVENTORY", "grant": true},
            {"capability": "HOTEL_BOOKING", "grant": true}
          ],
          "reason": "Business verified successfully"
        }
        """
            .formatted(businessVersion);

    // Owner trying to self-review as admin:
    mockMvc
        .perform(
            post("/api/admin/partner-applications/{id}/decision", applicationId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_ADMIN", List.of("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(approveDecisionPayload))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("SELF_REVIEW_NOT_ALLOWED"));

    // Independent Admin approves:
    mockMvc
        .perform(
            post("/api/admin/partner-applications/{id}/decision", applicationId)
                .header("Authorization", bearer(PARTNER_ADMIN, "ROLE_ADMIN", List.of("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(approveDecisionPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.state").value("APPROVED"));

    // 5. Check Readiness
    mockMvc
        .perform(
            get("/api/partners/businesses/{id}/readiness", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.canPublish").value(true))
        .andExpect(jsonPath("$.data.canAcceptNew").value(true));

    // Refresh business detail to get updated version
    MvcResult detailResult =
        mockMvc
            .perform(
                get("/api/partners/businesses/{id}", businessId)
                    .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.approvalValidity").value("VALID"))
            .andReturn();
    int currentVer = JsonPath.read(detailResult.getResponse().getContentAsString(), "$.data.version");

    // 5b. Query Business Capabilities
    mockMvc
        .perform(
            get("/api/partners/businesses/{id}/capabilities", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data", hasItem("HOTEL_LISTING")));

    // 6. Owner Publishes and enables Intake
    String pubPayload = "{\"expectedVersion\": %d, \"state\": \"PUBLISHED\"}".formatted(currentVer);
    mockMvc
        .perform(
            put("/api/partners/businesses/{id}/publication", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(pubPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.publicationState").value("PUBLISHED"));

    currentVer++;
    String intakePayload = "{\"expectedVersion\": %d, \"acceptingNew\": true}".formatted(currentVer);
    mockMvc
        .perform(
            put("/api/partners/businesses/{id}/intake", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(intakePayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.acceptingNew").value(true));

    // 7. Declare Material Change (e.g. Relocated to another street)
    currentVer++;
    String materialChangePayload =
        """
        {
          "expectedVersion": %d,
          "kind": "LOCATION",
          "reason": "Resort relocated to new address",
          "reverificationApplicationId": null
        }
        """
            .formatted(currentVer);

    mockMvc
        .perform(
            post("/api/partners/businesses/{id}/material-changes", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(materialChangePayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.requiresReverification").value(true))
        .andExpect(jsonPath("$.data.publicationState").value("HIDDEN"))
        .andExpect(jsonPath("$.data.acceptingNew").value(false));

    // 8. CRITICAL INVARIANT: Owner CANNOT republish or re-open intake while requiresReverification is true!
    currentVer++;
    String tryRepublish = "{\"expectedVersion\": %d, \"state\": \"PUBLISHED\"}".formatted(currentVer);
    mockMvc
        .perform(
            put("/api/partners/businesses/{id}/publication", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(tryRepublish))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REVERIFICATION_REQUIRED"));

    String tryIntake = "{\"expectedVersion\": %d, \"acceptingNew\": true}".formatted(currentVer);
    mockMvc
        .perform(
            put("/api/partners/businesses/{id}/intake", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(tryIntake))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("REVERIFICATION_REQUIRED"));

    // 9. Suspension Fencing Token & Reinstatement Test
    String suspendPayload = "{\"expectedVersion\": %d, \"reason\": \"Investigation\"}".formatted(currentVer);
    mockMvc
        .perform(
            post("/api/admin/partner-businesses/{id}/suspension", businessId)
                .header("Authorization", bearer(PARTNER_ADMIN, "ROLE_ADMIN", List.of("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(suspendPayload))
        .andExpect(status().isOk());

    // Verify suspensionVersion incremented monotonically to 1 and suspendedAt is recorded
    MvcResult suspendedDetail =
        mockMvc
            .perform(
                get("/api/partners/businesses/{id}", businessId)
                    .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.operationState").value("SUSPENDED"))
            .andExpect(jsonPath("$.data.suspensionVersion").value(1))
            .andExpect(jsonPath("$.data.suspendedAt").isNotEmpty())
            .andReturn();
    currentVer = JsonPath.read(suspendedDetail.getResponse().getContentAsString(), "$.data.version");

    // Reinstate business
    String reinstatePayload = "{\"expectedVersion\": %d, \"reason\": \"Cleared\", \"remediationApplicationId\": null}".formatted(currentVer);
    mockMvc
        .perform(
            post("/api/admin/partner-businesses/{id}/reinstatement", businessId)
                .header("Authorization", bearer(PARTNER_ADMIN, "ROLE_ADMIN", List.of("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(reinstatePayload))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/api/partners/businesses/{id}", businessId)
                .header("Authorization", bearer(PARTNER_OWNER, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.operationState").value("ACTIVE"))
        .andExpect(jsonPath("$.data.reinstatedAt").isNotEmpty())
        .andExpect(jsonPath("$.data.publicationState").value("HIDDEN"))
        .andExpect(jsonPath("$.data.acceptingNew").value(false));

    // 10. Management Claim Flow
    String claimPayload =
        """
        {
          "businessId": "%s",
          "reason": "I am the original founder and trademark holder of this resort"
        }
        """
            .formatted(businessId);

    MvcResult claimResult =
        mockMvc
            .perform(
                post("/api/partners/management-claims")
                    .header("Authorization", bearer(CLAIMANT, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(claimPayload))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.targetBusinessId").value(businessId))
            .andExpect(jsonPath("$.data.state").value("SUBMITTED"))
            .andReturn();

    String claimId = JsonPath.read(claimResult.getResponse().getContentAsString(), "$.data.id");

    // Admin reviews claim
    String claimDecisionPayload =
        """
        {
          "expectedVersion": 0,
          "outcome": "RESOLVED_INVITATION",
          "linkedBusinessIds": ["%s"],
          "reason": "Mediated settlement agreed"
        }
        """
            .formatted(businessId);

    mockMvc
        .perform(
            post("/api/admin/management-claims/{id}/decision", claimId)
                .header("Authorization", bearer(PARTNER_ADMIN, "ROLE_ADMIN", List.of("ROLE_ADMIN")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(claimDecisionPayload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.state").value("RESOLVED_INVITATION"))
        .andExpect(jsonPath("$.data.decidedBy").value(PARTNER_ADMIN.toString()));

    // 11. Duplicate Candidates Search
    mockMvc
        .perform(
            get("/api/partners/business-candidates")
                .param("kind", "HOTEL")
                .param("name", "Boutique")
                .header("Authorization", bearer(CLAIMANT, "ROLE_PARTNER", List.of("ROLE_USER", "ROLE_PARTNER"))))
        .andExpect(status().isOk());
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
