package fu.tripsense.placeservice.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fu.tripsense.placeservice.config.SecurityConfig;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Page;
import fu.tripsense.placeservice.security.JwtAuthenticationFilter;
import fu.tripsense.placeservice.security.JwtService;
import fu.tripsense.placeservice.service.AdminPlaceCatalogService;
import fu.tripsense.placeservice.service.AdminPlaceReverseGeocodeService;
import java.util.List;
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

class AdminPlaceCatalogControllerSecurityTest {
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
  void close() { context.close(); }

  @Test
  void catalogRequiresAdminRole() throws Exception {
    AdminPlaceCatalogService service = context.getBean(AdminPlaceCatalogService.class);
    mvc.perform(get("/api/places/admin/catalog")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/places/admin/catalog").with(user("traveler").roles("USER")))
        .andExpect(status().isForbidden());
    verifyNoInteractions(service);
  }

  @Test
  void adminCanLoadCatalog() throws Exception {
    AdminPlaceCatalogService service = context.getBean(AdminPlaceCatalogService.class);
    when(service.list(null, "ACTIVE", "ALL", null, null, null, 24))
        .thenReturn(new Page(List.of(), null));

    mvc.perform(get("/api/places/admin/catalog")
            .param("size", "24")
            .param("lifecycle", "ACTIVE")
            .param("source", "ALL")
            .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items").isArray())
        .andExpect(jsonPath("$.data.items").isEmpty())
        .andExpect(jsonPath("$.data.nextCursor").doesNotExist());

    verify(service).list(null, "ACTIVE", "ALL", null, null, null, 24);
  }

  @Test
  void reverseGeocodeRequiresAdminAndReturnsOnlySafeFields() throws Exception {
    AdminPlaceReverseGeocodeService lookup = context.getBean(AdminPlaceReverseGeocodeService.class);
    mvc.perform(get("/api/places/admin/catalog/reverse-geocode").param("lat", "16.05").param("lng", "108.2"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/places/admin/catalog/reverse-geocode").param("lat", "16.05").param("lng", "108.2")
        .with(user("traveler").roles("USER"))).andExpect(status().isForbidden());
    verifyNoInteractions(lookup);
    when(lookup.lookup(16.05, 108.2))
        .thenReturn(new AdminPlaceReverseGeocodeService.Result(true, "Đà Nẵng", 12.0, "MAPVINA"));
    mvc.perform(get("/api/places/admin/catalog/reverse-geocode").param("lat", "16.05").param("lng", "108.2")
        .with(user("admin").roles("ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.address").value("Đà Nẵng"))
        .andExpect(jsonPath("$.data.key").doesNotExist());
    verify(lookup).lookup(16.05, 108.2);
  }

  @Configuration
  @EnableWebMvc
  @Import({SecurityConfig.class, GlobalExceptionHandler.class})
  static class Config {
    @Bean AdminPlaceCatalogService adminPlaceCatalogService() {
      return mock(AdminPlaceCatalogService.class);
    }

    @Bean AdminPlaceReverseGeocodeService reverseGeocodeService() {
      return mock(AdminPlaceReverseGeocodeService.class);
    }

    @Bean AdminPlaceCatalogController adminPlaceCatalogController(AdminPlaceCatalogService service,
        AdminPlaceReverseGeocodeService reverseGeocodeService) {
      return new AdminPlaceCatalogController(service, true, reverseGeocodeService);
    }

    @Bean JwtAuthenticationFilter jwtFilter() {
      return new JwtAuthenticationFilter(mock(JwtService.class));
    }
  }
}
