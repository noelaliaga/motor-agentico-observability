/**
 * Is this Host header a loopback address?
 *
 * Accepts `127.0.0.1`, any `127.x.y.z`, `localhost` and `[::1]`, with or
 * without a port. Anything else — a LAN address, a tunnel domain, an empty
 * header — is not loopback. Kept free of Next imports so it can be unit-tested
 * with plain `node --test`.
 */
export function isLoopback(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  let name: string;
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    if (end < 0) return false;
    name = h.slice(1, end);
    const rest = h.slice(end + 1);
    if (rest && !/^:\d+$/.test(rest)) return false;
  } else {
    const parts = h.split(":");
    if (parts.length > 2) return false;
    if (parts.length === 2 && !/^\d+$/.test(parts[1])) return false;
    name = parts[0];
  }
  if (name === "localhost" || name === "::1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name);
}

/** Is this client address (from X-Forwarded-For, X-Real-IP, Forwarded `for=`) loopback? */
export function isLoopbackIp(ip: string): boolean {
  let x = ip.trim().toLowerCase().replace(/^"|"$/g, "");
  if (x.startsWith("[")) x = x.slice(1, x.indexOf("]") >= 0 ? x.indexOf("]") : undefined);
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(x)) x = x.split(":")[0];
  if (x.startsWith("::ffff:")) x = x.slice(7);
  return x === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(x);
}

/**
 * Should this request be answered?
 *
 * The Host header must be loopback, and every forwarding header present must
 * point to loopback too. Next.js itself fills `x-forwarded-host` and
 * `x-forwarded-for` (with the socket address) when they are missing, so their
 * mere presence proves nothing; a proxy or tunnel relaying a remote client,
 * however, leaves that client's address or public host in them.
 *
 * This is a second lock against DNS rebinding and naive tunnels/proxies; it is
 * NOT authentication. A proxy that rewrites Host and strips forwarding
 * headers, or a LAN client that forges `Host: localhost` against a server
 * bound to 0.0.0.0, still gets in. The real boundary is binding to 127.0.0.1.
 */
export function isLocalRequest(headers: { get(name: string): string | null }): boolean {
  if (!isLoopback(headers.get("host"))) return false;
  const xfh = headers.get("x-forwarded-host");
  if (xfh && !xfh.split(",").every((h) => isLoopback(h))) return false;
  for (const c of ["x-forwarded-for", "x-real-ip"]) {
    const v = headers.get(c);
    if (v && !v.split(",").every((ip) => isLoopbackIp(ip))) return false;
  }
  const fwd = headers.get("forwarded");
  if (fwd) {
    for (const part of fwd.split(/[,;]/)) {
      const [k, ...rest] = part.split("=");
      const key = k.trim().toLowerCase();
      const value = rest.join("=");
      if (key === "for" && !isLoopbackIp(value)) return false;
      if (key === "host" && !isLoopback(value.replace(/"/g, ""))) return false;
    }
  }
  return true;
}
