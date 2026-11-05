package fu.tripsense.placeservice.service;

import fu.tripsense.placeservice.client.RecommendationIndexerClient;
import fu.tripsense.placeservice.domain.model.Place;
import fu.tripsense.placeservice.domain.model.PlaceMediaAsset;
import fu.tripsense.placeservice.domain.model.PlaceLifecycleStatus;
import fu.tripsense.placeservice.domain.model.PlaceManagementSource;
import fu.tripsense.placeservice.domain.repository.PlaceRepository;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Detail;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Location;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.MutationRequest;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Page;
import fu.tripsense.placeservice.dto.AdminPlaceCatalogDtos.Summary;
import fu.tripsense.placeservice.dto.DiscoveryCategory;
import fu.tripsense.placeservice.exception.PlaceActionException;
import fu.tripsense.placeservice.observability.RequestDiagnostics;
import java.net.URI;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.regex.Pattern;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AdminPlaceCatalogService {
  private static final Set<String> EDITABLE_FIELDS =
      Set.of("name", "primaryType", "categories", "location", "address", "oldAddress", "city",
          "district", "phone", "website", "socials", "openingHours", "businessStatus", "description");

  private final MongoTemplate mongo;
  private final PlaceRepository repository;
  private final PlaceCacheService cache;
  private final PlacePersistenceService persistence;
  private final RecommendationIndexerClient indexer;
  private final PlaceMediaStorage mediaStorage;

  public AdminPlaceCatalogService(MongoTemplate mongo, PlaceRepository repository,
      PlaceCacheService cache, PlacePersistenceService persistence,
      RecommendationIndexerClient indexer, PlaceMediaStorage mediaStorage) {
    this.mongo = mongo;
    this.repository = repository;
    this.cache = cache;
    this.persistence = persistence;
    this.indexer = indexer;
    this.mediaStorage = mediaStorage;
  }

  public Page list(String q, String lifecycle, String source, String category, String city,
      String cursor, int size) {
    if (size < 1 || size > 50) invalid("INVALID_PLACE", "Page size must be between 1 and 50");
    List<Criteria> filters = new ArrayList<>();
    String lifecycleFilter = upperOrDefault(lifecycle, "ACTIVE");
    switch (lifecycleFilter) {
      case "ACTIVE" -> filters.add(activeCriteria());
      case "ARCHIVED" -> filters.add(Criteria.where("lifecycleStatus").is("ARCHIVED"));
      case "ALL" -> { }
      default -> invalid("INVALID_PLACE", "Invalid lifecycle filter");
    }
    String sourceFilter = upperOrDefault(source, "ALL");
    switch (sourceFilter) {
      case "MANUAL" -> filters.add(Criteria.where("managementSource").is("MANUAL"));
      case "PROVIDER" -> filters.add(new Criteria().orOperator(
          Criteria.where("managementSource").is("PROVIDER"),
          Criteria.where("managementSource").exists(false)));
      case "ALL" -> { }
      default -> invalid("INVALID_PLACE", "Invalid source filter");
    }
    if (StringUtils.hasText(q)) {
      String value = q.trim();
      if (value.length() > 120) invalid("INVALID_PLACE", "Search query is too long");
      String safe = Pattern.quote(value);
      filters.add(new Criteria().orOperator(
          Criteria.where("name").regex(safe, "i"),
          Criteria.where("address").regex(safe, "i"),
          Criteria.where("providerPlaceId").regex(safe, "i")));
    }
    if (StringUtils.hasText(city)) {
      if (city.trim().length() > 120) invalid("INVALID_PLACE", "City filter is too long");
      filters.add(Criteria.where("city").regex("^" + Pattern.quote(city.trim()) + "$", "i"));
    }
    if (StringUtils.hasText(category)) {
      try {
        DiscoveryCategory group = DiscoveryCategory.valueOf(category.trim().toUpperCase(Locale.ROOT));
        Set<String> codes = new HashSet<>(group.primaryTypes());
        codes.addAll(group.legacyTypes());
        filters.add(new Criteria().orOperator(
            Criteria.where("primaryType").in(codes), Criteria.where("categories").in(codes)));
      } catch (IllegalArgumentException invalidCategory) {
        invalid("INVALID_TAXONOMY", "Invalid category filter");
      }
    }
    Cursor decoded = decodeCursor(cursor);
    if (decoded != null) {
      filters.add(new Criteria().orOperator(
          Criteria.where("updatedAt").lt(decoded.updatedAt()),
          new Criteria().andOperator(Criteria.where("updatedAt").is(decoded.updatedAt()),
              Criteria.where("_id").lt(decoded.id()))));
    }
    Query query = new Query();
    if (!filters.isEmpty()) query.addCriteria(new Criteria().andOperator(filters));
    query.with(Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("_id"))).limit(size + 1);
    List<Place> rows = mongo.find(query, Place.class);
    boolean hasNext = rows.size() > size;
    if (hasNext) rows = rows.subList(0, size);
    String next = hasNext && !rows.isEmpty() ? encodeCursor(rows.get(rows.size() - 1)) : null;
    Map<String, String> coverUrls = coverUrls(rows);
    return new Page(rows.stream().map(place -> summary(place, coverUrls.get(place.getId()))).toList(), next);
  }

  public Detail detail(String id) {
    return toDetail(require(id));
  }

  public Detail create(MutationRequest request, String actor) {
    Validated value = validate(request);
    Place duplicate = duplicate(value);
    if (duplicate != null) {
      throw new PlaceActionException(HttpStatus.CONFLICT, "PLACE_DUPLICATE",
          "A matching place already exists: " + duplicate.getId());
    }
    Instant now = Instant.now();
    Place place = Place.builder()
        .provider("MANUAL")
        .providerPlaceId("manual:" + UUID.randomUUID())
        .managementSource(PlaceManagementSource.MANUAL)
        .lifecycleStatus(PlaceLifecycleStatus.ACTIVE)
        .manualOverrideFields(new HashSet<>(EDITABLE_FIELDS))
        .manualCreatedBy(actor)
        .lastEditedBy(actor)
        .lastAdminAction("CREATE")
        .lastAdminRequestId(RequestDiagnostics.requestId())
        .lastFetchedAt(now)
        .build();
    apply(place, value);
    Place saved = repository.save(place);
    afterMutation(saved, false);
    return toDetail(saved);
  }

  public Detail update(String id, long version, MutationRequest request, String actor) {
    Place existing = require(id);
    Validated value = validate(request, existing);
    Set<String> changedFields = new HashSet<>();
    Update update = editableUpdate(value, existing, changedFields)
        .set("lastEditedBy", actor)
        .set("lastAdminAction", "UPDATE")
        .set("lastAdminRequestId", RequestDiagnostics.requestId())
        .set("updatedAt", Instant.now())
        .inc("version", 1L);
    if (!changedFields.isEmpty())
      update.addToSet("manualOverrideFields").each(changedFields.toArray());
    Place saved = mutate(id, version, activeCriteria(), update);
    afterMutation(saved, false);
    return toDetail(saved);
  }

  public void archive(String id, long version, String actor) {
    Instant now = Instant.now();
    Place saved = mutate(id, version, activeCriteria(), new Update()
        .set("lifecycleStatus", PlaceLifecycleStatus.ARCHIVED)
        .set("archivedAt", now).set("archivedBy", actor).set("lastEditedBy", actor)
        .set("lastAdminAction", "ARCHIVE")
        .set("lastAdminRequestId", RequestDiagnostics.requestId())
        .set("updatedAt", now).inc("version", 1L));
    afterMutation(saved, true);
  }

  public Detail restore(String id, long version, String actor) {
    Place saved = mutate(id, version, Criteria.where("lifecycleStatus").is("ARCHIVED"), new Update()
        .set("lifecycleStatus", PlaceLifecycleStatus.ACTIVE)
        .unset("archivedAt").unset("archivedBy").set("lastEditedBy", actor)
        .set("lastAdminAction", "RESTORE")
        .set("lastAdminRequestId", RequestDiagnostics.requestId())
        .set("updatedAt", Instant.now()).inc("version", 1L));
    afterMutation(saved, false);
    return toDetail(saved);
  }

  private Place mutate(String id, long version, Criteria state, Update update) {
    Query query = Query.query(new Criteria().andOperator(Criteria.where("_id").is(id), state,
        versionCriteria(version)));
    Place saved = mongo.findAndModify(query, update,
        FindAndModifyOptions.options().returnNew(true), Place.class);
    if (saved != null) return saved;
    Place current = repository.findById(id).orElseThrow(() ->
        new PlaceActionException(HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "Place not found"));
    throw new PlaceActionException(HttpStatus.CONFLICT, "PLACE_VERSION_CONFLICT",
        "Place has changed; current revision is " + safeVersion(current));
  }

  private Criteria versionCriteria(long version) {
    if (version == 0) return new Criteria().orOperator(
        Criteria.where("version").is(0L), Criteria.where("version").exists(false));
    return Criteria.where("version").is(version);
  }

  private void afterMutation(Place place, boolean archived) {
    cache.invalidatePlaceCatalog(place.getId());
    if (archived) indexer.triggerDeindexingAsync(place.getId());
    else {
      var snapshot = persistence.toDto(place);
      if (snapshot != null) indexer.triggerIndexingAsync(List.of(snapshot));
    }
  }

  private Validated validate(MutationRequest request) {
    return validate(request, null);
  }

  private Validated validate(MutationRequest request, Place existing) {
    boolean taxonomyUnchanged = existing != null
        && Objects.equals(request.primaryType(), existing.getPrimaryType())
        && Objects.equals(request.categories(), safeList(existing.getCategories()));
    String primary = taxonomyUnchanged ? existing.getPrimaryType()
        : DiscoveryCategory.normalizePrimaryType(request.primaryType());
    List<String> categories = taxonomyUnchanged ? safeList(existing.getCategories())
        : request.categories().stream().map(DiscoveryCategory::normalizePrimaryType).toList();
    if (!taxonomyUnchanged) {
      if (primary == null || Set.of("point_of_interest", "establishment").contains(primary))
        invalid("INVALID_TAXONOMY", "A supported specific primary type is required");
      if (categories.stream().anyMatch(v -> v == null)) invalid("INVALID_TAXONOMY", "Categories are invalid");
      if (DiscoveryCategory.owner(categories, request.name(), primary) == null)
        invalid("INVALID_TAXONOMY", "Primary type and categories are not supported together");
    }
    if (existing == null || !Objects.equals(nullable(request.website()), existing.getWebsite()))
      validateHttps(request.website());
    if (existing == null || !Objects.equals(request.socials(), safeList(existing.getSocials()))) {
      if (request.socials() != null) request.socials().forEach(this::validateHttps);
    }
    return new Validated(clean(request.name()), primary, categories, request.location(),
        clean(request.address()), nullable(request.oldAddress()), clean(request.city()),
        nullable(request.district()), nullable(request.phone()), nullable(request.website()),
        request.socials() == null ? List.of() : request.socials().stream().map(this::nullable).toList(),
        nullable(request.openingHours()), nullable(request.businessStatus()), nullable(request.description()));
  }

  private void validateHttps(String raw) {
    if (!StringUtils.hasText(raw)) return;
    try {
      URI uri = URI.create(raw.trim());
      if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
        invalid("INVALID_PLACE", "URLs must use HTTPS and must not contain credentials");
    } catch (IllegalArgumentException invalidUri) {
      invalid("INVALID_PLACE", "A URL is invalid");
    }
  }

  private Place duplicate(Validated value) {
    return repository.findByNormalizedName(normalize(value.name())).stream()
        .filter(p -> StringUtils.hasText(p.getAddress()) && normalize(p.getAddress()).equals(normalize(value.address())))
        .filter(p -> p.getLocation() != null && distanceMeters(p.getLocation().getY(), p.getLocation().getX(),
            value.location().lat(), value.location().lng()) <= 100).findFirst().orElse(null);
  }

  private void apply(Place place, Validated value) {
    place.setName(value.name()); place.setNormalizedName(normalize(value.name()));
    place.setPrimaryType(value.primaryType()); place.setCategories(value.categories());
    place.setLocation(new GeoJsonPoint(value.location().lng(), value.location().lat()));
    place.setAddress(value.address()); place.setOldAddress(value.oldAddress());
    place.setCity(value.city()); place.setDistrict(value.district()); place.setPhone(value.phone());
    place.setWebsite(value.website()); place.setSocials(value.socials());
    place.setOpeningHours(value.openingHours()); place.setBusinessStatus(value.businessStatus());
    place.setDescription(value.description());
  }

  private Update editableUpdate(Validated value, Place existing, Set<String> changedFields) {
    Update update = new Update();
    if (!Objects.equals(existing.getName(), value.name())) {
      update.set("name", value.name()).set("normalizedName", normalize(value.name()));
      changedFields.add("name");
    }
    setIfChanged(update, changedFields, "primaryType", existing.getPrimaryType(), value.primaryType());
    setIfChanged(update, changedFields, "categories", safeList(existing.getCategories()), value.categories());
    if (existing.getLocation() == null || existing.getLocation().getY() != value.location().lat()
        || existing.getLocation().getX() != value.location().lng()) {
      update.set("location", new GeoJsonPoint(value.location().lng(), value.location().lat()));
      changedFields.add("location");
    }
    setIfChanged(update, changedFields, "address", existing.getAddress(), value.address());
    setIfChanged(update, changedFields, "oldAddress", existing.getOldAddress(), value.oldAddress());
    setIfChanged(update, changedFields, "city", existing.getCity(), value.city());
    setIfChanged(update, changedFields, "district", existing.getDistrict(), value.district());
    setIfChanged(update, changedFields, "phone", existing.getPhone(), value.phone());
    setIfChanged(update, changedFields, "website", existing.getWebsite(), value.website());
    setIfChanged(update, changedFields, "socials", safeList(existing.getSocials()), value.socials());
    setIfChanged(update, changedFields, "openingHours", existing.getOpeningHours(), value.openingHours());
    setIfChanged(update, changedFields, "businessStatus", existing.getBusinessStatus(), value.businessStatus());
    setIfChanged(update, changedFields, "description", existing.getDescription(), value.description());
    return update;
  }

  private void setIfChanged(Update update, Set<String> changedFields, String field, Object previous, Object value) {
    if (Objects.equals(previous, value)) return;
    if (value == null) update.unset(field);
    else update.set(field, value);
    changedFields.add(field);
  }

  private Place require(String id) {
    return repository.findById(id).orElseThrow(() ->
        new PlaceActionException(HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "Place not found"));
  }

  private Summary summary(Place p, String coverPhotoUrl) {
    return new Summary(p.getId(), p.getName(), p.getCity(), p.getPrimaryType(), safeList(p.getCategories()),
        p.getProvider(), source(p), lifecycle(p), p.getMediaState() == null ? null : p.getMediaState().name(),
        coverPhotoUrl, safeVersion(p), p.getUpdatedAt());
  }

  private Map<String, String> coverUrls(List<Place> places) {
    if (places.isEmpty()) return Map.of();
    List<String> placeIds = places.stream().map(Place::getId).toList();
    Query query = Query.query(new Criteria().andOperator(
        Criteria.where("placeId").in(placeIds),
        Criteria.where("moderationStatus").is(PlaceMediaAsset.ModerationStatus.APPROVED),
        Criteria.where("healthStatus").is(PlaceMediaAsset.HealthStatus.HEALTHY),
        Criteria.where("deletedAt").is(null)));
    Map<String, Place> byId = places.stream().collect(Collectors.toMap(Place::getId, Function.identity()));
    Map<String, PlaceMediaAsset> selected = new java.util.HashMap<>();
    for (PlaceMediaAsset asset : mongo.find(query, PlaceMediaAsset.class)) {
      Place owner = byId.get(asset.getPlaceId());
      if (owner == null) continue;
      PlaceMediaAsset current = selected.get(asset.getPlaceId());
      if (current == null || asset.getId().equals(owner.getPrimaryMediaAssetId()))
        selected.put(asset.getPlaceId(), asset);
    }
    Map<String, String> urls = new java.util.HashMap<>();
    selected.forEach((placeId, asset) -> {
      String url = mediaStorage.deliveryUrl(asset.getStoragePublicId());
      if (url != null) urls.put(placeId, url);
    });
    return urls;
  }

  private Detail toDetail(Place p) {
    String coverPhotoUrl = coverUrls(List.of(p)).get(p.getId());
    Location location = p.getLocation() == null ? null : new Location(p.getLocation().getY(), p.getLocation().getX());
    return new Detail(p.getId(), p.getName(), p.getNormalizedName(), p.getPrimaryType(), safeList(p.getCategories()),
        location, p.getAddress(), p.getOldAddress(), p.getCity(), p.getDistrict(), p.getPhone(), p.getWebsite(),
        safeList(p.getSocials()), p.getOpeningHours(), p.getBusinessStatus(), p.getDescription(), p.getProvider(),
        p.getProviderPlaceId(), source(p), lifecycle(p), p.getMediaState() == null ? null : p.getMediaState().name(),
        coverPhotoUrl, p.getManualOverrideFields() == null ? Set.of() : p.getManualOverrideFields(), safeVersion(p),
        p.getManualCreatedBy(), p.getLastEditedBy(), p.getLastAdminAction(), p.getArchivedAt(), p.getArchivedBy(),
        p.getCreatedAt(), p.getUpdatedAt());
  }

  private String source(Place p) { return p.getManagementSource() == null ? "PROVIDER" : p.getManagementSource().name(); }
  private String lifecycle(Place p) { return p.getLifecycleStatus() == null ? "ACTIVE" : p.getLifecycleStatus().name(); }
  private long safeVersion(Place p) { return p.getVersion() == null ? 0L : p.getVersion(); }
  private List<String> safeList(List<String> values) { return values == null ? List.of() : values; }
  private String clean(String value) { return Normalizer.normalize(value.trim(), Normalizer.Form.NFC); }
  private String nullable(String value) { return StringUtils.hasText(value) ? clean(value) : null; }
  private String normalize(String value) { return clean(value).toLowerCase(Locale.ROOT); }
  private String upperOrDefault(String value, String fallback) { return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : fallback; }
  private Criteria activeCriteria() { return new Criteria().orOperator(Criteria.where("lifecycleStatus").is("ACTIVE"), Criteria.where("lifecycleStatus").exists(false)); }

  private Cursor decodeCursor(String raw) {
    if (!StringUtils.hasText(raw)) return null;
    if (raw.length() > 512) invalid("INVALID_CURSOR", "Invalid page cursor");
    try {
      String value = new String(Base64.getUrlDecoder().decode(raw), java.nio.charset.StandardCharsets.UTF_8);
      String[] parts = value.split("\\|", 2);
      return new Cursor(Instant.ofEpochMilli(Long.parseLong(parts[0])), parts[1]);
    } catch (RuntimeException invalidCursor) {
      invalid("INVALID_CURSOR", "Invalid page cursor");
      return null;
    }
  }

  private String encodeCursor(Place place) {
    Instant updated = place.getUpdatedAt() == null ? Instant.EPOCH : place.getUpdatedAt();
    String value = updated.toEpochMilli() + "|" + place.getId();
    return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }

  private double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
    double lat = Math.toRadians(lat2 - lat1), lon = Math.toRadians(lon2 - lon1);
    double arc = Math.sin(lat / 2) * Math.sin(lat / 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(lon / 2) * Math.sin(lon / 2);
    return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(arc)));
  }

  private void invalid(String code, String message) { throw new PlaceActionException(HttpStatus.BAD_REQUEST, code, message); }

  private record Cursor(Instant updatedAt, String id) {}
  private record Validated(String name, String primaryType, List<String> categories, Location location,
      String address, String oldAddress, String city, String district, String phone, String website,
      List<String> socials, String openingHours, String businessStatus, String description) {}
}
