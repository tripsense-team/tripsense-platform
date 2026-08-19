package fu.tripsense.placeservice.providers;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TimedCache {

    private final Clock clock;
    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    public TimedCache() {
        this(Clock.systemUTC());
    }

    TimedCache(Clock clock) {
        this.clock = clock;
    }

    public Optional<Object> get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.expiresAt().isBefore(Instant.now(clock))) {
            entries.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    public void put(String key, Object value, Duration ttl) {
        entries.put(key, new Entry(value, Instant.now(clock).plus(ttl)));
    }

    private record Entry(Object value, Instant expiresAt) {
    }
}
