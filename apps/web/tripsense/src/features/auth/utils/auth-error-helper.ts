import { ApiError } from "@/services/api-client";

/**
 * Sanitizes and converts unknown/backend auth errors into user-friendly Vietnamese UI messages.
 * Prevents technical jargon, SQL dumps, or raw HTTP status codes from leaking to the UI.
 */
export function getAuthErrorMessage(
  err: unknown,
  fallback = "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
    }
    if (err.status === 403) {
      return "Tài khoản của bạn chưa được kích hoạt hoặc đã bị tạm khóa.";
    }
    if (err.status === 404) {
      return "Không tìm thấy tài khoản với email này.";
    }
    if (err.status === 409) {
      const raw = (err.message || "").trim();
      if (raw.includes("tài khoản thường") || raw.includes("đã tồn tại")) {
        return raw;
      }
      return "Email này đã được sử dụng bởi một tài khoản khác.";
    }
    if (err.status === 429) {
      return "Bạn đã thử quá nhiều lần. Vui lòng đợi trong giây lát rồi thử lại.";
    }
    if (err.status >= 500) {
      return "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.";
    }

    const message = (err.message || "").trim();
    if (isTechnicalErrorMessage(message)) {
      return "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.";
    }

    return message || fallback;
  }

  if (err instanceof Error) {
    const message = (err.message || "").trim();
    if (isTechnicalErrorMessage(message)) {
      return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.";
    }
    return message || fallback;
  }

  return fallback;
}

/**
 * Checks if an error string contains sensitive backend or network technical keywords.
 */
function isTechnicalErrorMessage(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("jdbc") ||
    lower.includes("sql") ||
    lower.includes("position:") ||
    lower.includes("exception") ||
    lower.includes("http error!") ||
    lower.includes("internal server error") ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("bad gateway") ||
    lower.includes("service unavailable") ||
    lower.includes("gateway timeout") ||
    lower.includes("stacktrace")
  );
}
