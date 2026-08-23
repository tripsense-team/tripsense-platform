package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class TripServiceException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public TripServiceException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String code() {
        return code;
    }

    public HttpStatus status() {
        return status;
    }
}
