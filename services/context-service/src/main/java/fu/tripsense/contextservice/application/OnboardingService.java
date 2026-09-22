package fu.tripsense.contextservice.application;

import fu.tripsense.contextservice.domain.*;
import jakarta.transaction.Transactional;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class OnboardingService {
  private final OnboardingProfileRepository profiles;
  private final PreferenceSignalPublisher signals;
  private final PreferenceDimensionCatalog dimensions;
  private final ContextEventOutbox outbox;

  public OnboardingService(
      OnboardingProfileRepository profiles,
      PreferenceSignalPublisher signals,
      PreferenceDimensionCatalog dimensions,
      ContextEventOutbox outbox) {
    this.profiles = profiles;
    this.signals = signals;
    this.dimensions = dimensions;
    this.outbox = outbox;
  }

  @Transactional
  public Optional<OnboardingProfile> find(UUID userId) {
    return profiles.findByUserId(userId);
  }

  @Transactional
  public OnboardingProfile start(UUID userId) {
    return profiles
        .findByUserId(userId)
        .orElseGet(() -> profiles.save(OnboardingProfile.start(userId)));
  }

  @Transactional
  public OnboardingProfile save(UUID userId, OnboardingCommand command) {
    validate(command);
    OnboardingProfile profile = start(userId);
    profile.replaceAnswers(
        command.selections(),
        command.places(),
        command.attributes(),
        command.freeText(),
        command.version());
    profile = profiles.save(profile);
    outbox.recordProfileChanged(profile);
    return profile;
  }

  @Transactional
  public OnboardingProfile complete(UUID userId, long version) {
    OnboardingProfile profile = start(userId);
    boolean alreadyCompleted = profile.status() == OnboardingStatus.COMPLETED;
    profile.complete(version);
    profile = profiles.save(profile);
    if (!alreadyCompleted) {
      signals.replaceFor(profile);
      outbox.recordProfileChanged(profile);
    }
    return profile;
  }

  @Transactional
  public void delete(UUID userId) {
    profiles.deleteByUserId(userId);
    signals.deleteForUser(userId);
  }

  private void validate(OnboardingCommand command) {
    if (command.selections() == null || command.places() == null)
      throw new IllegalArgumentException("Answers must be provided");
    command
        .selections()
        .forEach(
            (dimension, values) -> {
              PreferenceDimensionCatalog.PreferenceDimension definition =
                  dimensions
                      .findActive(dimension)
                      .orElseThrow(
                          () ->
                              new IllegalArgumentException(
                                  "An unsupported preference dimension was supplied"));
              if (values == null
                  || values.isEmpty()
                  || values.size() > 20
                  || values.stream().anyMatch(v -> v == null || !v.matches("[A-Z0-9_\\-]{1,80}")))
                throw new IllegalArgumentException("Invalid values for " + dimension);
              if (definition.cardinality() == PreferenceDimensionCatalog.Cardinality.SINGLE
                  && values.size() != 1)
                throw new IllegalArgumentException(dimension + " accepts one value");
            });
    command
        .places()
        .forEach(
            (intent, values) -> {
              if (intent == null
                  || values == null
                  || values.size() > 20
                  || values.stream()
                      .anyMatch(v -> v == null || !v.matches("[A-Za-z0-9_:\\-]{1,160}")))
                throw new IllegalArgumentException("Invalid destination references");
            });
    if (command.freeText() != null && command.freeText().length() > 2000) {
      throw new IllegalArgumentException("Free text note must not exceed 2000 characters");
    }
    if (command.attributes() != null) {
      command.attributes().forEach((code, valueJson) -> {
        if (code == null || !code.matches("[A-Za-z0-9_]{1,80}")) {
          throw new IllegalArgumentException("Invalid attribute code: " + code);
        }
        if (valueJson != null && valueJson.length() > 4000) {
          throw new IllegalArgumentException("Attribute value payload is too large for " + code);
        }
      });
    }
  }
}
