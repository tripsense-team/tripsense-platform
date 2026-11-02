package fu.tripsense.placeservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Service
public class PlaceCloudinaryStorageService {

  private final String cloudName;
  private final String apiKey;
  private final String apiSecret;
  private final String folderPrefix;
  private final RestClient restClient;
  private final ObjectMapper objectMapper;

  public PlaceCloudinaryStorageService(
      @Value("${cloudinary.cloud-name:}") String cloudName,
      @Value("${cloudinary.api-key:}") String apiKey,
      @Value("${cloudinary.api-secret:}") String apiSecret,
      @Value("${cloudinary.place-folder-prefix:tripsense/places}") String folderPrefix) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.folderPrefix = folderPrefix;
    this.restClient = RestClient.builder().build();
    this.objectMapper = new ObjectMapper();
  }

  public boolean isConfigured() {
    return StringUtils.hasText(cloudName)
        && StringUtils.hasText(apiKey)
        && StringUtils.hasText(apiSecret);
  }

  public boolean isCloudinaryUrl(String url) {
    return url != null && url.contains("res.cloudinary.com");
  }

  /**
   * Uploads a remote image URL directly to Cloudinary. Cloudinary downloads the remote file
   * server-to-server and persists it permanently under the specified place folder.
   *
   * @param remoteUrl Active URL of the image (e.g., from ZioMap/Google)
   * @param providerPlaceId Unique provider place id used to isolate photos in folders
   * @param photoIndex Index of the photo in the gallery
   * @return The permanent Cloudinary secure URL, or empty if upload fails
   */
  public Optional<String> uploadRemotePhoto(
      String remoteUrl, String providerPlaceId, int photoIndex) {
    if (!StringUtils.hasText(remoteUrl)) {
      return Optional.empty();
    }
    if (isCloudinaryUrl(remoteUrl)) {
      return Optional.of(remoteUrl);
    }
    if (!isConfigured()) {
      log.debug("Cloudinary is not configured; skipping permanent photo upload");
      return Optional.empty();
    }

    try {
      String cleanPlaceId = safeIdentifier(providerPlaceId);
      String folder = folderPrefix + "/" + cleanPlaceId;
      String publicId = "photo_" + photoIndex;

      MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
      body.add("file", remoteUrl);
      body.add("folder", folder);
      body.add("public_id", publicId);
      body.add("overwrite", "true");

      String response =
          restClient
              .post()
              .uri("https://api.cloudinary.com/v1_1/{cloudName}/image/upload", cloudName)
              .headers(headers -> headers.setBasicAuth(apiKey, apiSecret))
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(body)
              .retrieve()
              .body(String.class);

      JsonNode result = objectMapper.readTree(response);
      String secureUrl = result != null ? result.path("secure_url").asText(null) : null;
      if (StringUtils.hasText(secureUrl)) {
        log.info(
            "Uploaded place photo permanently to Cloudinary: {}/{} -> {}",
            folder,
            publicId,
            secureUrl);
        return Optional.of(secureUrl);
      }
    } catch (RestClientResponseException ex) {
      log.warn(
          "Cloudinary photo upload rejected for place '{}' (status {}): {}",
          providerPlaceId,
          ex.getStatusCode(),
          ex.getResponseBodyAsString());
    } catch (Exception ex) {
      log.warn(
          "Cloudinary photo upload failed for place '{}': {}",
          providerPlaceId,
          ex.getMessage());
    }
    return Optional.empty();
  }

  private String safeIdentifier(String id) {
    if (!StringUtils.hasText(id)) {
      return "default";
    }
    return id.replaceAll("[^A-Za-z0-9._-]", "_");
  }
}

