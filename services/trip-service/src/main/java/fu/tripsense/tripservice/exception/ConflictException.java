package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends TripServiceException {

    public ConflictException(String code, String message) {
        super(code, message, HttpStatus.CONFLICT);
    }
}
