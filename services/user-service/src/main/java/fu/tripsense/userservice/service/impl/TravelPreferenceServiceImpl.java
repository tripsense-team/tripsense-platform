package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.dto.request.TravelPreferenceRequest;
import fu.tripsense.userservice.dto.response.TravelPreferenceDto;
import fu.tripsense.userservice.entity.TravelPreference;
import fu.tripsense.userservice.repository.TravelPreferenceRepository;
import fu.tripsense.userservice.service.TravelPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TravelPreferenceServiceImpl implements TravelPreferenceService {
    private final TravelPreferenceRepository repository;

    @Override
    @Transactional(readOnly = true)
    public TravelPreferenceDto get(UUID userId) {
        return repository.findById(userId).map(this::toDto)
                .orElseGet(() -> new TravelPreferenceDto(false, Map.of(), null, 0L, null));
    }

    @Override
    @Transactional
    public TravelPreferenceDto update(UUID userId, TravelPreferenceRequest request) {
        TravelPreference entity = repository.findById(userId)
                .orElseGet(() -> TravelPreference.builder().userId(userId).build());
        boolean wasEnabled = entity.isPersonalizationEnabled();
        entity.setPersonalizationEnabled(request.personalizationEnabled());
        entity.setPreferences(normalize(request));
        if (request.personalizationEnabled() && !wasEnabled) entity.setConsentedAt(Instant.now());
        if (!request.personalizationEnabled()) entity.setConsentedAt(null);
        return toDto(repository.save(entity));
    }

    @Override
    @Transactional
    public TravelPreferenceDto reset(UUID userId) {
        repository.deleteById(userId);
        return new TravelPreferenceDto(false, Map.of(), null, 0L, null);
    }

    private Map<String, Object> normalize(TravelPreferenceRequest request) {
        Map<String, Object> result = new LinkedHashMap<>();
        putList(result, "preferredCategories", request.preferredCategories());
        putList(result, "excludedCategories", request.excludedCategories());
        putList(result, "dietaryTags", request.dietaryTags());
        putList(result, "accessibilityNeeds", request.accessibilityNeeds());
        putList(result, "ambiencePreferences", request.ambiencePreferences());
        if (request.pace() != null && !request.pace().isBlank()) result.put("pace", request.pace().trim().toUpperCase());
        if (request.budgetLevel() != null && !request.budgetLevel().isBlank()) result.put("budgetLevel", request.budgetLevel().trim().toUpperCase());
        return result;
    }

    private void putList(Map<String, Object> result, String key, List<String> values) {
        if (values == null) return;
        List<String> normalized = values.stream().filter(value -> value != null && !value.isBlank())
                .map(value -> value.trim().toUpperCase()).distinct().sorted().toList();
        if (!normalized.isEmpty()) result.put(key, normalized);
    }

    private TravelPreferenceDto toDto(TravelPreference entity) {
        return new TravelPreferenceDto(entity.isPersonalizationEnabled(),
                entity.isPersonalizationEnabled() ? Map.copyOf(entity.getPreferences()) : Map.of(),
                entity.getConsentedAt(), entity.getVersion(), entity.getUpdatedAt());
    }
}
