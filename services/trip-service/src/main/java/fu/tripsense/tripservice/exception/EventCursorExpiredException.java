package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class EventCursorExpiredException extends TripServiceException {

  public EventCursorExpiredException() {
    super(
        "EVENT_CURSOR_EXPIRED",
        "Collaboration history has expired; reload the itinerary",
        HttpStatus.GONE);
  }
}
