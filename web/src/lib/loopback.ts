/**
 * Is this Host header a loopback address?
 *
 * Accepts `127.0.0.1`, any `127.x.y.z`, `localhost` and `[::1]`, with or
 * without a port. Anything else — a LAN address, a tunnel domain, an empty
 * header — is not loopback. Kept free of Next imports so it can be unit-tested
 * with plain `node --test`.
 */
export function esLoopback(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  let nombre: string;
  if (h.startsWith("[")) {
    const fin = h.indexOf("]");
    if (fin < 0) return false;
    nombre = h.slice(1, fin);
    const resto = h.slice(fin + 1);
    if (resto && !/^:\d+$/.test(resto)) return false;
  } else {
    const partes = h.split(":");
    if (partes.length > 2) return false;
    if (partes.length === 2 && !/^\d+$/.test(partes[1])) return false;
    nombre = partes[0];
  }
  if (nombre === "localhost" || nombre === "::1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(nombre);
}

/** Is this client address (from X-Forwarded-For, X-Real-IP, Forwarded `for=`) loopback? */
export function ipLoopback(ip: string): boolean {
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
export function peticionLocal(cabeceras: { get(nombre: string): string | null }): boolean {
  if (!esLoopback(cabeceras.get("host"))) return false;
  const xfh = cabeceras.get("x-forwarded-host");
  if (xfh && !xfh.split(",").every((h) => esLoopback(h))) return false;
  for (const c of ["x-forwarded-for", "x-real-ip"]) {
    const v = cabeceras.get(c);
    if (v && !v.split(",").every((ip) => ipLoopback(ip))) return false;
  }
  const fwd = cabeceras.get("forwarded");
  if (fwd) {
    for (const parte of fwd.split(/[,;]/)) {
      const [k, ...resto] = parte.split("=");
      const clave = k.trim().toLowerCase();
      const valor = resto.join("=");
      if (clave === "for" && !ipLoopback(valor)) return false;
      if (clave === "host" && !esLoopback(valor.replace(/"/g, ""))) return false;
    }
  }
  return true;
}
