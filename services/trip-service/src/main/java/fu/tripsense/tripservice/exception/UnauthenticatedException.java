package fu.tripsense.tripservice.exception;

import org.springframework.http.HttpStatus;

public class UnauthenticatedException extends TripServiceException {

    public UnauthenticatedException() {
        super("UNAUTHENTICATED", "Authentication is required", HttpStatus.UNAUTHORIZED);
    }
}
