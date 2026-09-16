import { NextResponse, type NextRequest } from "next/server";
import { esLoopback } from "./lib/loopback";

/**
 * Exposure guard.
 *
 * The dashboard has no authentication BY DESIGN: it is meant to be opened on
 * the same machine that holds the transcripts. The scripts already bind to
 * 127.0.0.1; this is the second lock. If someone starts it with another host,
 * puts it behind a tunnel or a reverse proxy, any request whose Host header is
 * not loopback gets a 403 instead of the data.
 *
 * (Next.js 16 renamed `middleware.ts` to `proxy.ts`; the behaviour is the same.)
 */
export function proxy(request: NextRequest) {
  if (!esLoopback(request.headers.get("host"))) {
    return new NextResponse("403 · this dashboard only answers on 127.0.0.1 / localhost", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
