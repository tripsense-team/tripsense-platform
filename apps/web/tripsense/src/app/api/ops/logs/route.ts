import { NextRequest, NextResponse } from "next/server";

const gatewayUrl = (process.env.API_GATEWAY_URL || "http://localhost:8080").replace(/\/$/, "");

/** Same-origin BFF route for the admin logs page. The Gateway remains the only log owner. */
export async function GET(request: NextRequest) {
  const target = `${gatewayUrl}/api/ops/logs${request.nextUrl.search}`;
  try {
    const response = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization") as string }
          : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    const body = await response.text();
    // A stale/unconfigured Gateway may still answer 404. Keep that provider detail
    // out of the browser contract; the admin page should show an unavailable state.
    const status = response.status === 404 ? 503 : response.status;
    const safeBody = response.status === 404
      ? JSON.stringify({ success: false, code: "OBSERVABILITY_UNAVAILABLE" })
      : body;
    return new NextResponse(safeBody, {
      status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json(
      { success: false, code: "OBSERVABILITY_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
