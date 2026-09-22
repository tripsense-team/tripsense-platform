import { ApiError } from "@/services/api-client";

/**
 * Sanitizes and converts unknown/backend auth errors into user-friendly Vietnamese UI messages.
 * Prevents technical jargon, SQL dumps, or raw HTTP status codes from leaking to the UI.
 */
export function getAuthErrorMessage(
  err: unknown,
  fallback = "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
  t?: (key: string, defaultMessage?: string) => string,
): string {
  const tr = (key: string, def: string) => (t ? t(key, def) : def);

  if (err instanceof ApiError) {
    if (err.status === 401) {
      return tr(
        "errors.badCredentials",
        "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.",
      );
    }
    if (err.status === 403) {
      return tr(
        "errors.forbidden",
        "Tài khoản của bạn chưa được kích hoạt hoặc đã bị tạm khóa.",
      );
    }
    if (err.status === 404) {
      return tr(
        "errors.notFound",
        "Không tìm thấy tài khoản với email này.",
      );
    }
    if (err.status === 409) {
      const raw = (err.message || "").trim();
      const errorCode =
        err.data && typeof err.data === "object" && "error" in err.data
          ? String((err.data as { error?: unknown }).error)
          : "";

      if (
        errorCode === "OAUTH_ACCOUNT_CONFLICT" ||
        raw.includes("tài khoản thường") ||
        raw.includes("đã tồn tại") ||
        raw.includes("OAUTH_ACCOUNT_CONFLICT")
      ) {
        return tr(
          "errors.oauthConflict",
          "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.",
        );
      }
      return tr(
        "errors.emailInUse",
        "Email này đã được sử dụng bởi một tài khoản khác.",
      );
    }
    if (err.status === 429) {
      return tr(
        "errors.tooManyRequests",
        "Bạn đã thử quá nhiều lần. Vui lòng đợi trong giây lát rồi thử lại.",
      );
    }
    if (err.status >= 500) {
      return tr(
        "errors.serverBusy",
        "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.",
      );
    }

    const message = (err.message || "").trim();
    if (isTechnicalErrorMessage(message)) {
      return tr(
        "errors.serverBusy",
        "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.",
      );
    }

    return message || tr("errors.generic", fallback);
  }

  if (err instanceof Error) {
    const message = (err.message || "").trim();
    if (isTechnicalErrorMessage(message)) {
      return tr(
        "errors.network",
        "Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.",
      );
    }
    return message || tr("errors.generic", fallback);
  }

  return tr("errors.generic", fallback);
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
