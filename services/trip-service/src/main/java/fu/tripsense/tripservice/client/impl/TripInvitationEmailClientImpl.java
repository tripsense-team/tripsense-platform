package fu.tripsense.tripservice.client.impl;

import fu.tripsense.tripservice.client.TripInvitationEmailClient;
import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripInvitation;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class TripInvitationEmailClientImpl implements TripInvitationEmailClient {
  private final RestClient mailClient;
  private final String webAppUrl;
  private final String internalApiKey;

  public TripInvitationEmailClientImpl(
      @Value("${mail-service.url:http://localhost:8082}") String mailServiceUrl,
      @Value("${web-app.url:http://localhost:3000}") String webAppUrl,
      @Value("${MAIL_INTERNAL_API_KEY}") String internalApiKey) {
    this.mailClient = RestClient.builder().baseUrl(mailServiceUrl).build();
    this.webAppUrl = webAppUrl;
    this.internalApiKey = internalApiKey;
  }

  @Override
  public void sendInvitation(Trip trip, TripInvitation invitation) {
    String joinUrl =
        UriComponentsBuilder.fromUriString(webAppUrl)
            .path("/trips/join")
            .queryParam("token", invitation.getInvitationToken())
            .build()
            .encode()
            .toUriString();
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("toEmail", invitation.getInviteeEmail());
    body.put("tripName", trip.getName());
    body.put("role", invitation.getRole().name());
    if (invitation.getMessage() != null && !invitation.getMessage().isBlank()) {
      body.put("message", invitation.getMessage());
    }
    body.put("joinUrl", joinUrl);
    body.put("expiresAt", invitation.getExpiresAt());

    mailClient
        .post()
        .uri("/api/v1/emails/trip-invitation")
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Internal-Api-Key", internalApiKey)
        .body(body)
        .retrieve()
        .toBodilessEntity();
  }
}
