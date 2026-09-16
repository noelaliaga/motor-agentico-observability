# Sistema visual · Motor Agéntico

> Documento interno de diseño, en español como el código. Resumen en inglés en el README.

Cinco minutos de lectura. Si vas a tocar una pantalla, lee esto entero antes.

## Identidad

**Un solo acento de interfaz, el cian `#22D3EE`**, sobre fondos casi negros de tinte frío. La referencia dorada de la
que venimos aportó su **composición** (corchetes, micro-rótulos mono, cabecera
de terminal, cielos con constelaciones), nunca su color.

Sobre ese acento único hay ahora dos capas de color más, cada una con su regla:

1. **Tinte de sección** (`TONO_SECCION` en `Piezas.tsx`): cada pantalla tiene un
   color semántico — el sueño violeta, la memoria verde, el dinero ámbar, las
   conexiones cian. Tiñe el héroe y las piezas que presiden ESA pantalla, nada
   más. No es un tema: la interfaz sigue siendo cian.
2. **Tinte de marca** (`TINTE` en `Marcas.tsx`): Claude es coral, OpenAI verde,
   Obsidian violeta. La regla del acento único manda sobre la interfaz, no
   sobre logotipos ajenos — pintar a Claude de cian sería inventarle una
   identidad que no tiene. Las marcas monocromas (Notion, Resend, Ollama) van
   en hueso, no con un color falso.

Un tinte **nunca colorea texto largo**: a ese tamaño el contraste no está
garantizado. Tiñe fondos (degradado sutil), bordes, logos y sellos.

## Tokens

| rol | valor | para qué |
|---|---|---|
| `--pozo` | `#05070A` | el fondo de todo |
| `--suelo` | `#07090B` | la barra lateral |
| `--carta` | `#0C1116` | superficie de contenido |
| `--carta-alta` | `#111820` | superficie elevada, chips, azulejos |
| `--ambar` | `#22D3EE` | el acento (el nombre es herencia; el color es cian) |
| `--gasto` | `#FBBF24` | dinero que sale · sección dinero, **y ninguna otra** |
| `--ahorro` | `#34D399` | dinero que se queda · correcto · sección memoria |
| `--alerta` | `#FB7185` | facturado de verdad · error · límites al 92 % |
| `--sueno` | `#A78BFA` | ejecutando · la sección del sueño |
| `--texto` | `#F3F5F7` | 17:1 sobre el pozo |
| `--texto-2` | `#93A3B0` | 7,5:1 — cuerpo secundario |
| `--texto-3` | `#6E7D8A` | 4,6:1 — el mínimo que sigue siendo texto |

Los tintes de marca no son tokens CSS: viven en `TINTE` (`Marcas.tsx`) porque
son datos de marca, no decisiones de tema. Las piezas los reciben por la
custom property `--tinte`, que ponen los componentes — nadie la escribe a mano.

## Las piezas y cuándo se usa cada una

Todo vive en `src/componentes/Piezas.tsx`, salvo la Constelación, que tiene
archivo propio (`Constelacion.tsx`) porque es código generativo — geometría
con semilla, nada que ver con las piezas de datos. Decisión tomada para no
inflar Piezas.tsx con 100 líneas de PRNG; si Piezas vuelve a crecer, el
siguiente corte natural es separar los formateadores (`usd`, `tok`, `hace`…).

| pieza | qué es | la regla |
|---|---|---|
| `Seccion` | EL encabezado de sección: epígrafe · título · nota, con la meta en la línea del título | uno solo para las diez pantallas. Anatomía y reglas, en «La costura final» más abajo. |
| `Rotulo` | la etiqueta mono pequeña de DENTRO de una tarjeta | ya **no** es un encabezado: si encabeza una `<section>`, la pieza es `Seccion`. |
| `Tarjeta` | superficie con `tinte`, `seleccionada`, `marco`, `href` | el tinte es un degradado sutilísimo de esquina, no un fondo de color. `seleccionada` es el estado fuerte (se llena del tinte, como la tarjeta violeta de Obsidian en la referencia): **una por grupo**. `marco` (corchetes) sólo en las 2-3 piezas que presiden una pantalla. |
| `Carta` | la superficie clásica | sigue existiendo; `Tarjeta` es su superconjunto. Código nuevo usa `Tarjeta`. |
| `Azulejo` | el cuadrado redondeado con el logo de una marca y su tinte | `vivo=false` lo apaga entero — una conexión sin configurar se ve gris, no con su color de fiesta. |
| `Insignia` | sello rectangular (`LAUNCHAGENT`, badge de categoría) | clasifica. No respira. |
| `Pastilla` | píldora de estado (`EN VIVO`, `ACTIVA`) | `late` añade el punto que respira, y sólo para lo que pasa AHORA. Una pastilla que late en cuarenta sitios no late en ninguno. |
| `Medidor` | donut con el porcentaje al centro | sin techo conocido, el anillo queda abierto y dice «—»: jamás un porcentaje inventado. Etiquetas de una palabra: el círculo mide 74 px. |
| `BarraLimite` | «LÍMITE 5H · 25 / 900» con barra | tres verdades, tres dibujos: proporción si hay techo; barra vacía + «sin techo público» si no lo hay; `SinDato` si ni el uso se conoce. Desde el 92 % se pinta en `--alerta` sola. |
| `Rail` | fila de tarjetas de acción con icono, título, nota y flecha | el «atención ahora». Máximo 4; con más, es una lista, no un rail. |
| `Constelacion` | campo de estrellas + constelaciones para héroes de sección | **determinista por semilla** (mulberry32): el servidor y el cliente pintan el mismo cielo y React no protesta. `Math.random()` en render está prohibido en todo el proyecto por esta misma razón. Se tiñe con el tono de la sección. |
| `SinDato` | «sin dato» en línea, subrayado a trazos, motivo en el title | el hueco de UNA cifra. `Vacio` sigue siendo el de secciones enteras. |

## Honestidad antes que completitud

La regla de PRODUCT.md manda sobre cualquier decisión visual. Ninguna pieza
acepta un cero como sustituto de «no lo sé»: `Medidor` admite `parte=null`,
`BarraLimite` admite `usado=null` y `techo=null`, y `SinDato` existe para el
hueco en línea. Si estás a punto de pasar un `0` que en realidad es un «no hay
dato», estás usando la pieza equivocada.

## Lo que este panel NO hace

- **Rótulo en versales SUELTO sobre cada sección.** La muletilla de la IA de
  2026: una etiqueta pequeña repetida diez veces no jerarquiza, hace ruido
  uniforme. Matizado en la costura de agosto: el epígrafe sigue prohibido
  **como titular**, pero sí existe como primera línea de `Seccion`, encima de
  un título de verdad y con el punto de color de la sección. Lo que separa una
  cosa de la otra es que aquí el epígrafe nunca va solo: si borras el título de
  19 px y dejas las versales haciendo de encabezado, has vuelto a la muletilla.
  Las versales mono, por su cuenta, siguen siendo para datos y sellos.
- **Tarjetas dentro de tarjetas.** Nunca.
- **Rejillas de tarjetas idénticas** cuando una tabla dice más.
- **Tintes a texto largo, ni tinte sin motivo.** El color siempre significa:
  una marca, una sección, un estado.
- **Movimiento decorativo.** Lo único que se mueve solo: el grafo mientras
  ordena, el punto `late` de lo que está vivo, y el titileo de unas pocas
  estrellas — los tres se apagan con `prefers-reduced-motion`.

## Motion y accesibilidad

- 150–250 ms, `ease-out`. La transición comunica un cambio de estado y ya.
- Hover sólo bajo `@media (hover: hover) and (pointer: fine)`.
- Pisada de tarjeta-enlace: `scale(.985)` en `:active`, anulada con
  `prefers-reduced-motion`.
- `:focus-visible` global en cian: se navega con teclado o no se navega.
- Contraste AA en todo texto: `--texto-3` (4,6:1) es el suelo. Los tintes de
  marca no bajan de ahí porque nunca se aplican a texto corrido.

## Tipografía

Una familia para la interfaz (`ui-sans-serif`/SF Pro) y **mono para todo lo que
es un dato**: cifras, rutas, horarios, sellos. No es decorativo — distingue lo
que se lee de lo que se comprueba. Escala fija en rem, razón ~1.2, sin
`clamp()`: se mira siempre en el mismo portátil.

## La sala de muestras (retirada)

Existió una página temporal con todas las piezas juntas. No forma parte de
esta copia pública: las pantallas reales ya adoptaron las piezas.

---

# La costura final (24 de agosto de 2026)

Cinco agentes rediseñaron las cinco zonas por separado y cada una llegó con su
propio dialecto. Esta sección es lo que se unificó después, y es **normativo**:
si vas a añadir una pantalla, cópiala de aquí y no inventes una sexta manera.

## Un solo encabezado de sección

Había cuatro formas de titular: un rótulo mono, un `/ Título`, una insignia con
un `<h2>` al lado y un título en minúscula. Ahora hay una, `Seccion`, y su
anatomía no cambia de pantalla a pantalla:

```
· EPÍGRAFE                                            meta a la derecha
[insignia] Título de la sección
El párrafo de dos líneas que dice qué es esto y de dónde sale.
```

| parte | prop | regla |
|---|---|---|
| epígrafe | `epigrafe` | mono en versales con el punto del **tinte de la sección**. Opcional, pero nunca va solo. |
| insignia | `insignia` | sólo cuando la sección **es** una categoría (una vía en /conexiones, un ámbito en /skills). |
| título | `children` | 19 px, `font-light`, `tracking-tight`. Frase en mayúscula inicial y **sin punto final**: es un rótulo, no una oración. |
| nota | `nota` | 12 px, `--texto-3`, máximo dos líneas. Explica el dato, no lo repite. |
| meta | `meta` | va en la **línea del título**, no al pie del bloque. String → se envuelve en `.rotulo` solo; cualquier otra cosa se pinta tal cual (una `Insignia`, una `Pastilla`, la caja del ROI). Si pasas JSX y quieres el aspecto de rótulo, pon tú el `<span className="rotulo">`. |

`Seccion` acepta `nivel` por compatibilidad con las llamadas viejas y lo ignora.
No hay dos tamaños de encabezado: hay uno.

**`Rotulo` ya no es un encabezado.** Antes reenviaba a `Seccion` y por eso las
etiquetas de dentro de una tarjeta salían a 15 px compitiendo con el título de
la sección que las contenía. Ahora es lo que dice ser: la etiqueta mono pequeña
de DENTRO de una tarjeta («por día», «por modelo», «qué tienes montado»). La
regla es de sitio, no de gusto:

- ¿está dentro de una `Carta`/`Tarjeta`? → `Rotulo`.
- ¿encabeza una `<section>` entera? → `Seccion`.

## Las cinco familias de color de sección

`TONO_SECCION` no son nueve colores sueltos: son cinco familias, y las
secciones que cuentan lo mismo comparten tinte **a propósito**.

| familia | color | secciones |
|---|---|---|
| cian | `#22D3EE` | inicio · conexiones |
| ámbar | `#FBBF24` | dinero, **y sólo dinero** |
| azul | `#38BDF8` | herramientas · actividad |
| aguamarina | `#5EEAD4` | skills · inventario |
| verde | `#34D399` | memoria |
| violeta | `#A78BFA` | sueño |

`skills` estaba en ámbar, que en esta casa significa dinero: leía como una
tercera pantalla de gasto y arrastraba a /skills entero al dorado de la
referencia, que es justo lo que se quería evitar. Skills es un catálogo de
lo que tienes, igual que inventario, y ahora se ve. **Antes de dar un color
nuevo a una sección, mira si encaja en una familia que ya existe.**

## La barra lateral es la leyenda del color

La entrada activa se llena del tinte de **su** sección, no de un cian fijo, así
que la barra enseña el código de color sin gastar una línea en explicarlo:
entras en Memoria y la pastilla es verde, la misma verde del héroe que estás
mirando. El orden de la lista es el de las familias, de modo que bajar por la
barra es recorrer la escala.

Las dos máquinas (`Asistente`) se llenan igual, con su color de marca —oro para
Hermes, rosa para OpenClaw—. Antes su único aviso de «estás aquí» era un borde
un punto más claro, invisible al lado de las nueve pastillas llenas, y en
`/maquinas/…` la barra parecía no tener sitio activo ninguno.

Texto de la pastilla activa: `#080C10`. Los seis tintes son claros, así que el
contraste sobra en los seis.

## La cabecera mide siempre lo mismo

`Cabecera` es **una fila de 54 px que no envuelve**. Con `flex-wrap` medía 52 px
en `/` y en `/sueno` pero 78 px en las rutas de nombre largo (`/conexiones`,
`/herramientas`, `/maquinas/…`), así que el héroe de cada pantalla arrancaba a
una altura distinta — la costura más visible de las diez al pasarlas seguidas.

Lo que no cabe se retira por orden inverso de importancia, nunca empujando una
segunda línea:

| elemento | desde |
|---|---|
| frescura del índice | siempre — es el antídoto contra enseñar números de ayer |
| buscador | siempre |
| racha | `xl` |
| rango de fechas | `2xl` |

## Los héroes

Las nueve pantallas con héroe usan `Heroe` (o `HeroeCatalogo` sobre él). Ninguno
se maqueta a mano: `Heroe` redefine `--ambar` con el tinte de la sección dentro
de la tarjeta, y de ahí salen los corchetes teñidos. El del sueño era el único
hecho a pelo y por eso sus corchetes salían cian sobre un héroe violeta.

El epígrafe del héroe es una `Insignia` del color de la sección, con el `meta`
en `.rotulo` al lado. Siempre esa pareja, en ese orden.

## El disco de Next

`devIndicators: false` en `next.config.ts`. El panel no se despliega nunca y
se usa a diario en local, así que el indicador de la esquina inferior izquierda
no es una molestia pasajera: es permanente, y cae justo encima del pie de la
barra lateral tapando su aviso de privacidad en todas las rutas. Si algún día alguien lo ve tapado otra vez, es que se revirtió esto.
