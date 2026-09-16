import type { NextConfig } from "next";

/**
 * El motor NUNCA se despliega. Tiene delante tus transcripciones y tus prompts,
 * y no tiene autenticación por diseño. Vive en 127.0.0.1 y ahí se queda:
 * `-H 127.0.0.1` en los scripts y `src/proxy.ts` responde 403 a cualquier Host
 * que no sea loopback.
 */
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /**
   * El disco de Next en la esquina inferior izquierda.
   *
   * Cae justo encima del pie de la barra lateral y tapaba su aviso en todas las
   * rutas. No es un fallo de la barra; es una pieza del andamio metida en la foto.
   */
  devIndicators: false,
};
export default nextConfig;
