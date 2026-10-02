package fu.tripsense.emailservice.controller;

import static org.junit.jupiter.api.Assertions.*;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HotelEmailControllerTest {
  private final HotelEmailController.Mail input=new HotelEmailController.Mail(UUID.randomUUID(),"test@example.test","TripSense reservation update","Reservation confirmed.");
  @Test void internalEndpointFailsClosedWithoutMatchingSecret() {
    assertEquals(403,new HotelEmailController("","","").send("",input).getStatusCode().value());
    assertEquals(403,new HotelEmailController("internal-secret","","").send("attacker",input).getStatusCode().value());
  }
  @Test void missingProviderCredentialNeverSimulatesSuccessfulDelivery() {
    assertEquals(503,new HotelEmailController("internal-secret","","").send("internal-secret",input).getStatusCode().value());
  }
}
