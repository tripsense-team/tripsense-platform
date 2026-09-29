package fu.tripsense.emailservice.controller;

import com.resend.Resend;
import com.resend.core.net.RequestOptions;
import com.resend.services.emails.model.CreateEmailOptions;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Internal delivery endpoint. Booking transaction and durable retries live in Trip. */
@RestController
@RequestMapping("/internal/hotel-emails")
public class HotelEmailController {
  private final String secret,apiKey,from;
  public HotelEmailController(@Value("${hotel.mail.secret:}") String secret,
      @Value("${resend.api-key:}") String apiKey,@Value("${resend.from-email:}") String from) {
    this.secret=secret; this.apiKey=apiKey; this.from=from;
  }
  public record Mail(@NotNull UUID deliveryId,@NotBlank @Email @Size(max=254) String toEmail,
      @NotBlank @Size(max=160) String subject,@NotBlank @Size(max=600) String message) {}
  @PostMapping
  public ResponseEntity<Map<String,Boolean>> send(@RequestHeader(value="X-Hotel-Mail-Secret",defaultValue="") String supplied,@Valid @RequestBody Mail input) {
    if(secret.isBlank() || !MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8))) return ResponseEntity.status(403).body(Map.of("sent",false));
    if(apiKey.isBlank() || from.isBlank()) return ResponseEntity.status(503).body(Map.of("sent",false));
    try {
      new Resend(apiKey).emails().send(CreateEmailOptions.builder().from(from).to(input.toEmail()).subject(input.subject()).text(input.message()).build(),
          RequestOptions.builder().setIdempotencyKey("hotel/"+input.deliveryId()).build());
      return ResponseEntity.ok(Map.of("sent",true));
    } catch(Exception e) { return ResponseEntity.status(503).body(Map.of("sent",false)); }
  }
}
