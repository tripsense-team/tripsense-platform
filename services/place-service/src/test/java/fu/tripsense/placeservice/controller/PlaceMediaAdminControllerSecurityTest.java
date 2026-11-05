package fu.tripsense.placeservice.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fu.tripsense.placeservice.config.SecurityConfig;
import fu.tripsense.placeservice.dto.PlaceMediaAdminDtos;
import fu.tripsense.placeservice.security.JwtAuthenticationFilter;
import fu.tripsense.placeservice.security.JwtService;
import fu.tripsense.placeservice.service.PlaceMediaService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

class PlaceMediaAdminControllerSecurityTest {
  private AnnotationConfigWebApplicationContext context;
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    context = new AnnotationConfigWebApplicationContext();
    context.setServletContext(new MockServletContext());
    context.register(Config.class);
    context.refresh();
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @AfterEach
  void close() {
    context.close();
  }

  @Test
  void coverageRequiresAdminRole() throws Exception {
    PlaceMediaService service = context.getBean(PlaceMediaService.class);
    mvc.perform(get("/api/places/admin/media/coverage"))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            get("/api/places/admin/media/coverage")
                .with(user("traveler").roles("USER")))
        .andExpect(status().isForbidden());
    verifyNoInteractions(service);
  }

  @Test
  void adminCanReadCoverage() throws Exception {
    PlaceMediaService service = context.getBean(PlaceMediaService.class);
    org.mockito.Mockito.when(service.coverage(null, null, 0, 50))
        .thenReturn(new PlaceMediaAdminDtos.CoverageResponse(Map.of(), List.of(), null));

    mvc.perform(
            get("/api/places/admin/media/coverage")
                .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk());
  }

  @Configuration
  @EnableWebMvc
  @Import({SecurityConfig.class, PlaceMediaAdminController.class, GlobalExceptionHandler.class})
  static class Config {
    @Bean
    PlaceMediaService mediaService() {
      return mock(PlaceMediaService.class);
    }

    @Bean
    JwtAuthenticationFilter jwtFilter() {
      return new JwtAuthenticationFilter(mock(JwtService.class));
    }
  }
}
