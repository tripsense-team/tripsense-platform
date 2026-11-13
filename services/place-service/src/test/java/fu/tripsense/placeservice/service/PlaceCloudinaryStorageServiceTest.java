package fu.tripsense.placeservice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class PlaceCloudinaryStorageServiceTest {

  @Test
  void reportsConfiguredWhenCredentialsPresent() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");
    assertTrue(service.isConfigured());
  }

  @Test
  void reportsNotConfiguredWhenAnyCredentialMissing() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("", "key123", "secret456", "tripsense/places");
    assertFalse(service.isConfigured());

    PlaceCloudinaryStorageService service2 =
        new PlaceCloudinaryStorageService("my-cloud", "", "secret456", "tripsense/places");
    assertFalse(service2.isConfigured());

    PlaceCloudinaryStorageService service3 =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "", "tripsense/places");
    assertFalse(service3.isConfigured());
  }

  @Test
  void identifiesCloudinaryUrlsAccurately() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");

    assertTrue(service.isCloudinaryUrl("https://res.cloudinary.com/dejiclsce/image/upload/v1/test.jpg"));
    assertFalse(service.isCloudinaryUrl("https://lh3.googleusercontent.com/places/ABC=s4800-w640"));
    assertFalse(service.isCloudinaryUrl("https://evil.example.com/?next=res.cloudinary.com"));
    assertFalse(service.isCloudinaryUrl(null));
    assertFalse(service.isCloudinaryUrl(""));
  }

  @Test
  void returnsExistingUrlIfAlreadyCloudinary() {
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService("my-cloud", "key123", "secret456", "tripsense/places");

    String existingCdnUrl = "https://res.cloudinary.com/dejiclsce/image/upload/v1234/tripsense/places/p1/photo_0.jpg";
    Optional<String> result = service.uploadRemotePhoto(existingCdnUrl, "p1", 0);
    assertTrue(result.isPresent());
    assertEquals(existingCdnUrl, result.get());
  }

  @Test
  void returnsEmptyIfRemoteUrlEmptyOrNotConfigured() {
    PlaceCloudinaryStorageService unconfigured =
        new PlaceCloudinaryStorageService("", "", "", "tripsense/places");

    Optional<String> resultEmptyUrl = unconfigured.uploadRemotePhoto("", "p1", 0);
    assertTrue(resultEmptyUrl.isEmpty());

    Optional<String> resultUnconfigured =
        unconfigured.uploadRemotePhoto("https://lh3.googleusercontent.com/abc", "p1", 0);
    assertTrue(resultUnconfigured.isEmpty());
  }

  @Test
  @SuppressWarnings("unchecked")
  void rejectsHtmlForbiddenResponsesBeforeCallingCloudinary() throws Exception {
    HttpClient mockHttp = mock(HttpClient.class);
    HttpResponse<byte[]> html403 = mock(HttpResponse.class);
    when(html403.statusCode()).thenReturn(403);
    when(html403.body()).thenReturn("<html>403</html>".getBytes(StandardCharsets.UTF_8));
    when(mockHttp.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(html403);

    RestClient mockRest = mock(RestClient.class);
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService(
            "my-cloud", "key123", "secret456", "tripsense/places", mockRest, mockHttp);

    Optional<String> result =
        service.uploadRemotePhoto("https://lh3.googleusercontent.com/expired", "ChIJ123", 0);

    assertTrue(result.isEmpty());
    verify(mockHttp, times(1)).send(any(), any(HttpResponse.BodyHandler.class));
    verifyNoInteractions(mockRest);
  }

  @Test
  @SuppressWarnings("unchecked")
  void rejectsNonImageMagicBytesEvenWhenStatusIs200() throws Exception {
    HttpClient mockHttp = mock(HttpClient.class);
    HttpResponse<byte[]> fake200 = mock(HttpResponse.class);
    when(fake200.statusCode()).thenReturn(200);
    when(fake200.headers())
        .thenReturn(HttpHeaders.of(Map.of("content-type", List.of("image/jpeg")), (a, b) -> true));
    when(fake200.body()).thenReturn("not-an-image".getBytes(StandardCharsets.UTF_8));
    when(mockHttp.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(fake200);

    RestClient mockRest = mock(RestClient.class);
    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService(
            "my-cloud", "key123", "secret456", "tripsense/places", mockRest, mockHttp);

    Optional<String> result =
        service.uploadRemotePhoto("https://lh3.googleusercontent.com/bad-bytes", "ChIJ123", 0);

    assertTrue(result.isEmpty());
    verifyNoInteractions(mockRest);
  }

  @Test
  @SuppressWarnings("unchecked")
  void downloadsValidatedJpegBytesAndUploadsMultipartToCloudinary() throws Exception {
    HttpClient mockHttp = mock(HttpClient.class);
    HttpResponse<byte[]> jpegOk = mock(HttpResponse.class);
    when(jpegOk.statusCode()).thenReturn(200);
    when(jpegOk.headers())
        .thenReturn(HttpHeaders.of(Map.of("content-type", List.of("image/jpeg")), (a, b) -> true));
    when(jpegOk.body()).thenReturn(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01});
    when(mockHttp.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(jpegOk);

    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo("https://api.cloudinary.com/v1_1/my-cloud/image/upload"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"secure_url\":\"https://res.cloudinary.com/my-cloud/image/upload/v1/tripsense/places/ChIJ123/photo_0.jpg\"}",
                MediaType.APPLICATION_JSON));

    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService(
            "my-cloud", "key123", "secret456", "tripsense/places", builder.build(), mockHttp);

    Optional<String> result =
        service.uploadRemotePhoto("https://lh3.googleusercontent.com/fresh", "ChIJ123", 0);

    server.verify();
    assertTrue(result.isPresent());
    assertEquals(
        "https://res.cloudinary.com/my-cloud/image/upload/v1/tripsense/places/ChIJ123/photo_0.jpg",
        result.get());
  }

  @Test
  @SuppressWarnings("unchecked")
  void retriesTransientTimeoutAndServerErrorsBeforeUploadingToCloudinary() throws Exception {
    HttpClient mockHttp = mock(HttpClient.class);
    HttpResponse<byte[]> serverError503 = mock(HttpResponse.class);
    when(serverError503.statusCode()).thenReturn(503);
    HttpResponse<byte[]> jpegOk = mock(HttpResponse.class);
    when(jpegOk.statusCode()).thenReturn(200);
    when(jpegOk.headers())
        .thenReturn(HttpHeaders.of(Map.of("content-type", List.of("image/jpeg")), (a, b) -> true));
    when(jpegOk.body()).thenReturn(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01});
    when(mockHttp.send(any(), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new java.net.http.HttpTimeoutException("timed out"))
        .thenReturn(serverError503)
        .thenReturn(jpegOk);

    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo("https://api.cloudinary.com/v1_1/my-cloud/image/upload"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(
            withSuccess(
                "{\"secure_url\":\"https://res.cloudinary.com/my-cloud/image/upload/v1/tripsense/places/ChIJ123/photo_0.jpg\"}",
                MediaType.APPLICATION_JSON));

    PlaceCloudinaryStorageService service =
        new PlaceCloudinaryStorageService(
            "my-cloud", "key123", "secret456", "tripsense/places", builder.build(), mockHttp);

    Optional<String> result =
        service.uploadRemotePhoto("https://lh3.googleusercontent.com/flaky", "ChIJ123", 0);

    server.verify();
    verify(mockHttp, times(3)).send(any(), any(HttpResponse.BodyHandler.class));
    assertTrue(result.isPresent());
    assertEquals(
        "https://res.cloudinary.com/my-cloud/image/upload/v1/tripsense/places/ChIJ123/photo_0.jpg",
        result.get());
  }
}

