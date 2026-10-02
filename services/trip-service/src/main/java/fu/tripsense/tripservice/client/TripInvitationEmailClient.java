package fu.tripsense.tripservice.client;

import fu.tripsense.tripservice.entity.Trip;
import fu.tripsense.tripservice.entity.TripInvitation;

public interface TripInvitationEmailClient {
  void sendInvitation(Trip trip, TripInvitation invitation);
}
