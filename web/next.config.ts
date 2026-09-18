import type { NextConfig } from "next";

/**
 * The motor is NEVER deployed. It has your transcripts and your prompts in
 * front of it, and it has no authentication by design. It lives on 127.0.0.1
 * and stays there: `-H 127.0.0.1` in the scripts and `src/proxy.ts` answers
 * 403 to any Host that is not loopback.
 */
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /**
   * Next's disc in the bottom-left corner.
   *
   * It lands right on top of the sidebar's footer and covered its notice on
   * every route. It is not a sidebar bug; it is a piece of scaffolding in the picture.
   */
  devIndicators: false,
};
export default nextConfig;
