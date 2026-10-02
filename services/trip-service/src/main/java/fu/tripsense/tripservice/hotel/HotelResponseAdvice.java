package fu.tripsense.tripservice.hotel;

import fu.tripsense.tripservice.dto.response.ApiResponse;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.*;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@RestControllerAdvice(assignableTypes=HotelController.class)
public class HotelResponseAdvice implements ResponseBodyAdvice<Object> {
  @Override public boolean supports(MethodParameter method,Class<? extends HttpMessageConverter<?>> converter) {
    return method.getContainingClass()==HotelController.class;
  }
  @Override public Object beforeBodyWrite(Object body,MethodParameter method,MediaType type,
      Class<? extends HttpMessageConverter<?>> converter,ServerHttpRequest request,ServerHttpResponse response) {
    response.getHeaders().setCacheControl("no-store");
    return ApiResponse.success(body);
  }
}
