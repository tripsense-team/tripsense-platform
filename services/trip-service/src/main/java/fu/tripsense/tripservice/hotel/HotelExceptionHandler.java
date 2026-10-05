package fu.tripsense.tripservice.hotel;

import fu.tripsense.tripservice.dto.response.ErrorResponse;
import fu.tripsense.tripservice.exception.TripServiceException;
import org.springframework.core.annotation.Order;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.slf4j.LoggerFactory;

@Order(0)
@RestControllerAdvice(assignableTypes=HotelController.class)
public class HotelExceptionHandler {
  @ExceptionHandler(TripServiceException.class)
  ResponseEntity<ErrorResponse> domain(TripServiceException e) { return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(),e.getMessage())); }
  @ExceptionHandler({HttpMessageNotReadableException.class,MethodArgumentNotValidException.class,
      ServletRequestBindingException.class,MethodArgumentTypeMismatchException.class,IllegalArgumentException.class})
  ResponseEntity<ErrorResponse> input(Exception e) { return ResponseEntity.badRequest().body(ErrorResponse.of("HOTEL_INVALID_INPUT","Check the hotel request details")); }
  @ExceptionHandler(ConcurrencyFailureException.class)
  ResponseEntity<ErrorResponse> conflict(Exception e) { return ResponseEntity.status(409).body(ErrorResponse.of("HOTEL_INVENTORY_CONFLICT","Inventory changed; please try again")); }
  @ExceptionHandler(Exception.class)
  ResponseEntity<ErrorResponse> unexpected(Exception e) {
    LoggerFactory.getLogger(getClass()).error("hotel_request_failed type={}",e.getClass().getSimpleName());
    return ResponseEntity.internalServerError().body(ErrorResponse.of("HOTEL_UNAVAILABLE","Hotel reservations are temporarily unavailable"));
  }
}
