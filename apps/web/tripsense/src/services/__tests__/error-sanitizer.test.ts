import { describe, it, expect } from "vitest";
import {
  isSensitiveErrorMessage,
  sanitizeErrorMessage,
  sanitizeErrorData,
  getSafeErrorMessage,
} from "../error-sanitizer";

describe("Frontend Error Sanitizer", () => {
  it("detects raw SQL queries and JDBC exceptions", () => {
    const rawSql =
      "JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16] [select u1_0.id,u1_0.auth_provider from users]";
    expect(isSensitiveErrorMessage(rawSql)).toBe(true);
  });

  it("detects Spring Framework and NullPointer exceptions", () => {
    const springTrace =
      "org.springframework.dao.InvalidDataAccessResourceUsageException: JDBC exception";
    expect(isSensitiveErrorMessage(springTrace)).toBe(true);

    const npe =
      "java.lang.NullPointerException at com.tripsense.service.TripService.find(TripService.java:42)";
    expect(isSensitiveErrorMessage(npe)).toBe(true);
  });

  it("does not flag normal user validation errors as sensitive", () => {
    expect(isSensitiveErrorMessage("Email hoặc mật khẩu không chính xác")).toBe(
      false,
    );
    expect(isSensitiveErrorMessage("Tên chuyến đi không được để trống")).toBe(
      false,
    );
    expect(isSensitiveErrorMessage("Invalid username or password")).toBe(false);
  });

  it("scrubs sensitive error message and attaches incident reference code", () => {
    const rawSql =
      "JDBC exception executing SQL [ERROR: column u1_0.auth_provider does not exist Position: 16]";
    const result = sanitizeErrorMessage(rawSql, 500, "ERR-TEST123");

    expect(result.isSanitized).toBe(true);
    expect(result.incidentRef).toBe("ERR-TEST123");
    expect(result.message).toContain(
      "Hệ thống đang bận hoặc gián đoạn kết nối",
    );
    expect(result.message).toContain("(Mã tham chiếu: ERR-TEST123)");
    expect(result.message).not.toContain("SQL");
    expect(result.message).not.toContain("u1_0.auth_provider");
  });

  it("preserves 400 validation messages that do not contain technical keywords", () => {
    const result = sanitizeErrorMessage("Email này đã được sử dụng", 400);
    expect(result.isSanitized).toBe(false);
    expect(result.message).toBe("Email này đã được sử dụng");
  });

  it("scrubs HTTP 500 error messages even if they look generic", () => {
    const result = sanitizeErrorMessage(
      "Internal Server Error",
      500,
      "ERR-500TEST",
    );
    expect(result.isSanitized).toBe(true);
    expect(result.message).toContain("Hệ thống đang bận");
    expect(result.message).toContain("ERR-500TEST");
  });

  it("recursively scrubs stackTrace, sql, and query fields from response data", () => {
    const rawPayload = {
      timestamp: "2026-09-22T07:23:30.755Z",
      status: 500,
      error: "Internal Server Error",
      message: "JDBC exception executing SQL [select * from users]",
      stackTrace: ["at org.springframework...", "at java.base..."],
      sql: "select * from users where id = 1",
      meta: {
        trace: "nested-trace",
        serviceName: "user-service",
      },
    };

    const cleaned = sanitizeErrorData(rawPayload, 500) as Record<string, any>;

    expect(cleaned.stackTrace).toBeUndefined();
    expect(cleaned.sql).toBeUndefined();
    expect(cleaned.meta.trace).toBeUndefined();
    expect(cleaned.meta.serviceName).toBe("user-service");
    expect(cleaned.message).not.toContain("JDBC");
  });

  it("getSafeErrorMessage extracts safe message from any error object", () => {
    const errorObj = {
      message: "org.springframework.dao.DataAccessException: syntax error",
      status: 500,
    };
    const message = getSafeErrorMessage(errorObj);
    expect(message).toContain("Hệ thống đang bận");
    expect(message).not.toContain("DataAccessException");
  });
});
