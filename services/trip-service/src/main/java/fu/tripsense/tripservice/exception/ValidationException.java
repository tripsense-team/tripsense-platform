package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class ValidationException extends TripServiceException {

    public ValidationException(String code, String message) {
        super(code, message, HttpStatus.BAD_REQUEST);
    }
}
