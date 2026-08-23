package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends TripServiceException {

    public NotFoundException(String code, String message) {
        super(code, message, HttpStatus.NOT_FOUND);
    }
}
