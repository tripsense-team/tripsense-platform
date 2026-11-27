package fu.tripsense.recommendation.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class FeedbackBatchBodyLimitFilterTest {
  private final FeedbackBatchBodyLimitFilter filter =
      new FeedbackBatchBodyLimitFilter(new ObjectMapper());

  @Test
  void rejectsOversizedBatchBeforeControllerParsing() throws Exception {
    MockHttpServletRequest request = request();
    request.setContent(new byte[FeedbackBatchBodyLimitFilter.MAX_BATCH_BODY_BYTES + 1]);
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    assertThat(response.getStatus()).isEqualTo(413);
    assertThat(response.getContentAsString()).contains("FEEDBACK_BATCH_TOO_LARGE");
    verify(chain, never()).doFilter(request, response);
  }

  @Test
  void preservesAcceptedBatchBodyForControllerParsing() throws Exception {
    byte[] body = "{\"events\":[]}".getBytes(StandardCharsets.UTF_8);
    MockHttpServletRequest request = request();
    request.setContent(body);
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain = mock(FilterChain.class);

    filter.doFilter(request, response, chain);

    verify(chain).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(response));
    assertThat(response.getStatus()).isEqualTo(200);
  }

  private MockHttpServletRequest request() {
    MockHttpServletRequest request =
        new MockHttpServletRequest("POST", "/api/recommendations/events/batch");
    request.setContentType("application/json");
    return request;
  }
}
