package fu.tripsense.tripservice.partner.service;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.partner.dto.AdminFinanceDtos.SubscriptionOrderItemDto;
import fu.tripsense.tripservice.partner.dto.AdminFinanceDtos.SubscriptionOrderPageDto;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminSubscriptionOrderService {

  private static final Set<String> ALLOWED_STATUSES =
      Set.of("PAID", "PENDING", "CANCELLED", "FAILED");
  private static final Set<String> ALLOWED_KINDS =
      Set.of("HOTEL", "RESTAURANT", "TOUR_GUIDE", "RENTAL_SERVICE");

  private final JdbcTemplate jdbc;

  @Transactional(readOnly = true)
  public SubscriptionOrderPageDto listSubscriptionOrders(
      AuthenticatedUser admin,
      String status,
      String businessKind,
      int requestedPage,
      int requestedSize) {
    requireAdmin(admin);

    String normalizedStatus = normalizeFilter(status, ALLOWED_STATUSES, "INVALID_PAYMENT_STATUS");
    String normalizedKind = normalizeFilter(businessKind, ALLOWED_KINDS, "INVALID_BUSINESS_KIND");

    int page = Math.max(0, requestedPage);
    int size = Math.min(100, Math.max(1, requestedSize));
    int offset = page * size;

    StringBuilder where = new StringBuilder(" WHERE 1=1");
    List<Object> params = new ArrayList<>();

    if (normalizedStatus != null) {
      where.append(" AND o.payment_status = ?");
      params.add(normalizedStatus);
    }
    if (normalizedKind != null) {
      where.append(" AND b.kind = ?");
      params.add(normalizedKind);
    }

    String countSql =
        "SELECT COUNT(*) FROM partner_subscription_order o "
            + "JOIN partner_business b ON b.id = o.business_id"
            + where;
    Long totalObj = jdbc.queryForObject(countSql, Long.class, params.toArray());
    long totalElements = totalObj != null ? totalObj : 0L;

    List<Object> dataParams = new ArrayList<>(params);
    dataParams.add(size);
    dataParams.add(offset);

    String dataSql =
        """
        SELECT o.id,
               o.order_code,
               o.business_id,
               b.display_name AS business_name,
               b.kind AS business_kind,
               o.plan_id,
               p.name AS plan_name,
               p.duration_days,
               o.amount,
               o.payment_status,
               o.paid_at,
               o.created_at
        FROM partner_subscription_order o
        JOIN partner_business b ON b.id = o.business_id
        JOIN partner_subscription_plan p ON p.plan_id = o.plan_id
        """
            + where
            + " ORDER BY o.created_at DESC LIMIT ? OFFSET ?";

    List<SubscriptionOrderItemDto> items =
        jdbc.query(
            dataSql,
            (rs, rowNum) ->
                new SubscriptionOrderItemDto(
                    rs.getObject("id", UUID.class),
                    rs.getLong("order_code"),
                    rs.getObject("business_id", UUID.class),
                    rs.getString("business_name"),
                    rs.getString("business_kind"),
                    rs.getString("plan_id"),
                    rs.getString("plan_name"),
                    rs.getInt("duration_days"),
                    rs.getBigDecimal("amount"),
                    rs.getString("payment_status"),
                    toInstant(rs.getTimestamp("paid_at")),
                    toInstant(rs.getTimestamp("created_at"))),
            dataParams.toArray());

    int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
    return new SubscriptionOrderPageDto(items, page, size, totalElements, totalPages);
  }

  private void requireAdmin(AuthenticatedUser user) {
    if (user == null) {
      throw new TripServiceException(
          "UNAUTHORIZED", "Authentication is required", HttpStatus.UNAUTHORIZED);
    }
    if (!user.isAdmin()) {
      throw new TripServiceException(
          "FORBIDDEN", "Admin privileges are required", HttpStatus.FORBIDDEN);
    }
  }

  private String normalizeFilter(String raw, Set<String> allowed, String errorCode) {
    if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw.trim())) {
      return null;
    }
    String normalized = raw.trim().toUpperCase(Locale.ROOT);
    if (!allowed.contains(normalized)) {
      throw new TripServiceException(
          errorCode, "Unsupported filter value: " + normalized, HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private Instant toInstant(Timestamp ts) {
    return ts != null ? ts.toInstant() : null;
  }
}

