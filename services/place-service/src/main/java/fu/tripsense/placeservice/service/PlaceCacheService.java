package fu.tripsense.placeservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fu.tripsense.placeservice.config.TripSensePlaceProperties;
import fu.tripsense.placeservice.dto.AutocompleteSuggestionDto;
import fu.tripsense.placeservice.dto.PlaceDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Slf4j
@Service
public class PlaceCacheService {

    private static final String SEARCH_KEY_PREFIX = "place:search:";
    private static final String AUTOCOMPLETE_KEY_PREFIX = "place:autocomplete:";
    private static final String DETAILS_KEY_PREFIX = "place:details:";
    private static final String PROVIDER_KEY_PREFIX = "place:provider:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final TripSensePlaceProperties properties;
    private final ObjectMapper objectMapper;

    public PlaceCacheService(RedisTemplate<String, Object> redisTemplate,
                             TripSensePlaceProperties properties,
                             ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public Optional<List<PlaceDto>> getSearchResults(String normalizedQuery, double lat, double lng, int radius, int limit) {
        try {
            String key = SEARCH_KEY_PREFIX + hash(cacheKey(normalizedQuery, lat, lng, radius, limit));
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                List<PlaceDto> list = objectMapper.convertValue(cached, new TypeReference<List<PlaceDto>>() {});
                return Optional.ofNullable(list);
            }
        } catch (Exception ex) {
            log.warn("Redis cache read error for search query '{}': {}", normalizedQuery, ex.getMessage());
        }
        return Optional.empty();
    }

    public void putSearchResults(String normalizedQuery, double lat, double lng, int radius, int limit, List<PlaceDto> results) {
        if (results == null || results.isEmpty()) {
            return;
        }
        try {
            String key = SEARCH_KEY_PREFIX + hash(cacheKey(normalizedQuery, lat, lng, radius, limit));
            long ttl = properties.getCache().getSearchTtlSeconds();
            redisTemplate.opsForValue().set(key, results, Duration.ofSeconds(ttl));
        } catch (Exception ex) {
            log.warn("Redis cache write error for search query '{}': {}", normalizedQuery, ex.getMessage());
        }
    }

    public Optional<List<AutocompleteSuggestionDto>> getAutocomplete(
            String normalizedQuery, double lat, double lng, int radius, int limit) {
        try {
            String key = AUTOCOMPLETE_KEY_PREFIX + hash(cacheKey(normalizedQuery, lat, lng, radius, limit));
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                List<AutocompleteSuggestionDto> list = objectMapper.convertValue(cached, new TypeReference<List<AutocompleteSuggestionDto>>() {});
                return Optional.ofNullable(list);
            }
        } catch (Exception ex) {
            log.warn("Redis cache read error for autocomplete query '{}': {}", normalizedQuery, ex.getMessage());
        }
        return Optional.empty();
    }

    public void putAutocomplete(String normalizedQuery, double lat, double lng, int radius, int limit,
                                List<AutocompleteSuggestionDto> suggestions) {
        if (suggestions == null || suggestions.isEmpty()) {
            return;
        }
        try {
            String key = AUTOCOMPLETE_KEY_PREFIX + hash(cacheKey(normalizedQuery, lat, lng, radius, limit));
            long ttl = properties.getCache().getAutocompleteTtlSeconds();
            redisTemplate.opsForValue().set(key, suggestions, Duration.ofSeconds(ttl));
        } catch (Exception ex) {
            log.warn("Redis cache write error for autocomplete query '{}': {}", normalizedQuery, ex.getMessage());
        }
    }

    public Optional<PlaceDto> getPlaceDetails(String placeId) {
        try {
            String key = DETAILS_KEY_PREFIX + placeId;
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached != null) {
                PlaceDto dto = objectMapper.convertValue(cached, PlaceDto.class);
                return Optional.ofNullable(dto);
            }
        } catch (Exception ex) {
            log.warn("Redis cache read error for placeId '{}': {}", placeId, ex.getMessage());
        }
        return Optional.empty();
    }

    public void putPlaceDetails(String placeId, PlaceDto place) {
        if (place == null) {
            return;
        }
        try {
            String key = DETAILS_KEY_PREFIX + placeId;
            long ttl = properties.getCache().getDetailsTtlSeconds();
            redisTemplate.opsForValue().set(key, place, Duration.ofSeconds(ttl));

            if (place.getProvider() != null && place.getProviderPlaceId() != null) {
                String providerKey = PROVIDER_KEY_PREFIX + place.getProvider() + ":" + place.getProviderPlaceId();
                redisTemplate.opsForValue().set(providerKey, place, Duration.ofSeconds(properties.getCache().getProviderTtlSeconds()));
            }
        } catch (Exception ex) {
            log.warn("Redis cache write error for placeId '{}': {}", placeId, ex.getMessage());
        }
    }

    private String hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : encoded) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.substring(0, 16);
        } catch (Exception e) {
            return String.valueOf(input.hashCode());
        }
    }

    private String cacheKey(String query, double lat, double lng, int radius, int limit) {
        return String.format(Locale.ROOT, "%s|%.4f|%.4f|%d|%d", query, lat, lng, radius, limit);
    }
}
