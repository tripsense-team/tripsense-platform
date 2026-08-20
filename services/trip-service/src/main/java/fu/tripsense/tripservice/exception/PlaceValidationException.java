package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class PlaceValidationException extends TripServiceException {

    public PlaceValidationException(String code, String message) {
        super(code, message, "PLACE_NOT_FOUND".equals(code) ? HttpStatus.NOT_FOUND : HttpStatus.SERVICE_UNAVAILABLE);
    }
}
