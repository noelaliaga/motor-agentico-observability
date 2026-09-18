import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest } from "./lib/loopback";

/**
 * Exposure guard — a second lock, not the boundary.
 *
 * The dashboard has no authentication BY DESIGN: it is meant to be opened on
 * the same machine that holds the transcripts. The real boundary is that the
 * scripts bind to 127.0.0.1. This guard returns 403 when the Host header is
 * not loopback (DNS rebinding, tunnels that keep the original Host) or when a
 * forwarding header (X-Forwarded-For, X-Forwarded-Host, Forwarded, X-Real-IP)
 * names a non-loopback client or host, which is what a proxy relaying a
 * remote visitor leaves behind. (Next.js fills some of these itself with
 * loopback values for direct requests, so presence alone is not the test.)
 *
 * What it does NOT stop: a reverse proxy that rewrites Host to 127.0.0.1 and
 * strips those headers, or a LAN client sending `Host: localhost` to a server
 * started with `-H 0.0.0.0`. Headers are client-controlled; don't rely on this
 * to expose the dashboard.
 *
 * (Next.js 16 renamed `middleware.ts` to `proxy.ts`; the behaviour is the same.)
 */
export function proxy(request: NextRequest) {
  if (!isLocalRequest(request.headers)) {
    return new NextResponse("403 · this dashboard only answers direct requests on 127.0.0.1 / localhost", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
