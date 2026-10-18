package fu.tripsense.tripservice.hotel;

import static fu.tripsense.tripservice.hotel.HotelFinanceDtos.*;

import fu.tripsense.tripservice.exception.TripServiceException;
import fu.tripsense.tripservice.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class HotelFinanceService {

  private final JdbcTemplate db;
  private final TransactionTemplate tx;

  public HotelFinanceService(JdbcTemplate db, TransactionTemplate tx) {
    this.db = db;
    this.tx = tx;
  }

  private TripServiceException error(String code, HttpStatus status) {
    return HotelService.error(code, status);
  }

  private void checkPartnerAccess(AuthenticatedUser u, UUID businessId) {
    if (u == null) throw error("UNAUTHORIZED", HttpStatus.UNAUTHORIZED);
    if (u.isAdmin()) return;
    Integer count = db.queryForObject(
        "SELECT count(*) FROM partner_business_member WHERE business_id=? AND user_id=? AND state='ACTIVE' AND role IN ('OWNER','MANAGER')",
        Integer.class, businessId, u.id());
    if (count == null || count == 0) {
      throw error("HOTEL_FORBIDDEN", HttpStatus.FORBIDDEN);
    }
  }

  public Map<String, Object> ensureWallet(UUID businessId) {
    var rows = db.queryForList("SELECT * FROM partner_wallet WHERE business_id=?", businessId);
    if (!rows.isEmpty()) return rows.getFirst();
    UUID wid = UUID.randomUUID();
    db.update("""
        INSERT INTO partner_wallet(id, business_id, currency, available_balance, locked_balance, total_withdrawn, total_earned)
        VALUES (?, ?, 'VND', 0.00, 0.00, 0.00, 0.00)
        ON CONFLICT(business_id) DO NOTHING
        """, wid, businessId);
    return db.queryForList("SELECT * FROM partner_wallet WHERE business_id=?", businessId).getFirst();
  }

  public Map<String, Object> getPartnerSummary(AuthenticatedUser u, UUID businessId) {
    checkPartnerAccess(u, businessId);
    var wallet = ensureWallet(businessId);
    var accountRows = db.queryForList("SELECT * FROM partner_payout_account WHERE business_id=?", businessId);
    var payoutAccount = accountRows.isEmpty() ? null : accountRows.getFirst();

    // Calculate pending escrow balance (bookings that are PAID, status IN ('CONFIRMED', 'CHECKED_IN'))
    BigDecimal pendingEscrowGross = db.queryForObject("""
        SELECT COALESCE(SUM(b.total), 0.00)
        FROM hotel_booking b
        JOIN hotel_payos_payment p ON p.booking_id = b.id
        WHERE b.business_id = ? AND p.state = 'PAID' AND b.status IN ('CONFIRMED', 'CHECKED_IN')
        """, BigDecimal.class, businessId);
    if (pendingEscrowGross == null) pendingEscrowGross = BigDecimal.ZERO;

    BigDecimal pendingEscrowNet = pendingEscrowGross.multiply(new BigDecimal("0.90")).setScale(0, RoundingMode.HALF_UP);

    Integer completedBookings = db.queryForObject("""
        SELECT count(*) FROM hotel_booking WHERE business_id = ? AND status = 'CHECKED_OUT'
        """, Integer.class, businessId);

    Map<String, Object> res = new HashMap<>(wallet);
    res.put("payout_account", payoutAccount);
    res.put("pending_escrow_net", pendingEscrowNet);
    res.put("pending_escrow_gross", pendingEscrowGross);
    res.put("completed_bookings_count", completedBookings != null ? completedBookings : 0);
    return res;
  }

  public Map<String, Object> getPayoutAccount(AuthenticatedUser u, UUID businessId) {
    checkPartnerAccess(u, businessId);
    var rows = db.queryForList("SELECT * FROM partner_payout_account WHERE business_id=?", businessId);
    return rows.isEmpty() ? Map.of("configured", false) : rows.getFirst();
  }

  public Map<String, Object> updatePayoutAccount(AuthenticatedUser u, UUID businessId, PayoutAccountInput in) {
    checkPartnerAccess(u, businessId);
    db.update("""
        INSERT INTO partner_payout_account(id, business_id, bank_code, bank_name, account_number, account_holder_name, branch_name, is_verified, updated_at)
        VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?, true, clock_timestamp())
        ON CONFLICT (business_id) DO UPDATE SET
          bank_code = EXCLUDED.bank_code,
          bank_name = EXCLUDED.bank_name,
          account_number = EXCLUDED.account_number,
          account_holder_name = EXCLUDED.account_holder_name,
          branch_name = EXCLUDED.branch_name,
          updated_at = clock_timestamp()
        """, businessId, in.bankCode().trim().toUpperCase(), in.bankName().trim(), in.accountNumber().trim(),
        in.accountHolderName().trim().toUpperCase(), in.branchName() != null ? in.branchName().trim() : null);
    return db.queryForList("SELECT * FROM partner_payout_account WHERE business_id=?", businessId).getFirst();
  }

  public Map<String, Object> requestWithdrawal(AuthenticatedUser u, UUID businessId, BigDecimal amount) {
    checkPartnerAccess(u, businessId);
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
      throw error("INVALID_WITHDRAWAL_AMOUNT", HttpStatus.BAD_REQUEST);
    }

    return tx.execute(status -> {
      var accountRows = db.queryForList("SELECT * FROM partner_payout_account WHERE business_id=?", businessId);
      if (accountRows.isEmpty()) {
        throw error("PAYOUT_ACCOUNT_REQUIRED", HttpStatus.BAD_REQUEST);
      }
      var account = accountRows.getFirst();

      ensureWallet(businessId);
      var wallet = db.queryForList("SELECT * FROM partner_wallet WHERE business_id=? FOR UPDATE", businessId).getFirst();
      BigDecimal available = (BigDecimal) wallet.get("available_balance");
      UUID walletId = (UUID) wallet.get("id");

      if (available.compareTo(amount) < 0) {
        throw error("INSUFFICIENT_BALANCE", HttpStatus.CONFLICT);
      }

      // Check max pending requests
      Integer pendingCount = db.queryForObject(
          "SELECT count(*) FROM partner_withdrawal_request WHERE business_id=? AND status IN ('PENDING_REVIEW', 'PROCESSING')",
          Integer.class, businessId);
      if (pendingCount != null && pendingCount >= 3) {
        throw error("MAX_PENDING_WITHDRAWALS_REACHED", HttpStatus.CONFLICT);
      }

      // Deduct available, add to locked
      BigDecimal newAvailable = available.subtract(amount);
      BigDecimal currentLocked = (BigDecimal) wallet.get("locked_balance");
      BigDecimal newLocked = currentLocked.add(amount);

      db.update("""
          UPDATE partner_wallet
          SET available_balance = ?, locked_balance = ?, version = version + 1, updated_at = clock_timestamp()
          WHERE id = ?
          """, newAvailable, newLocked, walletId);

      UUID reqId = UUID.randomUUID();
      db.update("""
          INSERT INTO partner_withdrawal_request(
            id, business_id, wallet_id, amount, currency, status,
            bank_code, bank_name, account_number, account_holder_name, created_by
          ) VALUES (?, ?, ?, ?, 'VND', 'PENDING_REVIEW', ?, ?, ?, ?, ?)
          """, reqId, businessId, walletId, amount,
          account.get("bank_code"), account.get("bank_name"), account.get("account_number"),
          account.get("account_holder_name"), u.id());

      // Log financial ledger
      db.update("""
          INSERT INTO financial_ledger_entry(
            id, wallet_id, business_id, entry_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES (?, ?, ?, 'WITHDRAWAL_HOLD', ?, ?, 'WITHDRAWAL_REQUEST', ?, ?)
          """, UUID.randomUUID(), walletId, businessId, amount.negate(), newAvailable, reqId,
          "Khóa tiền chờ duyệt rút về " + account.get("bank_code") + " " + account.get("account_number"));

      return db.queryForList("SELECT * FROM partner_withdrawal_request WHERE id=?", reqId).getFirst();
    });
  }

  public List<Map<String, Object>> getPartnerWithdrawals(AuthenticatedUser u, UUID businessId) {
    checkPartnerAccess(u, businessId);
    return db.queryForList("""
        SELECT * FROM partner_withdrawal_request
        WHERE business_id = ?
        ORDER BY created_at DESC LIMIT 50
        """, businessId);
  }

  public List<Map<String, Object>> getPartnerLedger(AuthenticatedUser u, UUID businessId) {
    checkPartnerAccess(u, businessId);
    return db.queryForList("""
        SELECT * FROM financial_ledger_entry
        WHERE business_id = ?
        ORDER BY created_at DESC LIMIT 100
        """, businessId);
  }

  /** Settle booking revenue upon check-out: 10% platform, 90% partner wallet */
  public void settleBooking(UUID bookingId) {
    tx.execute(status -> {
      var bList = db.queryForList("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", bookingId);
      if (bList.isEmpty()) return null;
      var b = bList.getFirst();

      String bookingStatus = (String) b.get("status");
      if (!"CHECKED_OUT".equals(bookingStatus)) return null;

      // Check if already settled
      Integer settledCount = db.queryForObject(
          "SELECT count(*) FROM financial_ledger_entry WHERE reference_id=? AND entry_type='BOOKING_SETTLEMENT'",
          Integer.class, bookingId);
      if (settledCount != null && settledCount > 0) return null;

      // Check payment state
      var payList = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=?", bookingId);
      if (payList.isEmpty() || !"PAID".equals(payList.getFirst().get("state"))) {
        return null;
      }

      UUID businessId = (UUID) b.get("business_id");
      if (businessId == null) {
        businessId = db.queryForObject("SELECT business_id FROM hotel_property WHERE id=?", UUID.class, b.get("property_id"));
      }
      if (businessId == null) return null;

      BigDecimal total = (BigDecimal) b.get("total");
      BigDecimal commission = total.multiply(new BigDecimal("0.10")).setScale(0, RoundingMode.HALF_UP);
      BigDecimal partnerAmount = total.subtract(commission);

      ensureWallet(businessId);
      var wallet = db.queryForList("SELECT * FROM partner_wallet WHERE business_id=? FOR UPDATE", businessId).getFirst();
      UUID walletId = (UUID) wallet.get("id");
      BigDecimal currentAvailable = (BigDecimal) wallet.get("available_balance");
      BigDecimal currentEarned = (BigDecimal) wallet.get("total_earned");
      BigDecimal newAvailable = currentAvailable.add(partnerAmount);
      BigDecimal newEarned = currentEarned.add(partnerAmount);

      db.update("""
          UPDATE partner_wallet
          SET available_balance = ?, total_earned = ?, version = version + 1, updated_at = clock_timestamp()
          WHERE id = ?
          """, newAvailable, newEarned, walletId);

      db.update("""
          INSERT INTO financial_ledger_entry(
            id, wallet_id, business_id, entry_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES (?, ?, ?, 'BOOKING_SETTLEMENT', ?, ?, 'HOTEL_BOOKING', ?, ?)
          """, UUID.randomUUID(), walletId, businessId, partnerAmount, newAvailable, bookingId,
          "Doanh thu phòng #" + b.get("id").toString().substring(0, 8) + " (90% sau trừ 10% phí sàn)");

      return null;
    });
  }

  /** Cancel booking by customer and register refund request if eligible */
  public Map<String, Object> cancelAndRefund(AuthenticatedUser u, UUID bookingId, RefundInput in) {
    if (u == null) throw error("UNAUTHORIZED", HttpStatus.UNAUTHORIZED);

    return tx.execute(status -> {
      var bList = db.queryForList("SELECT * FROM hotel_booking WHERE id=? FOR UPDATE", bookingId);
      if (bList.isEmpty()) throw error("HOTEL_NOT_FOUND", HttpStatus.NOT_FOUND);
      var b = bList.getFirst();

      if (!u.id().equals(b.get("customer_id"))) {
        throw error("HOTEL_NOT_FOUND", HttpStatus.NOT_FOUND);
      }

      String bookingStatus = (String) b.get("status");
      if (!Set.of("HELD", "CONFIRMED").contains(bookingStatus)) {
        throw error("HOTEL_INVALID_STATE", HttpStatus.CONFLICT);
      }

      // Check free cancellation deadline if confirmed
      if ("CONFIRMED".equals(bookingStatus)) {
        Object fcu = b.get("free_cancellation_until");
        if (fcu instanceof Timestamp ts && Instant.now().isAfter(ts.toInstant())) {
          throw error("HOTEL_CANCELLATION_CLOSED", HttpStatus.CONFLICT);
        }
      }

      // Release inventory
      int q = ((Number) b.get("quantity")).intValue();
      boolean wasHeld = "HELD".equals(bookingStatus);
      db.update("""
          UPDATE hotel_inventory 
          SET held = CASE WHEN ? THEN GREATEST(0, held - ?) ELSE held END,
              booked = CASE WHEN ? THEN GREATEST(0, booked - ?) ELSE booked END
          WHERE room_type_id = ? AND stay_date >= ? AND stay_date < ?
          """, wasHeld, q, !wasHeld, q, b.get("room_type_id"), b.get("check_in"), b.get("check_out"));

      db.update("UPDATE hotel_booking SET status='CANCELLED', cancelled_by='CUSTOMER', cancellation_reason=?, version=version+1 WHERE id=?",
          in.reason() != null ? in.reason() : "Khách yêu cầu hủy phòng", bookingId);

      // Check if PayOS paid
      var payList = db.queryForList("SELECT * FROM hotel_payos_payment WHERE booking_id=?", bookingId);
      if (!payList.isEmpty() && "PAID".equals(payList.getFirst().get("state"))) {
        db.update("UPDATE hotel_payos_payment SET resolution='REFUND_REQUIRED' WHERE booking_id=?", bookingId);

        BigDecimal refundAmount = (BigDecimal) b.get("total");
        UUID refId = UUID.randomUUID();
        db.update("""
            INSERT INTO customer_refund_request(
              id, booking_id, customer_id, amount, currency, reason, status,
              bank_code, bank_name, account_number, account_holder_name
            ) VALUES (?, ?, ?, ?, 'VND', ?, 'PENDING_REVIEW', ?, ?, ?, ?)
            ON CONFLICT (booking_id) DO UPDATE SET
              bank_code = EXCLUDED.bank_code,
              bank_name = EXCLUDED.bank_name,
              account_number = EXCLUDED.account_number,
              account_holder_name = EXCLUDED.account_holder_name,
              updated_at = clock_timestamp()
            """, refId, bookingId, u.id(), refundAmount, in.reason(),
            in.bankCode().trim().toUpperCase(), in.bankName().trim(), in.accountNumber().trim(),
            in.accountHolderName().trim().toUpperCase());
      }

      return db.queryForList("SELECT * FROM hotel_booking WHERE id=?", bookingId).getFirst();
    });
  }

  // ================= ADMIN FINANCE OPERATIONS ================= //

  public Map<String, Object> getAdminOverview(AuthenticatedUser u) {
    HotelService.admin(u);

    BigDecimal totalGmv = db.queryForObject(
        "SELECT COALESCE(SUM(amount), 0.00) FROM hotel_payos_payment WHERE state='PAID'", BigDecimal.class);

    BigDecimal escrowHolding = db.queryForObject("""
        SELECT COALESCE(SUM(b.total), 0.00)
        FROM hotel_booking b
        JOIN hotel_payos_payment p ON p.booking_id = b.id
        WHERE p.state = 'PAID' AND b.status IN ('CONFIRMED', 'CHECKED_IN')
        """, BigDecimal.class);

    BigDecimal completedGmv = db.queryForObject("""
        SELECT COALESCE(SUM(b.total), 0.00)
        FROM hotel_booking b
        JOIN hotel_payos_payment p ON p.booking_id = b.id
        WHERE p.state = 'PAID' AND b.status = 'CHECKED_OUT'
        """, BigDecimal.class);
    if (completedGmv == null) completedGmv = BigDecimal.ZERO;

    BigDecimal platformRevenue = completedGmv.multiply(new BigDecimal("0.10")).setScale(0, RoundingMode.HALF_UP);

    BigDecimal partnerPayable = db.queryForObject(
        "SELECT COALESCE(SUM(available_balance), 0.00) FROM partner_wallet", BigDecimal.class);

    BigDecimal pendingRefundAmount = db.queryForObject(
        "SELECT COALESCE(SUM(amount), 0.00) FROM customer_refund_request WHERE status='PENDING_REVIEW'", BigDecimal.class);

    BigDecimal pendingWithdrawalAmount = db.queryForObject(
        "SELECT COALESCE(SUM(amount), 0.00) FROM partner_withdrawal_request WHERE status='PENDING_REVIEW'", BigDecimal.class);

    Integer pendingRefundCount = db.queryForObject(
        "SELECT count(*) FROM customer_refund_request WHERE status='PENDING_REVIEW'", Integer.class);

    Integer pendingWithdrawalCount = db.queryForObject(
        "SELECT count(*) FROM partner_withdrawal_request WHERE status='PENDING_REVIEW'", Integer.class);

    return Map.of(
        "totalGmv", totalGmv != null ? totalGmv : BigDecimal.ZERO,
        "escrowHolding", escrowHolding != null ? escrowHolding : BigDecimal.ZERO,
        "platformRevenue", platformRevenue,
        "partnerPayable", partnerPayable != null ? partnerPayable : BigDecimal.ZERO,
        "pendingRefundAmount", pendingRefundAmount != null ? pendingRefundAmount : BigDecimal.ZERO,
        "pendingWithdrawalAmount", pendingWithdrawalAmount != null ? pendingWithdrawalAmount : BigDecimal.ZERO,
        "pendingRefundCount", pendingRefundCount != null ? pendingRefundCount : 0,
        "pendingWithdrawalCount", pendingWithdrawalCount != null ? pendingWithdrawalCount : 0);
  }

  public List<Map<String, Object>> getAdminWithdrawals(AuthenticatedUser u, String status) {
    HotelService.admin(u);
    String sql = """
        SELECT w.*, b.display_name AS business_name
        FROM partner_withdrawal_request w
        JOIN partner_business b ON b.id = w.business_id
        """;
    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      sql += " WHERE w.status = ? ORDER BY w.created_at DESC LIMIT 100";
      return db.queryForList(sql, status.toUpperCase());
    }
    sql += " ORDER BY w.created_at DESC LIMIT 100";
    return db.queryForList(sql);
  }

  public Map<String, Object> completeAdminWithdrawal(AuthenticatedUser u, UUID id, PayoutCompletionInput in) {
    HotelService.admin(u);
    return tx.execute(status -> {
      var rows = db.queryForList("SELECT * FROM partner_withdrawal_request WHERE id=? FOR UPDATE", id);
      if (rows.isEmpty()) throw error("WITHDRAWAL_NOT_FOUND", HttpStatus.NOT_FOUND);
      var w = rows.getFirst();

      String currentStatus = (String) w.get("status");
      if (!Set.of("PENDING_REVIEW", "PROCESSING").contains(currentStatus)) {
        throw error("INVALID_WITHDRAWAL_STATUS", HttpStatus.CONFLICT);
      }

      UUID walletId = (UUID) w.get("wallet_id");
      UUID businessId = (UUID) w.get("business_id");
      BigDecimal amount = (BigDecimal) w.get("amount");

      // Release from locked balance to withdrawn
      var wallet = db.queryForList("SELECT * FROM partner_wallet WHERE id=? FOR UPDATE", walletId).getFirst();
      BigDecimal locked = (BigDecimal) wallet.get("locked_balance");
      BigDecimal withdrawn = (BigDecimal) wallet.get("total_withdrawn");
      BigDecimal newLocked = locked.subtract(amount);
      if (newLocked.compareTo(BigDecimal.ZERO) < 0) newLocked = BigDecimal.ZERO;
      BigDecimal newWithdrawn = withdrawn.add(amount);

      db.update("""
          UPDATE partner_wallet
          SET locked_balance = ?, total_withdrawn = ?, version = version + 1, updated_at = clock_timestamp()
          WHERE id = ?
          """, newLocked, newWithdrawn, walletId);

      String refCode = (in != null && in.bankReferenceCode() != null && !in.bankReferenceCode().isBlank())
          ? in.bankReferenceCode() : "MANUAL_QR_" + System.currentTimeMillis();

      db.update("""
          UPDATE partner_withdrawal_request
          SET status = 'COMPLETED', bank_reference_code = ?, proof_image_url = ?, admin_notes = ?,
              reviewed_by = ?, reviewed_at = clock_timestamp(), updated_at = clock_timestamp()
          WHERE id = ?
          """, refCode, in != null ? in.proofImageUrl() : null, in != null ? in.adminNotes() : null, u.id(), id);

      db.update("""
          INSERT INTO financial_ledger_entry(
            id, wallet_id, business_id, entry_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES (?, ?, ?, 'WITHDRAWAL_PAYOUT', ?, ?, 'WITHDRAWAL_REQUEST', ?, ?)
          """, UUID.randomUUID(), walletId, businessId, amount.negate(), wallet.get("available_balance"), id,
          "Chuyển khoản thành công về " + w.get("bank_code") + " (Mã GD: " + refCode + ")");

      return db.queryForList("SELECT * FROM partner_withdrawal_request WHERE id=?", id).getFirst();
    });
  }

  public Map<String, Object> rejectAdminWithdrawal(AuthenticatedUser u, UUID id, String reason) {
    HotelService.admin(u);
    return tx.execute(status -> {
      var rows = db.queryForList("SELECT * FROM partner_withdrawal_request WHERE id=? FOR UPDATE", id);
      if (rows.isEmpty()) throw error("WITHDRAWAL_NOT_FOUND", HttpStatus.NOT_FOUND);
      var w = rows.getFirst();

      String currentStatus = (String) w.get("status");
      if (!Set.of("PENDING_REVIEW", "PROCESSING").contains(currentStatus)) {
        throw error("INVALID_WITHDRAWAL_STATUS", HttpStatus.CONFLICT);
      }

      UUID walletId = (UUID) w.get("wallet_id");
      UUID businessId = (UUID) w.get("business_id");
      BigDecimal amount = (BigDecimal) w.get("amount");

      // Unlock back to available balance
      var wallet = db.queryForList("SELECT * FROM partner_wallet WHERE id=? FOR UPDATE", walletId).getFirst();
      BigDecimal available = (BigDecimal) wallet.get("available_balance");
      BigDecimal locked = (BigDecimal) wallet.get("locked_balance");
      BigDecimal newAvailable = available.add(amount);
      BigDecimal newLocked = locked.subtract(amount);
      if (newLocked.compareTo(BigDecimal.ZERO) < 0) newLocked = BigDecimal.ZERO;

      db.update("""
          UPDATE partner_wallet
          SET available_balance = ?, locked_balance = ?, version = version + 1, updated_at = clock_timestamp()
          WHERE id = ?
          """, newAvailable, newLocked, walletId);

      db.update("""
          UPDATE partner_withdrawal_request
          SET status = 'REJECTED', admin_notes = ?, reviewed_by = ?, reviewed_at = clock_timestamp(), updated_at = clock_timestamp()
          WHERE id = ?
          """, reason != null ? reason : "Từ chối bởi Admin", u.id(), id);

      db.update("""
          INSERT INTO financial_ledger_entry(
            id, wallet_id, business_id, entry_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES (?, ?, ?, 'WITHDRAWAL_REFUND', ?, ?, 'WITHDRAWAL_REQUEST', ?, ?)
          """, UUID.randomUUID(), walletId, businessId, amount, newAvailable, id,
          "Hoàn trả số dư do lệnh rút bị từ chối: " + reason);

      return db.queryForList("SELECT * FROM partner_withdrawal_request WHERE id=?", id).getFirst();
    });
  }

  public List<Map<String, Object>> getAdminRefunds(AuthenticatedUser u, String status) {
    HotelService.admin(u);
    String sql = """
        SELECT r.*, b.property_name, b.room_name, b.customer_email
        FROM customer_refund_request r
        JOIN hotel_booking b ON b.id = r.booking_id
        """;
    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      sql += " WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 100";
      return db.queryForList(sql, status.toUpperCase());
    }
    sql += " ORDER BY r.created_at DESC LIMIT 100";
    return db.queryForList(sql);
  }

  public Map<String, Object> completeAdminRefund(AuthenticatedUser u, UUID id, PayoutCompletionInput in) {
    HotelService.admin(u);
    return tx.execute(status -> {
      var rows = db.queryForList("SELECT * FROM customer_refund_request WHERE id=? FOR UPDATE", id);
      if (rows.isEmpty()) throw error("REFUND_NOT_FOUND", HttpStatus.NOT_FOUND);
      var r = rows.getFirst();

      String currentStatus = (String) r.get("status");
      if ("REFUNDED".equals(currentStatus)) return r;

      UUID bookingId = (UUID) r.get("booking_id");
      BigDecimal amount = (BigDecimal) r.get("amount");

      String refCode = (in != null && in.bankReferenceCode() != null && !in.bankReferenceCode().isBlank())
          ? in.bankReferenceCode() : "REFUND_QR_" + System.currentTimeMillis();

      db.update("""
          UPDATE customer_refund_request
          SET status = 'REFUNDED', bank_reference_code = ?, proof_image_url = ?, admin_notes = ?,
              processed_by = ?, processed_at = clock_timestamp(), updated_at = clock_timestamp()
          WHERE id = ?
          """, refCode, in != null ? in.proofImageUrl() : null, in != null ? in.adminNotes() : null, u.id(), id);

      db.update("UPDATE hotel_payos_payment SET resolution='NONE' WHERE booking_id=?", bookingId);

      db.update("""
          INSERT INTO financial_ledger_entry(
            id, wallet_id, business_id, entry_type, amount, balance_after,
            reference_type, reference_id, description
          ) VALUES (?, NULL, NULL, 'CUSTOMER_REFUND', ?, 0.00, 'CUSTOMER_REFUND', ?, ?)
          """, UUID.randomUUID(), amount.negate(), id,
          "Hoàn trả tiền cọc cho khách qua " + r.get("bank_code") + " (Mã GD: " + refCode + ")");

      return db.queryForList("SELECT * FROM customer_refund_request WHERE id=?", id).getFirst();
    });
  }

  public List<Map<String, Object>> getAdminLedger(AuthenticatedUser u) {
    HotelService.admin(u);
    return db.queryForList("""
        SELECT l.*, b.display_name AS business_name
        FROM financial_ledger_entry l
        LEFT JOIN partner_business b ON b.id = l.business_id
        ORDER BY l.created_at DESC LIMIT 200
        """);
  }
}
