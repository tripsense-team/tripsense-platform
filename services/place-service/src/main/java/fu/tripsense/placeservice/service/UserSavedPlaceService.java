package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.domain.model.UserPlaceCollection;
import fu.tripsense.placeservice.domain.model.UserSavedPlace;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.domain.repository.UserPlaceCollectionRepository;
import fu.tripsense.placeservice.domain.repository.UserSavedPlaceRepository;
import fu.tripsense.placeservice.dto.*;
import fu.tripsense.placeservice.exception.PlaceActionException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserSavedPlaceService {
  private static final int MAX_COLLECTIONS = 50;
  private static final int MAX_PLACES_PER_COLLECTION = 1000;

  private final UserPlaceCollectionRepository collections;
  private final UserSavedPlaceRepository savedPlaces;
  private final PlaceRepository places;
  private final PlaceDetailsService placeDetailsService;

  public List<PlaceCollectionDto> listCollections(UUID ownerId) {
    return collections.findByOwnerUserIdOrderByUpdatedAtDesc(ownerId).stream()
        .map(
            collection ->
                toDto(
                    collection,
                    savedPlaces.countByOwnerUserIdAndCollectionId(ownerId, collection.getId())))
        .toList();
  }

  public PlaceCollectionDto createCollection(UUID ownerId, String requestedName) {
    String name = normalizeDisplayName(requestedName);
    String normalized = name.toLowerCase(Locale.ROOT);
    if (collections.countByOwnerUserId(ownerId) >= MAX_COLLECTIONS) {
      throw conflict("COLLECTION_LIMIT_REACHED", "Collection limit reached");
    }
    if (collections.existsByOwnerUserIdAndNormalizedName(ownerId, normalized)) {
      throw conflict("COLLECTION_NAME_EXISTS", "A collection with this name already exists");
    }
    Instant now = Instant.now();
    try {
      UserPlaceCollection saved =
          collections.save(
              UserPlaceCollection.builder()
                  .id(UUID.randomUUID())
                  .ownerUserId(ownerId)
                  .name(name)
                  .normalizedName(normalized)
                  .createdAt(now)
                  .updatedAt(now)
                  .build());
      return toDto(saved, 0);
    } catch (DuplicateKeyException exception) {
      throw conflict("COLLECTION_NAME_EXISTS", "A collection with this name already exists");
    }
  }

  public PlaceCollectionDto renameCollection(
      UUID ownerId, UUID collectionId, String requestedName) {
    UserPlaceCollection collection = requireOwnedCollection(ownerId, collectionId);
    String name = normalizeDisplayName(requestedName);
    String normalized = name.toLowerCase(Locale.ROOT);
    if (!normalized.equals(collection.getNormalizedName())
        && collections.existsByOwnerUserIdAndNormalizedName(ownerId, normalized)) {
      throw conflict("COLLECTION_NAME_EXISTS", "A collection with this name already exists");
    }
    collection.setName(name);
    collection.setNormalizedName(normalized);
    collection.setUpdatedAt(Instant.now());
    try {
      UserPlaceCollection saved = collections.save(collection);
      return toDto(saved, savedPlaces.countByOwnerUserIdAndCollectionId(ownerId, collectionId));
    } catch (DuplicateKeyException exception) {
      throw conflict("COLLECTION_NAME_EXISTS", "A collection with this name already exists");
    }
  }

  public void deleteCollection(UUID ownerId, UUID collectionId) {
    Optional<UserPlaceCollection> ownedCollection =
        collections.findByIdAndOwnerUserId(collectionId, ownerId);
    if (ownedCollection.isPresent()) {
      // Delete the owner-validated collection first so a cleanup failure never
      // leaves a visible collection with only part of its memberships removed.
      collections.delete(ownedCollection.get());
    } else if (!savedPlaces.existsByOwnerUserIdAndCollectionId(ownerId, collectionId)) {
      throw new PlaceActionException(
          HttpStatus.NOT_FOUND, "COLLECTION_NOT_FOUND", "Collection not found");
    }
    // A repeated request can finish cleanup after a prior standalone-Mongo failure.
    savedPlaces.deleteByOwnerUserIdAndCollectionId(ownerId, collectionId);
  }

  public SavedStatusDto savePlace(UUID ownerId, UUID collectionId, String placeRef) {
    UserPlaceCollection collection = requireOwnedCollection(ownerId, collectionId);
    requireCanonicalPlace(placeRef);
    Optional<UserSavedPlace> existing =
        savedPlaces.findByOwnerUserIdAndCollectionIdAndPlaceRef(ownerId, collectionId, placeRef);
    if (existing.isEmpty()) {
      if (savedPlaces.countByOwnerUserIdAndCollectionId(ownerId, collectionId)
          >= MAX_PLACES_PER_COLLECTION) {
        throw conflict("COLLECTION_PLACE_LIMIT_REACHED", "Collection place limit reached");
      }
      try {
        savedPlaces.save(
            UserSavedPlace.builder()
                .id(UUID.randomUUID())
                .ownerUserId(ownerId)
                .collectionId(collectionId)
                .placeRef(placeRef)
                .savedAt(Instant.now())
                .build());
      } catch (DuplicateKeyException ignored) {
        // Idempotent PUT: a concurrent insert is the same successful outcome.
      }
      collection.setUpdatedAt(Instant.now());
      collections.save(collection);
    }
    return status(ownerId, placeRef);
  }

  public void removePlace(UUID ownerId, UUID collectionId, String placeRef) {
    requireOwnedCollection(ownerId, collectionId);
    savedPlaces.deleteByOwnerUserIdAndCollectionIdAndPlaceRef(ownerId, collectionId, placeRef);
  }

  public SavedStatusBatchResponse statuses(UUID ownerId, List<String> refs) {
    List<String> distinct =
        refs.stream().map(String::trim).filter(value -> !value.isEmpty()).distinct().toList();
    Map<String, List<UUID>> collectionIdsByPlace =
        savedPlaces.findByOwnerUserIdAndPlaceRefIn(ownerId, distinct).stream()
            .collect(
                Collectors.groupingBy(
                    UserSavedPlace::getPlaceRef,
                    Collectors.mapping(
                        UserSavedPlace::getCollectionId,
                        Collectors.collectingAndThen(
                            Collectors.toList(), values -> values.stream().distinct().toList()))));
    return new SavedStatusBatchResponse(
        distinct.stream()
            .map(
                ref -> {
                  List<UUID> collectionIds = collectionIdsByPlace.getOrDefault(ref, List.of());
                  return new SavedStatusDto(ref, !collectionIds.isEmpty(), collectionIds);
                })
            .toList());
  }

  public SavedPlacesPage listSaved(UUID ownerId, UUID collectionId, int page, int size) {
    if (page < 0 || size < 1 || size > 50) {
      throw new PlaceActionException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "Invalid pagination");
    }
    if (collectionId != null) requireOwnedCollection(ownerId, collectionId);
    List<UserSavedPlace> memberships =
        collectionId == null
            ? savedPlaces.findByOwnerUserIdOrderBySavedAtDesc(ownerId)
            : savedPlaces.findByOwnerUserIdAndCollectionIdOrderBySavedAtDesc(ownerId, collectionId);

    LinkedHashMap<String, List<UserSavedPlace>> grouped =
        memberships.stream()
            .collect(
                Collectors.groupingBy(
                    UserSavedPlace::getPlaceRef, LinkedHashMap::new, Collectors.toList()));
    List<String> refs = new ArrayList<>(grouped.keySet());
    int from = Math.min(page * size, refs.size());
    int to = Math.min(from + size, refs.size());
    List<String> pageRefs = refs.subList(from, to);
    Map<String, PlaceDto> placeById =
        placeDetailsService.getSnapshots(pageRefs).stream()
            .collect(Collectors.toMap(PlaceDto::getId, Function.identity(), (left, right) -> left));
    List<SavedPlaceDto> content =
        pageRefs.stream()
            .map(
                ref -> {
                  List<UserSavedPlace> values = grouped.get(ref);
                  Instant savedAt =
                      values.stream()
                          .map(UserSavedPlace::getSavedAt)
                          .max(Comparator.naturalOrder())
                          .orElse(null);
                  return new SavedPlaceDto(
                      ref,
                      placeById.get(ref),
                      values.stream().map(UserSavedPlace::getCollectionId).distinct().toList(),
                      savedAt);
                })
            .toList();
    int totalPages = refs.isEmpty() ? 0 : (int) Math.ceil((double) refs.size() / size);
    return new SavedPlacesPage(content, refs.size(), totalPages, size, page);
  }

  private SavedStatusDto status(UUID ownerId, String placeRef) {
    List<UUID> collectionIds =
        savedPlaces.findByOwnerUserIdAndPlaceRef(ownerId, placeRef).stream()
            .map(UserSavedPlace::getCollectionId)
            .distinct()
            .toList();
    return new SavedStatusDto(placeRef, !collectionIds.isEmpty(), collectionIds);
  }

  private UserPlaceCollection requireOwnedCollection(UUID ownerId, UUID collectionId) {
    return collections
        .findByIdAndOwnerUserId(collectionId, ownerId)
        .orElseThrow(
            () ->
                new PlaceActionException(
                    HttpStatus.NOT_FOUND, "COLLECTION_NOT_FOUND", "Collection not found"));
  }

  private void requireCanonicalPlace(String placeRef) {
    if (placeRef == null
        || !placeRef.matches("[A-Za-z0-9._:-]{1,200}")
        || !places.existsById(placeRef)) {
      throw new PlaceActionException(
          HttpStatus.UNPROCESSABLE_ENTITY, "PLACE_NOT_CANONICAL", "Place could not be resolved");
    }
  }

  private String normalizeDisplayName(String value) {
    String normalized = value == null ? "" : value.trim().replaceAll("\\s+", " ");
    if (normalized.isEmpty() || normalized.length() > 80) {
      throw new PlaceActionException(
          HttpStatus.BAD_REQUEST, "INVALID_COLLECTION_NAME", "Collection name is invalid");
    }
    return normalized;
  }

  private PlaceCollectionDto toDto(UserPlaceCollection collection, long count) {
    return new PlaceCollectionDto(
        collection.getId(),
        collection.getName(),
        count,
        collection.getVersion(),
        collection.getCreatedAt(),
        collection.getUpdatedAt());
  }

  private PlaceActionException conflict(String code, String message) {
    return new PlaceActionException(HttpStatus.CONFLICT, code, message);
  }
}
