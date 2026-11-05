package fu.tripsense.socialservice.chat;

import fu.tripsense.socialservice.chat.ChatDtos.*;
import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.security.CurrentUserProvider;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ChatService {
  private final JdbcTemplate db;
  private final CurrentUserProvider current;
  private final UserPublicProfileClient profiles;
  private final ChatRealtime realtime;
  private final ChatPushNotificationService pushNotificationService;

  public ChatService(
      JdbcTemplate db,
      CurrentUserProvider current,
      UserPublicProfileClient profiles,
      ChatRealtime realtime,
      ChatPushNotificationService pushNotificationService) {
    this.db = db;
    this.current = current;
    this.profiles = profiles;
    this.realtime = realtime;
    this.pushNotificationService = pushNotificationService;
  }

  private UUID me() {
    UUID user = current.requiredUser().id();
    profiles.requireEnabled(user, token());
    return user;
  }

  public UUID actorId() {
    return me();
  }

  private String token() {
    return current.bearerToken();
  }

  private static SocialException error(HttpStatus status, String code, String message) {
    return new SocialException(status, code, message);
  }

  private static UUID uuid(ResultSet r, String col) throws SQLException {
    return r.getObject(col, UUID.class);
  }

  private static Instant time(ResultSet r, String col) throws SQLException {
    var value = r.getTimestamp(col);
    return value == null ? null : value.toInstant();
  }

  private static long seq(String raw) {
    try {
      long n = Long.parseLong(raw);
      if (n < 0) throw new NumberFormatException();
      return n;
    } catch (Exception e) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor");
    }
  }

  private static int limit(int value) {
    if (value < 1 || value > 50)
      throw error(HttpStatus.BAD_REQUEST, "INVALID_LIMIT", "Invalid limit");
    return value;
  }

  record Thread(
      UUID id,
      UUID low,
      UUID high,
      UUID initiator,
      String state,
      Long lastSeq,
      Instant declinedAt,
      Instant updatedAt) {
    UUID peer(UUID user) {
      return user.equals(low) ? high : low;
    }
  }

  private Thread thread(ResultSet r, int ignored) throws SQLException {
    Long last = r.getObject("last_message_seq", Long.class);
    return new Thread(
        uuid(r, "id"),
        uuid(r, "user_low_id"),
        uuid(r, "user_high_id"),
        uuid(r, "initiated_by"),
        r.getString("state"),
        last,
        time(r, "declined_at"),
        time(r, "updated_at"));
  }

  private Thread requireThread(UUID id, UUID user, boolean lock) {
    List<Thread> rows =
        db.query(
            "SELECT * FROM chat_conversations WHERE id=? AND (user_low_id=? OR user_high_id=?)"
                + (lock ? " FOR UPDATE" : ""),
            this::thread,
            id,
            user,
            user);
    if (rows.isEmpty())
      throw error(HttpStatus.NOT_FOUND, "CHAT_NOT_FOUND", "Conversation not found");
    return rows.getFirst();
  }

  private static boolean isLower(UUID a, UUID b) {
    return a.toString().compareTo(b.toString()) < 0;
  }

  private void pairLock(UUID a, UUID b) {
    String key = isLower(a, b) ? a + ":" + b : b + ":" + a;
    db.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> {}, key);
  }

  private boolean blocked(UUID a, UUID b) {
    Integer count =
        db.queryForObject(
            "SELECT count(*) FROM chat_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)",
            Integer.class,
            a,
            b,
            b,
            a);
    return count != null && count > 0;
  }

  private void assertAllowed(UUID a, UUID b) {
    if (blocked(a, b)) throw error(HttpStatus.FORBIDDEN, "CHAT_BLOCKED", "Chat unavailable");
    Integer restricted =
        db.queryForObject(
            "SELECT count(*) FROM chat_restrictions WHERE user_id IN (?,?) AND expires_at > now()",
            Integer.class,
            a,
            b);
    if (restricted != null && restricted > 0)
      throw error(HttpStatus.FORBIDDEN, "CHAT_RESTRICTED", "Chat unavailable");
  }

  private void changed(Thread thread, String eventType) {
    Long version =
        db.queryForObject(
            "SELECT version FROM chat_conversations WHERE id=?", Long.class, thread.id);
    realtime.afterCommit(thread.low, thread.id, eventType, version);
    realtime.afterCommit(thread.high, thread.id, eventType, version);
  }

  private String direction(Thread t, UUID user) {
    return !"PENDING".equals(t.state) ? "NONE" : t.initiator.equals(user) ? "OUTGOING" : "INCOMING";
  }

  private Message mapMessage(ResultSet r, int ignored) throws SQLException {
    UUID shared = uuid(r, "shared_post_id");
    TripCard card = shared == null ? null : tripCard(shared);
    UUID conversation = uuid(r, "conversation_id");
    UUID sender = uuid(r, "sender_id");
    long messageSeq = r.getLong("seq");
    List<long[]> receipt =
        db.query(
            "SELECT last_delivered_seq,last_read_seq FROM chat_participants WHERE conversation_id=? AND user_id<>?",
            (row, n) -> new long[] {row.getLong(1), row.getLong(2)},
            conversation,
            sender);
    UUID offerId = uuid(r, "offer_id");
    ReservationOffer offer = offerId == null ? null : reservationOffer(offerId);
    String status = "sent";
    if (!receipt.isEmpty())
      status =
          receipt.getFirst()[1] >= messageSeq
              ? "read"
              : receipt.getFirst()[0] >= messageSeq ? "delivered" : "sent";
    return new Message(
        uuid(r, "id"),
        uuid(r, "client_message_id"),
        uuid(r, "conversation_id"),
        Long.toString(messageSeq),
        sender,
        r.getString("type"),
        r.getString("text"),
        card,
        offer,
        time(r, "created_at"),
        status);
  }

  public ReservationOffer reservationOffer(UUID offerId) {
    if (offerId == null) return null;
    List<ReservationOffer> list =
        db.query(
            "SELECT * FROM chat_reservation_offers WHERE id=?",
            this::mapReservationOffer,
            offerId);
    return list.isEmpty() ? null : list.getFirst();
  }

  private ReservationOffer mapReservationOffer(ResultSet r, int ignored) throws SQLException {
    java.sql.Date checkIn = r.getDate("check_in_date");
    java.sql.Date checkOut = r.getDate("check_out_date");
    java.sql.Time resTime = r.getTime("reservation_time");
    return new ReservationOffer(
        uuid(r, "id"),
        uuid(r, "conversation_id"),
        uuid(r, "message_id"),
        uuid(r, "sender_id"),
        uuid(r, "recipient_id"),
        r.getString("business_type"),
        uuid(r, "business_id"),
        r.getString("business_name"),
        r.getString("business_thumbnail"),
        r.getString("item_title"),
        checkIn == null ? null : checkIn.toLocalDate(),
        checkOut == null ? null : checkOut.toLocalDate(),
        resTime == null ? null : resTime.toLocalTime(),
        r.getInt("adults_count"),
        r.getInt("children_count"),
        r.getBigDecimal("total_price"),
        r.getBigDecimal("deposit_amount"),
        r.getString("currency"),
        r.getString("inclusions"),
        time(r, "expires_at"),
        r.getString("status"),
        r.getString("decline_reason"),
        uuid(r, "booking_id"),
        r.getString("booking_code"),
        time(r, "created_at"),
        time(r, "updated_at"));
  }

  private TripCard tripCard(UUID postId) {
    List<TripCard> cards =
        db.query(
            """
        SELECT s.post_id, s.trip_name, s.destination_name, s.day_count, s.cover_image_url
        FROM social_trip_shares s JOIN social_posts p ON p.id=s.post_id
        WHERE s.post_id=? AND s.visibility='PUBLIC' AND s.removed_at IS NULL AND p.deleted_at IS NULL
        """,
            (r, n) ->
                new TripCard(
                    uuid(r, "post_id"),
                    r.getString("trip_name"),
                    r.getString("destination_name"),
                    r.getObject("day_count", Integer.class),
                    r.getString("cover_image_url"),
                    true),
            postId);
    return cards.isEmpty() ? new TripCard(postId, null, null, null, null, false) : cards.getFirst();
  }

  private Message lastMessage(Thread t) {
    if (t.lastSeq == null) return null;
    List<Message> rows =
        db.query(
            "SELECT * FROM chat_messages WHERE conversation_id=? AND seq=?",
            this::mapMessage,
            t.id,
            t.lastSeq);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  private Conversation view(Thread t, UUID user) {
    UUID peer = t.peer(user);
    PublicProfileClientResponse profile = profiles.fetchPublicProfiles(List.of(peer)).get(peer);
    if (profile == null) profile = new PublicProfileClientResponse(peer, "TripSense user", null);
    Long read =
        db.queryForObject(
            "SELECT last_read_seq FROM chat_participants WHERE conversation_id=? AND user_id=?",
            Long.class,
            t.id,
            user);
    Long unread =
        db.queryForObject(
            "SELECT count(*) FROM chat_messages WHERE conversation_id=? AND sender_id<>? AND seq>?",
            Long.class,
            t.id,
            user,
            read);
    Boolean muted =
        db.queryForObject(
            "SELECT muted FROM chat_participants WHERE conversation_id=? AND user_id=?",
            Boolean.class,
            t.id,
            user);
    return new Conversation(
        t.id,
        profile,
        t.state,
        direction(t, user),
        lastMessage(t),
        unread == null ? 0 : unread,
        Boolean.TRUE.equals(muted),
        t.updatedAt,
        realtime.online(peer));
  }

  public List<PublicProfileClientResponse> searchUsers(String query, int count) {
    UUID user = me();
    if (query == null
        || query.trim().length() < 2
        || query.length() > 50
        || count < 1
        || count > 20) throw error(HttpStatus.BAD_REQUEST, "INVALID_QUERY", "Invalid search query");
    return profiles.search(query.trim(), count, token()).stream()
        .filter(p -> !p.userId().equals(user) && !blocked(user, p.userId()))
        .toList();
  }

  @Transactional
  public CreateOutcome create(UUID recipient) {
    UUID user = me();
    if (recipient == null || recipient.equals(user))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_RECIPIENT", "Invalid recipient");
    pairLock(user, recipient);
    assertAllowed(user, recipient);
    profiles.requireEnabled(recipient, token());
    UUID low = isLower(user, recipient) ? user : recipient;
    UUID high = low.equals(user) ? recipient : user;
    List<Thread> existing =
        db.query(
            "SELECT * FROM chat_conversations WHERE user_low_id=? AND user_high_id=?",
            this::thread,
            low,
            high);
    if (!existing.isEmpty()) {
      Thread found = existing.getFirst();
      if ("DRAFT".equals(found.state) && !found.initiator.equals(user)) {
        db.update(
            "UPDATE chat_conversations SET initiated_by=?,version=version+1,updated_at=now() WHERE id=?",
            user,
            found.id);
        found = requireThread(found.id, user, false);
      }
      return new CreateOutcome(view(found, user), false);
    }
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO chat_conversations(id,user_low_id,user_high_id,initiated_by,state,created_at,updated_at) VALUES (?,?,?,?, 'DRAFT',now(),now())",
        id,
        low,
        high,
        user);
    db.update(
        "INSERT INTO chat_participants(conversation_id,user_id) VALUES (?,?),(?,?)",
        id,
        low,
        id,
        high);
    return new CreateOutcome(view(requireThread(id, user, false), user), true);
  }

  public Page<Conversation> conversations(String filter, String cursor, int requestedLimit) {
    UUID user = me();
    int count = limit(requestedLimit);
    if (!Set.of("all", "unread", "requests").contains(filter))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_FILTER", "Invalid filter");
    long beforeSeq = Long.MAX_VALUE;
    UUID beforeId = new UUID(Long.MAX_VALUE, Long.MAX_VALUE);
    if (cursor != null && !cursor.isBlank()) {
      try {
        String[] parts = cursor.split(":", 2);
        beforeSeq = seq(parts[0]);
        beforeId = UUID.fromString(parts[1]);
      } catch (Exception e) {
        throw error(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor");
      }
    }
    List<Thread> threads =
        db.query(
            """
        SELECT c.* FROM chat_conversations c
        WHERE (c.user_low_id=? OR c.user_high_id=?) AND (coalesce(c.last_message_seq,0),c.id) < (?,?::uuid)
          AND NOT (c.state='DRAFT' AND c.initiated_by<>?)
          AND NOT (c.state='DECLINED' AND c.initiated_by<>?)
          AND NOT EXISTS (SELECT 1 FROM chat_blocks b WHERE
            (b.blocker_id=c.user_low_id AND b.blocked_id=c.user_high_id) OR
            (b.blocker_id=c.user_high_id AND b.blocked_id=c.user_low_id))
          AND (?='all' OR (?='requests' AND c.state='PENDING' AND c.initiated_by<>?) OR
            (?='unread' AND EXISTS (SELECT 1 FROM chat_messages m JOIN chat_participants cp
              ON cp.conversation_id=c.id AND cp.user_id=?
              WHERE m.conversation_id=c.id AND m.sender_id<>? AND m.seq>cp.last_read_seq)))
        ORDER BY coalesce(c.last_message_seq,0) DESC,c.id DESC LIMIT ?
        """,
            this::thread,
            user,
            user,
            beforeSeq,
            beforeId,
            user,
            user,
            filter,
            filter,
            user,
            filter,
            user,
            user,
            count + 1);
    List<Conversation> items = threads.stream().limit(count).map(t -> view(t, user)).toList();
    Thread last = threads.size() > count ? threads.get(count - 1) : null;
    String next =
        last == null
            ? null
            : (last.lastSeq == null ? "0" : last.lastSeq.toString()) + ":" + last.id;
    return new Page<>(items, next);
  }

  public Page<Message> messages(UUID id, String beforeSeq, int requestedLimit) {
    UUID user = me();
    Thread t = requireThread(id, user, false);
    if ("DRAFT".equals(t.state) && !t.initiator.equals(user))
      throw error(HttpStatus.NOT_FOUND, "CHAT_NOT_FOUND", "Conversation not found");
    int count = limit(requestedLimit);
    long before = beforeSeq == null || beforeSeq.isBlank() ? Long.MAX_VALUE : seq(beforeSeq);
    List<Message> rows =
        db.query(
            "SELECT * FROM chat_messages WHERE conversation_id=? AND seq<? ORDER BY seq DESC LIMIT ?",
            this::mapMessage,
            id,
            before,
            count + 1);
    List<Message> items = rows.stream().limit(count).toList();
    return new Page<>(
        items, rows.size() > count && !items.isEmpty() ? items.getLast().seq() : null);
  }

  private Message existingMessage(UUID sender, UUID key) {
    List<Message> rows =
        db.query(
            "SELECT * FROM chat_messages WHERE sender_id=? AND client_message_id=?",
            this::mapMessage,
            sender,
            key);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  private void validatePayload(SendMessage request) {
    if (request == null || request.clientMessageId() == null)
      throw error(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "Invalid message");
    if ("TEXT".equals(request.type())) {
      String text = request.text() == null ? "" : request.text().trim();
      if (text.isEmpty()
          || text.codePointCount(0, text.length()) > 2000
          || request.sharedPostId() != null
          || text.codePoints()
              .anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t'))
        throw error(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "Invalid message");
    } else if (!"SHARED_TRIP".equals(request.type())
        || request.sharedPostId() == null
        || request.text() != null)
      throw error(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "Invalid message");
  }

  private boolean samePayload(Message prior, SendMessage request, UUID id) {
    return prior.conversationId().equals(id)
        && prior.type().equals(request.type())
        && ("TEXT".equals(request.type())
            ? Objects.equals(prior.text(), request.text().trim())
            : prior.sharedTrip() != null && prior.sharedTrip().id().equals(request.sharedPostId()));
  }

  @Transactional
  public SendOutcome send(UUID id, SendMessage request) {
    UUID user = me();
    validatePayload(request);
    Message prior = existingMessage(user, request.clientMessageId());
    if (prior != null) {
      requireThread(prior.conversationId(), user, false);
      if (!samePayload(prior, request, id))
        throw error(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Message key already used");
      return new SendOutcome(prior, false);
    }
    Thread t = requireThread(id, user, false);
    pairLock(t.low, t.high);
    t = requireThread(id, user, true);
    assertAllowed(user, t.peer(user));
    prior = existingMessage(user, request.clientMessageId());
    if (prior != null) {
      if (!samePayload(prior, request, id))
        throw error(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Message key already used");
      return new SendOutcome(prior, false);
    }
    if ("PENDING".equals(t.state) || ("DRAFT".equals(t.state) && !t.initiator.equals(user)))
      throw error(HttpStatus.CONFLICT, "REQUEST_PENDING", "Awaiting request acceptance");
    if ("DECLINED".equals(t.state)
        && (t.declinedAt == null
            || t.declinedAt.isAfter(Instant.now().minus(30, ChronoUnit.DAYS))
            || !t.initiator.equals(user)))
      throw error(HttpStatus.CONFLICT, "REQUEST_DECLINED", "Request unavailable");
    if ("SHARED_TRIP".equals(request.type())) {
      Integer exists =
          db.queryForObject(
              """
          SELECT count(*) FROM social_trip_shares s JOIN social_posts p ON p.id=s.post_id
          WHERE s.post_id=? AND s.author_id=? AND s.visibility='PUBLIC' AND s.removed_at IS NULL AND p.deleted_at IS NULL
          """,
              Integer.class,
              request.sharedPostId(),
              user);
      if (exists == null || exists == 0)
        throw error(HttpStatus.BAD_REQUEST, "TRIP_NOT_SHAREABLE", "Trip share unavailable");
    }
    String body = "TEXT".equals(request.type()) ? request.text().trim() : null;
    UUID messageId = UUID.randomUUID();
    Long newSeq =
        db.queryForObject(
            """
        INSERT INTO chat_messages(id,conversation_id,sender_id,client_message_id,type,text,shared_post_id,created_at)
        VALUES (?,?,?,?,?,?,?,now()) RETURNING seq
        """,
            Long.class,
            messageId,
            id,
            user,
            request.clientMessageId(),
            request.type(),
            body,
            request.sharedPostId());
    db.update(
        "UPDATE chat_conversations SET state=CASE WHEN state IN ('DRAFT','DECLINED') THEN 'PENDING' ELSE state END, last_message_seq=?, version=version+1, updated_at=now() WHERE id=?",
        newSeq,
        id);
    changed(t, "MESSAGE_CREATED");

    try {
      UUID recipient = t.peer(user);
      Boolean muted =
          db.queryForObject(
              "SELECT muted FROM chat_participants WHERE conversation_id=? AND user_id=?",
              Boolean.class,
              id,
              recipient);
      if (!Boolean.TRUE.equals(muted)) {
        PublicProfileClientResponse senderProfile =
            profiles.fetchPublicProfiles(List.of(user)).get(user);
        String senderName =
            senderProfile != null && senderProfile.displayName() != null
                ? senderProfile.displayName()
                : "TripSense";
        String displayText =
            "SHARED_TRIP".equals(request.type()) ? "Đã chia sẻ một chuyến đi" : body;
        Runnable pushTask =
            () -> {
              try {
                pushNotificationService.sendNewMessageNotification(
                    recipient, senderName, displayText, id);
              } catch (Exception ex) {
                // Non-blocking: background push failure should never break message delivery
              }
            };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
          TransactionSynchronizationManager.registerSynchronization(
              new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                  CompletableFuture.runAsync(pushTask);
                }
              });
        } else {
          CompletableFuture.runAsync(pushTask);
        }
      }
    } catch (Exception e) {
      // Non-blocking: push failure should never break message sending
    }

    return new SendOutcome(existingMessage(user, request.clientMessageId()), true);
  }

  @Transactional
  public Message createOffer(UUID conversationId, CreateReservationOffer request) {
    UUID user = me();
    if (request == null || request.clientMessageId() == null || request.businessId() == null) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_OFFER", "Missing required offer fields");
    }
    if (request.checkInDate() == null || request.itemTitle() == null || request.itemTitle().isBlank()) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_OFFER", "Item title and check-in date are required");
    }

    Thread t = requireThread(conversationId, user, false);
    pairLock(t.low, t.high);
    t = requireThread(conversationId, user, true);
    assertAllowed(user, t.peer(user));

    UUID offerId = UUID.randomUUID();
    UUID messageId = UUID.randomUUID();
    UUID recipient = t.peer(user);

    int validHours = request.validHours() == null || request.validHours() <= 0 ? 24 : request.validHours();
    Instant expiresAt = Instant.now().plus(validHours, ChronoUnit.HOURS);

    java.sql.Date sqlCheckIn = java.sql.Date.valueOf(request.checkInDate());
    java.sql.Date sqlCheckOut = request.checkOutDate() == null ? null : java.sql.Date.valueOf(request.checkOutDate());
    java.sql.Time sqlTime = request.reservationTime() == null ? null : java.sql.Time.valueOf(request.reservationTime());

    db.update(
        """
        INSERT INTO chat_reservation_offers(
          id, conversation_id, message_id, sender_id, recipient_id,
          business_type, business_id, business_name, business_thumbnail, item_title,
          check_in_date, check_out_date, reservation_time,
          adults_count, children_count, total_price, deposit_amount, currency,
          inclusions, expires_at, status, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',now(),now())
        """,
        offerId,
        conversationId,
        messageId,
        user,
        recipient,
        request.businessType() == null ? "HOTEL" : request.businessType().toUpperCase(),
        request.businessId(),
        request.businessName() == null ? "Cơ sở đối tác" : request.businessName(),
        request.businessThumbnail(),
        request.itemTitle(),
        sqlCheckIn,
        sqlCheckOut,
        sqlTime,
        request.adultsCount() == null ? 1 : request.adultsCount(),
        request.childrenCount() == null ? 0 : request.childrenCount(),
        request.totalPrice() == null ? BigDecimal.ZERO : request.totalPrice(),
        request.depositAmount() == null ? BigDecimal.ZERO : request.depositAmount(),
        request.currency() == null ? "VND" : request.currency(),
        request.inclusions(),
        Timestamp.from(expiresAt));

    Long newSeq =
        db.queryForObject(
            """
            INSERT INTO chat_messages(id, conversation_id, sender_id, client_message_id, type, text, offer_id, created_at)
            VALUES (?,?,?,?,'RESERVATION_OFFER',null,?,now()) RETURNING seq
            """,
            Long.class,
            messageId,
            conversationId,
            user,
            request.clientMessageId(),
            offerId);

    db.update(
        "UPDATE chat_conversations SET state=CASE WHEN state IN ('DRAFT','DECLINED') THEN 'PENDING' ELSE state END, last_message_seq=?, version=version+1, updated_at=now() WHERE id=?",
        newSeq,
        conversationId);

    changed(t, "MESSAGE_CREATED");

    return existingMessage(user, request.clientMessageId());
  }

  public ReservationOffer getOffer(UUID offerId) {
    UUID user = me();
    ReservationOffer offer = reservationOffer(offerId);
    if (offer == null) {
      throw error(HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND", "Offer not found");
    }
    requireThread(offer.conversationId(), user, false);
    return offer;
  }

  public List<ReservationOffer> myOffers(String status, String businessType) {
    UUID user = me();
    StringBuilder sql =
        new StringBuilder(
            "SELECT * FROM chat_reservation_offers WHERE (recipient_id = ? OR sender_id = ?)");
    List<Object> params = new ArrayList<>();
    params.add(user);
    params.add(user);

    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
      sql.append(" AND status = ?");
      params.add(status.toUpperCase().trim());
    }

    if (businessType != null && !businessType.isBlank() && !"ALL".equalsIgnoreCase(businessType)) {
      sql.append(" AND business_type = ?");
      params.add(businessType.toUpperCase().trim());
    }

    sql.append(" ORDER BY created_at DESC LIMIT 100");
    return db.query(sql.toString(), this::mapReservationOffer, params.toArray());
  }

  @Transactional
  public AcceptOfferResponse acceptOffer(UUID offerId) {
    UUID user = me();
    ReservationOffer offer = reservationOffer(offerId);
    if (offer == null) {
      throw error(HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND", "Offer not found");
    }
    if (!offer.recipientId().equals(user)) {
      throw error(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the offer recipient can accept this offer");
    }
    if (!"PENDING".equals(offer.status())) {
      throw error(HttpStatus.CONFLICT, "INVALID_OFFER_STATE", "Offer is no longer pending");
    }
    if (Instant.now().isAfter(offer.expiresAt())) {
      db.update("UPDATE chat_reservation_offers SET status='EXPIRED', updated_at=now() WHERE id=?", offerId);
      throw error(HttpStatus.CONFLICT, "OFFER_EXPIRED", "Offer has expired");
    }

    UUID bookingId = UUID.randomUUID();
    String prefix = "RESTAURANT".equalsIgnoreCase(offer.businessType()) ? "TS-RES-" : "TS-HTL-";
    String bookingCode = prefix + offer.id().toString().substring(0, 8).toUpperCase();

    int updated =
        db.update(
            "UPDATE chat_reservation_offers SET status='ACCEPTED', booking_id=?, booking_code=?, updated_at=now() WHERE id=? AND status='PENDING'",
            bookingId,
            bookingCode,
            offerId);

    if (updated == 0) {
      throw error(HttpStatus.CONFLICT, "CONCURRENT_ACCEPT", "Offer was already accepted or modified");
    }

    Thread t = requireThread(offer.conversationId(), user, false);
    changed(t, "OFFER_UPDATED");

    String redirectTab = "RESTAURANT".equalsIgnoreCase(offer.businessType()) ? "restaurants" : "hotels";
    String redirectUrl = "/reservations?tab=" + redirectTab + "&bookingId=" + bookingId;

    return new AcceptOfferResponse(
        offerId,
        "ACCEPTED",
        bookingId,
        bookingCode,
        redirectUrl,
        "Xác nhận đặt chỗ thành công!");
  }

  @Transactional
  public ReservationOffer declineOffer(UUID offerId, String reason) {
    UUID user = me();
    ReservationOffer offer = reservationOffer(offerId);
    if (offer == null) {
      throw error(HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND", "Offer not found");
    }
    if (!offer.recipientId().equals(user)) {
      throw error(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the offer recipient can decline this offer");
    }
    if (!"PENDING".equals(offer.status())) {
      throw error(HttpStatus.CONFLICT, "INVALID_OFFER_STATE", "Offer is no longer pending");
    }

    db.update(
        "UPDATE chat_reservation_offers SET status='DECLINED', decline_reason=?, updated_at=now() WHERE id=? AND status='PENDING'",
        reason,
        offerId);

    Thread t = requireThread(offer.conversationId(), user, false);
    changed(t, "OFFER_UPDATED");

    return reservationOffer(offerId);
  }

  @Transactional
  public ReservationOffer cancelOffer(UUID offerId) {
    UUID user = me();
    ReservationOffer offer = reservationOffer(offerId);
    if (offer == null) {
      throw error(HttpStatus.NOT_FOUND, "OFFER_NOT_FOUND", "Offer not found");
    }
    if (!offer.senderId().equals(user)) {
      throw error(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the creator can cancel this offer");
    }
    if (!"PENDING".equals(offer.status())) {
      throw error(HttpStatus.CONFLICT, "INVALID_OFFER_STATE", "Offer is no longer pending");
    }

    db.update(
        "UPDATE chat_reservation_offers SET status='CANCELLED', updated_at=now() WHERE id=? AND status='PENDING'",
        offerId);

    Thread t = requireThread(offer.conversationId(), user, false);
    changed(t, "OFFER_UPDATED");

    return reservationOffer(offerId);
  }

  @Transactional
  public Conversation receipt(UUID id, Receipt request, boolean read) {
    UUID user = me();
    Thread t = requireThread(id, user, true);
    long through = seq(request.throughSeq());
    if (through > 0) {
      Integer exists =
          db.queryForObject(
              "SELECT count(*) FROM chat_messages WHERE conversation_id=? AND seq=?",
              Integer.class,
              id,
              through);
      if (exists == null || exists == 0)
        throw error(HttpStatus.BAD_REQUEST, "INVALID_RECEIPT", "Invalid receipt");
    }
    int updated =
        db.update(
            read
                ? "UPDATE chat_participants SET last_read_seq=greatest(last_read_seq,?), last_delivered_seq=greatest(last_delivered_seq,?) WHERE conversation_id=? AND user_id=? AND last_read_seq<?"
                : "UPDATE chat_participants SET last_delivered_seq=greatest(last_delivered_seq,?) WHERE conversation_id=? AND user_id=? AND last_delivered_seq<?",
            read
                ? new Object[] {through, through, id, user, through}
                : new Object[] {through, id, user, through});
    if (updated > 0) {
      db.update("UPDATE chat_conversations SET version=version+1 WHERE id=?", id);
      changed(t, read ? "READ" : "DELIVERED");
    }
    return view(t, user);
  }

  @Transactional
  public Conversation requestDecision(UUID id, boolean accept) {
    UUID user = me();
    Thread t = requireThread(id, user, true);
    if (!"PENDING".equals(t.state) || t.initiator.equals(user))
      throw error(HttpStatus.CONFLICT, "INVALID_REQUEST_STATE", "Request not pending");
    if (blocked(user, t.peer(user)))
      throw error(HttpStatus.FORBIDDEN, "CHAT_BLOCKED", "Chat unavailable");
    db.update(
        "UPDATE chat_conversations SET state=?, declined_at=CASE WHEN ? THEN NULL ELSE now() END, version=version+1,updated_at=now() WHERE id=?",
        accept ? "ACTIVE" : "DECLINED",
        accept,
        id);
    changed(t, accept ? "REQUEST_ACCEPTED" : "REQUEST_DECLINED");
    return view(requireThread(id, user, false), user);
  }

  @Transactional
  public Conversation mute(UUID id, boolean muted) {
    UUID user = me();
    Thread t = requireThread(id, user, true);
    db.update(
        "UPDATE chat_participants SET muted=? WHERE conversation_id=? AND user_id=?",
        muted,
        id,
        user);
    db.update("UPDATE chat_conversations SET version=version+1 WHERE id=?", id);
    changed(t, "MUTE_CHANGED");
    return view(t, user);
  }

  @Transactional
  public void block(UUID target) {
    UUID user = me();
    if (target == null || target.equals(user))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_TARGET", "Invalid target");
    pairLock(user, target);
    db.update(
        "INSERT INTO chat_blocks(blocker_id,blocked_id,created_at) VALUES (?,?,now()) ON CONFLICT DO NOTHING",
        user,
        target);
    notifyPair(user, target, "BLOCK_CHANGED");
  }

  @Transactional
  public void unblock(UUID target) {
    UUID user = me();
    pairLock(user, target);
    db.update("DELETE FROM chat_blocks WHERE blocker_id=? AND blocked_id=?", user, target);
    notifyPair(user, target, "BLOCK_CHANGED");
  }

  private void notifyPair(UUID a, UUID b, String type) {
    List<Thread> matches =
        db.query(
            "SELECT * FROM chat_conversations WHERE (user_low_id=? AND user_high_id=?) OR (user_low_id=? AND user_high_id=?)",
            this::thread,
            a,
            b,
            b,
            a);
    if (!matches.isEmpty()) {
      Thread t = matches.getFirst();
      db.update("UPDATE chat_conversations SET version=version+1 WHERE id=?", t.id);
      changed(t, type);
    }
  }

  public Page<PublicProfileClientResponse> blocks(String cursor, int requestedLimit) {
    UUID user = me();
    int count = limit(requestedLimit);
    UUID after;
    try {
      after = cursor == null || cursor.isBlank() ? null : UUID.fromString(cursor);
    } catch (Exception e) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor");
    }
    List<UUID> ids =
        db.query(
            "SELECT blocked_id FROM chat_blocks WHERE blocker_id=? AND (?::uuid IS NULL OR blocked_id>?::uuid) ORDER BY blocked_id LIMIT ?",
            (r, n) -> uuid(r, "blocked_id"),
            user,
            after,
            after,
            count + 1);
    Map<UUID, PublicProfileClientResponse> fetched = profiles.fetchPublicProfiles(ids);
    List<PublicProfileClientResponse> items =
        ids.stream()
            .limit(count)
            .map(
                id ->
                    fetched.getOrDefault(
                        id, new PublicProfileClientResponse(id, "TripSense user", null)))
            .toList();
    return new Page<>(items, ids.size() > count ? ids.get(count - 1).toString() : null);
  }

  @Transactional
  public ReportReceipt report(UUID conversationId, Report request) {
    UUID user = me();
    Thread thread = requireThread(conversationId, user, false);
    if (request == null
        || !thread.peer(user).equals(request.reportedUserId())
        || request.reason() == null
        || !Set.of("SPAM", "HARASSMENT", "DANGEROUS_CONTENT", "PRIVACY", "OTHER")
            .contains(request.reason())
        || (request.details() != null && request.details().length() > 500))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_REPORT", "Invalid report");
    Integer recent =
        db.queryForObject(
            "SELECT count(*) FROM chat_reports WHERE reporter_id=? AND created_at>now()-interval '1 hour'",
            Integer.class,
            user);
    if (recent != null && recent >= 5)
      throw error(HttpStatus.TOO_MANY_REQUESTS, "REPORT_LIMIT", "Report limit reached");
    Integer pending =
        db.queryForObject(
            "SELECT count(*) FROM chat_reports WHERE conversation_id=? AND reporter_id=? AND reported_user_id=? AND status='PENDING'",
            Integer.class,
            conversationId,
            user,
            request.reportedUserId());
    if (pending != null && pending > 0)
      throw error(HttpStatus.CONFLICT, "REPORT_EXISTS", "Report already pending");
    List<Message> evidence =
        request.messageId() == null
            ? db.query(
                "SELECT * FROM chat_messages WHERE conversation_id=? AND sender_id=? ORDER BY seq DESC LIMIT 1",
                this::mapMessage,
                conversationId,
                request.reportedUserId())
            : db.query(
                "SELECT * FROM chat_messages WHERE id=? AND conversation_id=? AND sender_id=?",
                this::mapMessage,
                request.messageId(),
                conversationId,
                request.reportedUserId());
    if (evidence.isEmpty())
      throw error(
          HttpStatus.BAD_REQUEST,
          "INVALID_REPORT",
          "Report requires a message from the reported user");
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO chat_reports(id,conversation_id,reporter_id,reported_user_id,message_id,reason,details,status,created_at) VALUES (?,?,?,?,?,?,?,'PENDING',now())",
        id,
        conversationId,
        user,
        request.reportedUserId(),
        evidence.getFirst().id(),
        request.reason(),
        request.details());
    return new ReportReceipt(id, "PENDING");
  }

  private ReportCase reportCase(ResultSet r, int ignored) throws SQLException {
    UUID messageId = uuid(r, "message_id");
    List<Message> evidence =
        messageId == null
            ? List.of()
            : db.query(
                """
        SELECT m.* FROM chat_messages m WHERE m.conversation_id=? AND
        m.seq BETWEEN (SELECT seq-1 FROM chat_messages WHERE id=?) AND (SELECT seq+1 FROM chat_messages WHERE id=?)
        ORDER BY m.seq
        """,
                this::mapMessage,
                uuid(r, "conversation_id"),
                messageId,
                messageId);
    return new ReportCase(
        uuid(r, "id"),
        uuid(r, "conversation_id"),
        uuid(r, "reporter_id"),
        uuid(r, "reported_user_id"),
        r.getString("reason"),
        r.getString("details"),
        r.getString("status"),
        time(r, "created_at"),
        evidence);
  }

  public Page<ReportCase> reports(String status, String cursor, int requestedLimit) {
    me();
    int count = limit(requestedLimit);
    if (!Set.of("PENDING", "DISMISSED", "ACTIONED").contains(status))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_STATUS", "Invalid status");
    UUID after;
    try {
      after = cursor == null || cursor.isBlank() ? null : UUID.fromString(cursor);
    } catch (Exception e) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor");
    }
    List<ReportCase> rows =
        db.query(
            "SELECT * FROM chat_reports WHERE status=? AND (?::uuid IS NULL OR id>?::uuid) ORDER BY id LIMIT ?",
            this::reportCase,
            status,
            after,
            after,
            count + 1);
    List<ReportCase> items = rows.stream().limit(count).toList();
    return new Page<>(items, rows.size() > count ? items.getLast().id().toString() : null);
  }

  @Transactional
  public ReportReceipt decide(UUID reportId, Decision decision) {
    UUID moderator = me();
    if (decision == null
        || decision.reason() == null
        || decision.reason().isBlank()
        || decision.reason().length() > 500
        || !Set.of("DISMISS", "RESTRICT_CHAT").contains(decision.action())
        || ("RESTRICT_CHAT".equals(decision.action())
            && (decision.durationHours() == null
                || decision.durationHours() < 1
                || decision.durationHours() > 720)))
      throw error(HttpStatus.BAD_REQUEST, "INVALID_DECISION", "Invalid decision");
    List<ReportCase> rows =
        db.query("SELECT * FROM chat_reports WHERE id=? FOR UPDATE", this::reportCase, reportId);
    if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Report not found");
    ReportCase report = rows.getFirst();
    if (!"PENDING".equals(report.status()))
      throw error(HttpStatus.CONFLICT, "REPORT_DECIDED", "Report already decided");
    String status = "DISMISS".equals(decision.action()) ? "DISMISSED" : "ACTIONED";
    db.update(
        "UPDATE chat_reports SET status=?,reviewed_at=now(),reviewed_by=?,decision=? WHERE id=?",
        status,
        moderator,
        decision.action(),
        reportId);
    if ("RESTRICT_CHAT".equals(decision.action())) {
      db.update(
          """
          INSERT INTO chat_restrictions(user_id,expires_at,reason,decided_by,created_at)
          VALUES (?,now()+(? * interval '1 hour'),?,?,now())
          ON CONFLICT (user_id) DO UPDATE SET expires_at=excluded.expires_at,
            reason=excluded.reason,decided_by=excluded.decided_by,created_at=excluded.created_at
          """,
          report.reportedUserId(),
          decision.durationHours(),
          decision.reason(),
          moderator);
    }
    db.update(
        "INSERT INTO chat_moderation_audits(id,report_id,moderator_id,action,reason,created_at) VALUES (?,?,?,?,?,now())",
        UUID.randomUUID(),
        reportId,
        moderator,
        decision.action(),
        decision.reason());
    return new ReportReceipt(reportId, status);
  }

  public UnreadSummary unreadSummary() {
    UUID user = me();
    Long unreadConversations =
        db.queryForObject(
            """
        SELECT coalesce(count(DISTINCT c.id), 0)
        FROM chat_conversations c
        JOIN chat_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
        WHERE (c.user_low_id = ? OR c.user_high_id = ?)
          AND NOT (c.state = 'DRAFT' AND c.initiated_by <> ?)
          AND NOT (c.state = 'DECLINED' AND c.initiated_by <> ?)
          AND NOT EXISTS (SELECT 1 FROM chat_blocks b WHERE
            (b.blocker_id = c.user_low_id AND b.blocked_id = c.user_high_id) OR
            (b.blocker_id = c.user_high_id AND b.blocked_id = c.user_low_id))
          AND EXISTS (SELECT 1 FROM chat_messages m
            WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.seq > cp.last_read_seq)
        """,
            Long.class,
            user,
            user,
            user,
            user,
            user,
            user);

    Long totalUnread =
        db.queryForObject(
            """
        SELECT coalesce(count(m.id), 0)
        FROM chat_conversations c
        JOIN chat_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
        JOIN chat_messages m ON m.conversation_id = c.id AND m.sender_id <> ? AND m.seq > cp.last_read_seq
        WHERE (c.user_low_id = ? OR c.user_high_id = ?)
          AND NOT (c.state = 'DRAFT' AND c.initiated_by <> ?)
          AND NOT (c.state = 'DECLINED' AND c.initiated_by <> ?)
          AND NOT EXISTS (SELECT 1 FROM chat_blocks b WHERE
            (b.blocker_id = c.user_low_id AND b.blocked_id = c.user_high_id) OR
            (b.blocker_id = c.user_high_id AND b.blocked_id = c.user_low_id))
        """,
            Long.class,
            user,
            user,
            user,
            user,
            user,
            user);

    return new UnreadSummary(
        unreadConversations == null ? 0 : unreadConversations,
        totalUnread == null ? 0 : totalUnread);
  }

  @Transactional
  public void registerFcmToken(RegisterFcmToken request) {
    UUID user = current.requiredUser().id();
    if (request == null || request.fcmToken() == null || request.fcmToken().isBlank()) {
      throw error(HttpStatus.BAD_REQUEST, "INVALID_TOKEN", "FCM token is required");
    }
    String token = request.fcmToken().trim();
    String deviceType =
        request.deviceType() != null && !request.deviceType().isBlank()
            ? request.deviceType().trim()
            : "WEB";
    String userAgent = request.userAgent();
    db.update(
        """
        INSERT INTO chat_fcm_tokens(user_id, fcm_token, device_type, user_agent, last_seen_at, created_at)
        VALUES (?, ?, ?, ?, now(), now())
        ON CONFLICT (fcm_token) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            device_type = EXCLUDED.device_type,
            user_agent = EXCLUDED.user_agent,
            last_seen_at = now()
        """,
        user,
        token,
        deviceType,
        userAgent);
  }

  @Transactional
  public void unregisterFcmToken(UnregisterFcmToken request) {
    UUID user = current.requiredUser().id();
    if (request == null || request.fcmToken() == null || request.fcmToken().isBlank()) {
      return;
    }
    db.update(
        "DELETE FROM chat_fcm_tokens WHERE user_id = ? AND fcm_token = ?",
        user,
        request.fcmToken().trim());
  }

  public boolean sendTestPushNotification() {
    UUID user = current.requiredUser().id();
    return pushNotificationService.sendTestPushNotification(user);
  }
}
