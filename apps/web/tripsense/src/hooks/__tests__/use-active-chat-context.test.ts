import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/auth";
import * as apiClient from "@/services/api-client";
import {
  buildChatRequestBody,
  chatAuthenticatedFetch,
  isJwtExpired,
} from "../use-active-chat";

function makeJwt(expOffsetSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }),
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("use-active-chat trip context & token refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
      user: null,
      status: "unauthenticated",
    });
  });

  it("buildChatRequestBody includes tripId and tripPreferences when present", () => {
    const body = buildChatRequestBody({
      chatId: "chat-123",
      lastMessage: { role: "user", parts: [{ type: "text", text: "Lên kế hoạch đi du lịch" }] },
      modelId: "gemini-3.5-flash-lite",
      hint: {
        tripId: "trip-dn-1",
        tripPreferences: {
          where: { location: "Đà Nẵng", isRoadTrip: false },
          when: { type: "flexible", durationDays: 3, flexibleMonths: ["Tháng 1"] },
        },
      },
    });

    expect(body).toMatchObject({
      id: "chat-123",
      chatId: "chat-123",
      tripId: "trip-dn-1",
      tripPreferences: {
        where: { location: "Đà Nẵng", isRoadTrip: false },
        when: { type: "flexible", durationDays: 3, flexibleMonths: ["Tháng 1"] },
      },
    });
  });

  it("buildChatRequestBody omits empty tripPreferences and null tripId", () => {
    const body = buildChatRequestBody({
      chatId: "chat-123",
      lastMessage: { role: "user", parts: [{ type: "text", text: "Xin chào" }] },
      modelId: "gemini-3.5-flash-lite",
      hint: {
        tripId: null,
        tripPreferences: {},
      },
    });

    expect("tripId" in body).toBe(false);
    expect("tripPreferences" in body).toBe(false);
  });

  it("isJwtExpired detects expired and valid JWT tokens", () => {
    expect(isJwtExpired(makeJwt(-10))).toBe(true);
    expect(isJwtExpired(makeJwt(10))).toBe(true); // within 30s skew
    expect(isJwtExpired(makeJwt(300))).toBe(false);
    expect(isJwtExpired("malformed")).toBe(true);
  });

  it("chatAuthenticatedFetch refreshes expired token before calling authenticatedFetch", async () => {
    useAuthStore.setState({
      accessToken: makeJwt(-60),
      isAuthenticated: true,
      status: "authenticated",
    });

    const refreshSpy = vi
      .spyOn(apiClient, "requestRefreshToken")
      .mockResolvedValue({
        success: true,
        message: "ok",
        data: { accessToken: makeJwt(600) },
      } as Awaited<ReturnType<typeof apiClient.requestRefreshToken>>);
    const fetchSpy = vi
      .spyOn(apiClient, "authenticatedFetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await chatAuthenticatedFetch("http://localhost:8089/api/chat", { method: "POST" });

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8089/api/chat", { method: "POST" });
  });
});
