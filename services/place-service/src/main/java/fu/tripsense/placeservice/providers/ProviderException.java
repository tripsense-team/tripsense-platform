package fu.tripsense.placeservice.providers;

import java.util.Map;

public class ProviderException extends RuntimeException {

    private final Kind kind;
    private final String code;
    private final Map<String, Object> details;

    public ProviderException(Kind kind, String code, String message) {
        this(kind, code, message, Map.of());
    }

    public ProviderException(Kind kind, String code, String message, Map<String, Object> details) {
        super(message);
        this.kind = kind;
        this.code = code;
        this.details = details;
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }

    public Map<String, Object> details() {
        return details;
    }

    public enum Kind {
        MISSING_CONFIGURATION,
        BAD_REQUEST,
        UNAUTHORIZED,
        FORBIDDEN,
        RATE_LIMITED,
        NOT_FOUND,
        UNAVAILABLE
    }
}
