package fu.tripsense.tripservice.hotel;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class HotelMailClient {
  private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
  private final ObjectMapper json=new ObjectMapper();
  private final String base, secret;
  public HotelMailClient(@Value("${hotel.mail.url:http://localhost:8082}") String base,@Value("${hotel.mail.secret:}") String secret) { this.base=base; this.secret=secret; }
  public void send(Map<String,Object> job) throws Exception {
    if(secret.isBlank()) throw new IllegalStateException("HOTEL_MAIL_NOT_CONFIGURED");
    var body=Map.of("deliveryId",job.get("id").toString(),"toEmail",job.get("recipient_email"),"subject",job.get("subject"),"message",job.get("message"));
    var request=HttpRequest.newBuilder(URI.create(base+"/internal/hotel-emails"))
        .timeout(Duration.ofSeconds(10)).header("Content-Type","application/json")
        .header("X-Hotel-Mail-Secret",secret).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
    var response=http.send(request,HttpResponse.BodyHandlers.discarding());
    if(response.statusCode()!=200) throw new IllegalStateException("HOTEL_MAIL_DELIVERY_FAILED");
  }
}
