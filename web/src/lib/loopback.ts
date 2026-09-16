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
