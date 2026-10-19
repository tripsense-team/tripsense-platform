package fu.tripsense.contextservice.adapter.out.persistence;

import fu.tripsense.contextservice.application.ContextDiagnostics;
import fu.tripsense.contextservice.application.PreferenceSignalReader.PreferenceSignal;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshot;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshot.Revision;
import fu.tripsense.contextservice.application.cache.PreferenceSnapshotSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Scalar SQL only, in Context's own database. One catalog query, never per-signal N+1. */
@Repository
public class JdbcPreferenceSnapshotSource implements PreferenceSnapshotSource {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate read;

  public JdbcPreferenceSnapshotSource(
      DataSource dataSource, PlatformTransactionManager transactions) {
    this.jdbc = new JdbcTemplate(dataSource);
    this.jdbc.setQueryTimeout(2);
    this.read = new TransactionTemplate(transactions);
    this.read.setReadOnly(true);
    this.read.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    this.read.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    this.read.setTimeout(3);
  }

  @Override
  public Revision revision(UUID userId) {
    return read.execute(status -> metadata(userId).revision());
  }

  @Override
  public PreferenceSnapshot load(UUID userId, String purpose) {
    PreferenceSnapshot.requirePurpose(purpose);
    return read.execute(
        status -> {
          Metadata metadata = metadata(userId);
          if (!metadata.revision().completed())
            return new PreferenceSnapshot(metadata.revision(), purpose, List.of());
          List<PreferenceSignal> signals =
              ContextDiagnostics.measure(
                  "context_signals_query",
                  () ->
                      jdbc.query(
                          """
          SELECT dimension_code, value_code, confidence, source, updated_at
          FROM preference_signals WHERE user_id = ?
          ORDER BY dimension_code, value_code, source
          """,
                          (rs, row) ->
                              new PreferenceSignal(
                                  rs.getString(1),
                                  rs.getString(2),
                                  rs.getBigDecimal(3).doubleValue(),
                                  rs.getString(4),
                                  rs.getTimestamp(5).toInstant()),
                          userId));
          return new PreferenceSnapshot(
              metadata.revision(),
              purpose,
              signals.stream()
                  .filter(
                      signal ->
                          ("EXPLORE_RECOMMENDATION".equals(purpose)
                                  && "EXPLORE_AFFINITY".equals(signal.dimensionCode()))
                              || metadata.standard().contains(signal.dimensionCode()))
                  .toList());
        });
  }

  private Metadata metadata(UUID userId) {
    List<Revision> profiles =
        ContextDiagnostics.measure(
            "context_profile_query",
            () ->
                jdbc.query(
                    """
        SELECT id, version, status, schema_version FROM onboarding_profiles WHERE user_id = ?
        """,
                    (rs, row) ->
                        new Revision(
                            rs.getObject(1, UUID.class),
                            rs.getLong(2),
                            rs.getString(3),
                            rs.getInt(4),
                            ""),
                    userId));
    if (profiles.isEmpty() || !profiles.getFirst().completed())
      return new Metadata(profiles.isEmpty() ? Revision.absent() : profiles.getFirst(), Set.of());
    // Include inactive/sensitivity/schema changes in the key; never serve an old STANDARD
    // projection.
    List<CatalogRow> catalog =
        ContextDiagnostics.measure(
            "context_catalog_query",
            () ->
                jdbc.query(
                    """
        SELECT code, cardinality, sensitivity_class, schema_version, active
        FROM preference_dimensions ORDER BY code LIMIT 201
        """,
                    (rs, row) ->
                        new CatalogRow(
                            rs.getString(1),
                            rs.getString(2),
                            rs.getString(3),
                            rs.getInt(4),
                            rs.getBoolean(5))));
    if (catalog.size() > 200)
      throw new IllegalStateException("Preference catalog exceeds supported size");
    String material =
        catalog.stream()
            .map(
                row ->
                    row.code()
                        + ":"
                        + row.cardinality()
                        + ":"
                        + row.sensitivity()
                        + ":"
                        + row.schema()
                        + ":"
                        + row.active())
            .collect(java.util.stream.Collectors.joining("|"));
    Set<String> standard = new HashSet<>();
    catalog.stream()
        .filter(row -> row.active() && "STANDARD".equals(row.sensitivity()))
        .forEach(row -> standard.add(row.code()));
    Revision profile = profiles.getFirst();
    return new Metadata(
        new Revision(
            profile.profileId(),
            profile.version(),
            profile.status(),
            profile.schemaVersion(),
            digest(material)),
        Set.copyOf(standard));
  }

  private static String digest(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private record CatalogRow(
      String code, String cardinality, String sensitivity, int schema, boolean active) {}

  private record Metadata(Revision revision, Set<String> standard) {}
}
