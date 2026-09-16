/**
 * El mosaico de la desproporción.
 *
 * Un cuadrado por unidad: los encendidos llevan el color que se le pase, los
 * demás quedan en penumbra. Cuenta con el cuerpo lo que una cifra sola no
 * cuenta — 16 de 274 se LEE distinto cuando se ven los 258 cuadrados a
 * oscuras. Server-safe: son spans, sin canvas ni estado.
 *
 * `tope` corta el dibujo si algún día el total se dispara: un mosaico de
 * cinco mil celdas ya no cuenta nada, sólo pesa.
 */
export function Mosaico({
  total, vivos, color = "var(--ambar)", etiqueta, tope = 800,
}: {
  total: number; vivos: number; color?: string; etiqueta?: string; tope?: number;
}) {
  const n = Math.max(0, Math.min(total, tope));
  const v = Math.max(0, Math.min(vivos, n));
  return (
    <div
      role="img"
      aria-label={etiqueta ?? `${vivos} encendidas de ${total}`}
      className="flex flex-wrap content-start items-end"
      style={{ gap: 3 }}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: 8, height: 8, borderRadius: 2,
            background: i < v ? color : "rgb(255 255 255 / .06)",
            boxShadow: i < v ? `0 0 7px color-mix(in oklab, ${color} 45%, transparent)` : undefined,
          }}
        />
      ))}
      {total > n ? (
        <span className="rotulo ml-1.5">+{(total - n).toLocaleString("es-ES")} más</span>
      ) : null}
    </div>
  );
}
