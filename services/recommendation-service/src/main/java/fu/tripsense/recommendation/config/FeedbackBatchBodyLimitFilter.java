package fu.tripsense.recommendation.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.recommendation.api.dto.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class FeedbackBatchBodyLimitFilter extends OncePerRequestFilter {
  static final int MAX_BATCH_BODY_BYTES = 64 * 1024;
  private static final String BATCH_PATH = "/api/recommendations/events/batch";
  private final ObjectMapper objectMapper;

  public FeedbackBatchBodyLimitFilter(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !"POST".equalsIgnoreCase(request.getMethod())
        || !request.getRequestURI().endsWith(BATCH_PATH);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    byte[] body = request.getInputStream().readNBytes(MAX_BATCH_BODY_BYTES + 1);
    if (body.length > MAX_BATCH_BODY_BYTES) {
      response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      objectMapper.writeValue(
          response.getOutputStream(),
          ApiResponse.error("FEEDBACK_BATCH_TOO_LARGE", "The feedback batch is too large"));
      return;
    }
    filterChain.doFilter(new CachedBodyRequest(request, body), response);
  }

  private static final class CachedBodyRequest extends HttpServletRequestWrapper {
    private final byte[] body;

    private CachedBodyRequest(HttpServletRequest request, byte[] body) {
      super(request);
      this.body = body;
    }

    @Override
    public ServletInputStream getInputStream() {
      ByteArrayInputStream input = new ByteArrayInputStream(body);
      return new ServletInputStream() {
        @Override
        public boolean isFinished() {
          return input.available() == 0;
        }

        @Override
        public boolean isReady() {
          return true;
        }

        @Override
        public void setReadListener(ReadListener readListener) {
          // Synchronous MVC reads this request body directly.
        }

        @Override
        public int read() {
          return input.read();
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
          return input.read(bytes, offset, length);
        }
      };
    }

    @Override
    public BufferedReader getReader() {
      return new BufferedReader(
          new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
    }
  }
}
