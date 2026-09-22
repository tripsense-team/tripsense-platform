import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/api-client";
import { getAuthErrorMessage } from "../utils/auth-error-helper";

describe("auth-error-helper unit tests", () => {
  it("should return friendly message for 401 Unauthorized", () => {
    const error = new ApiError("Bad credentials", 401, {});
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.",
    );
  });

  it("should return friendly message for 403 Forbidden", () => {
    const error = new ApiError("Account disabled", 403, {});
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Tài khoản của bạn chưa được kích hoạt hoặc đã bị tạm khóa.",
    );
  });

  it("should return friendly message for 409 Conflict", () => {
    const error = new ApiError("Email already exists", 409, {});
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe("Email này đã được sử dụng bởi một tài khoản khác.");
  });

  it("should preserve specific standard account conflict message for 409 Conflict", () => {
    const error = new ApiError(
      "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.",
      409,
      {},
    );
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.",
    );
  });

  it("should mask 500 internal server error and prevent technical leaks", () => {
    const error = new ApiError(
      "JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16]",
      500,
      {},
    );
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.",
    );
    expect(msg).not.toContain("JDBC");
    expect(msg).not.toContain("auth_provider");
  });

  it("should mask 503 service unavailable error", () => {
    const error = new ApiError("HTTP error! status: 503", 503, {});
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Hệ thống đang bận hoặc gián đoạn kết nối. Vui lòng thử lại sau ít phút.",
    );
  });

  it("should mask generic Error with SQL or Network exception strings", () => {
    const error = new Error(
      "Failed to fetch: TypeError: NetworkError when attempting to fetch resource.",
    );
    const msg = getAuthErrorMessage(error);
    expect(msg).toBe(
      "Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền và thử lại.",
    );
  });

  it("should return custom fallback for unknown non-error types", () => {
    const msg = getAuthErrorMessage(null, "Thông tin không hợp lệ.");
    expect(msg).toBe("Thông tin không hợp lệ.");
  });
});
