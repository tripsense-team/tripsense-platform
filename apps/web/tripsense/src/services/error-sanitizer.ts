/**
 * TripSense Frontend Error Sanitizer
 *
 * Protects frontend UI, toasts, forms, and client logs from leaking sensitive server-side
 * details (SQL queries, JDBC exceptions, database column names, Hibernate traces, Spring stack traces).
 *
 * Part of TripSense Zero-Leak Policy (see docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md).
 */

const SENSITIVE_PATTERNS: RegExp[] = [
  /jdbc/i,
  /\bsql\b/i,
  /hibernate/i,
  /psqlexception/i,
  /sqlexception/i,
  /dataaccessexception/i,
  /constraintviolation/i,
  /column\s+.*does\s+not\s+exist/i,
  /relation\s+.*does\s+not\s+exist/i,
  /table\s+.*does\s+not\s+exist/i,
  /violates\s+foreign\s+key/i,
  /duplicate\s+key/i,
  /syntax\s+error\s+at\s+or\s+near/i,
  /\bselect\b.*\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\b.*\bset\b/i,
  /\bdelete\b.*\bfrom\b/i,
  /org\.springframework/i,
  /nullpointerexception/i,
  /classnotfoundexception/i,
  /invocationtargetexception/i,
  /stacktrace/i,
  /at\s+[a-zA-Z0-9_.]+\.[a-zA-Z0-9_]+\([a-zA-Z0-9_.]+\.java:\d+\)/i,
  /nested\s+exception\s+is/i,
  /internal\s+server\s+error/i,
  /bad\s+gateway/i,
  /service\s+unavailable/i,
  /gateway\s+timeout/i,
  /failed\s+to\s+fetch/i,
  /networkerror/i,
];

const SENSITIVE_DATA_KEYS = new Set([
  "stacktrace",
  "stack_trace",
  "trace",
  "exception",
  "cause",
  "suppressed",
  "sql",
  "query",
  "localizedmessage",
]);

/**
 * Generates a short random incident reference code (e.g. ERR-8F2K4)
 * Allows users to report an issue to support without exposing internal errors.
 */
export function createIncidentReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ERR-${code}`;
}

/**
 * Checks if a string contains internal server, database, or stack trace keywords.
 */
export function isSensitiveErrorMessage(msg?: string | null): boolean {
  if (!msg || typeof msg !== "string") return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(msg));
}

export interface SanitizedResult {
  message: string;
  isSanitized: boolean;
  incidentRef: string;
}

/**
 * Sanitizes an error message before it reaches the UI or ApiError instance.
 * - HTTP >= 500 or sensitive messages are scrubbed into a friendly user message with an incident reference code.
 * - Legitimate 4xx user validation messages (e.g., "Mật khẩu không hợp lệ") are preserved.
 */
export function sanitizeErrorMessage(
  rawMessage?: string | null,
  status = 500,
  incidentRef?: string,
): SanitizedResult {
  const ref = incidentRef || createIncidentReference();
  const raw = (rawMessage || "").trim();

  // If server-side crash (5xx) or contains sensitive technical patterns -> scrub immediately
  if (status >= 500 || isSensitiveErrorMessage(raw)) {
    return {
      message: `Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau. (Mã tham chiếu: ${ref})`,
      isSanitized: true,
      incidentRef: ref,
    };
  }

  // Fallback for empty messages on client errors
  if (!raw) {
    return {
      message: `Đã có lỗi xảy ra (${status}). Vui lòng thử lại.`,
      isSanitized: false,
      incidentRef: ref,
    };
  }

  return {
    message: raw,
    isSanitized: false,
    incidentRef: ref,
  };
}

/**
 * Recursively scrubs sensitive data fields (stack traces, SQL statements) from API response payloads.
 */
export function sanitizeErrorData(data: unknown, status = 500): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeErrorData(item, status));
  }

  const record = data as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();

    // Strip stack traces, SQL, and internal exception objects
    if (SENSITIVE_DATA_KEYS.has(lowerKey)) {
      continue;
    }

    // Sanitize nested error message if sensitive
    if (lowerKey === "message" && typeof value === "string") {
      cleaned[key] = sanitizeErrorMessage(value, status).message;
      continue;
    }

    if (value && typeof value === "object") {
      cleaned[key] = sanitizeErrorData(value, status);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * General helper to get a guaranteed safe, human-readable error message from any thrown error.
 */
export function getSafeErrorMessage(
  err: unknown,
  fallback = "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
): string {
  if (!err) return fallback;

  if (typeof err === "object" && err !== null && "message" in err) {
    const raw = String((err as { message?: unknown }).message || "");
    const status =
      "status" in err &&
      typeof (err as { status?: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;

    return sanitizeErrorMessage(raw, status).message;
  }

  if (typeof err === "string") {
    return sanitizeErrorMessage(err, 500).message;
  }

  return fallback;
}
