-- ═══════════════════════════════════════════════════════════════════════
--  El índice del motor agéntico. ÚNICA fuente del esquema: 18 tablas.
--  Ninguna fuente crea tablas por su cuenta; las columnas añadidas después
--  de la primera versión viven también en `MIGRACIONES` (lector.py).
--
--  REGLA QUE MANDA SOBRE TODAS: aquí se guardan HECHOS, no CONCLUSIONES.
--  Los tokens van a la base; el dinero se calcula al leer, contra `tarifas`.
--
--  Si se guardaran dólares, el día que cambie un precio todo el histórico
--  pasaría a ser mentira. Y no es hipotético: el precio de lanzamiento de
--  Sonnet 5 ($2/$10) caduca el 31 de agosto de 2026.
-- ═══════════════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;      -- el lector escribe mientras la web lee
PRAGMA foreign_keys = ON;

-- ── el hecho central: un turno de un modelo ──────────────────────────────
CREATE TABLE IF NOT EXISTS uso (
  id              INTEGER PRIMARY KEY,
  fuente          TEXT NOT NULL,        -- claude_code | codex | hermes | openclaw
  sesion          TEXT,
  proyecto        TEXT,                 -- de cwd; en Codex, del directorio
  ts              TEXT NOT NULL,        -- ISO 8601 en UTC, SIEMPRE
  modelo          TEXT NOT NULL,
  velocidad       TEXT,                 -- standard | fast  (fast cuesta el doble)
  esfuerzo        TEXT,                 -- low | medium | high | xhigh | max
  -- Los seis contadores POR SEPARADO. Fundirlos falsea el dinero: la caché
  -- de 1 h cuesta 2× la entrada y la de 5 min 1,25×; la leída, 0,1×.
  t_entrada       INTEGER NOT NULL DEFAULT 0,
  t_salida        INTEGER NOT NULL DEFAULT 0,
  t_pensamiento   INTEGER NOT NULL DEFAULT 0,
  t_cache_lee     INTEGER NOT NULL DEFAULT 0,
  t_cache_5m      INTEGER NOT NULL DEFAULT 0,
  t_cache_1h      INTEGER NOT NULL DEFAULT 0,
  rama            TEXT,
  ref             TEXT UNIQUE           -- id del mensaje: hace la carga idempotente
);
CREATE INDEX IF NOT EXISTS ix_uso_ts      ON uso(ts);
CREATE INDEX IF NOT EXISTS ix_uso_modelo  ON uso(modelo);
CREATE INDEX IF NOT EXISTS ix_uso_sesion  ON uso(sesion);
CREATE INDEX IF NOT EXISTS ix_uso_fuente  ON uso(fuente);

-- ── el precio, con fecha y procedencia ───────────────────────────────────
-- Una cifra de dinero sin procedencia es una opinión.
CREATE TABLE IF NOT EXISTS tarifas (
  modelo          TEXT NOT NULL,
  desde           TEXT NOT NULL,        -- ISO; NULL en `hasta` = vigente
  hasta           TEXT,
  usd_entrada     REAL NOT NULL,        -- $ por millón
  usd_salida      REAL NOT NULL,
  mult_cache_lee  REAL NOT NULL DEFAULT 0.10,
  mult_cache_5m   REAL NOT NULL DEFAULT 1.25,
  mult_cache_1h   REAL NOT NULL DEFAULT 2.00,
  procedencia     TEXT NOT NULL,
  consultado_en   TEXT NOT NULL,
  PRIMARY KEY (modelo, desde)
);

-- ── sesiones: la unidad de «cuánto costó esta tarea» ─────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
  id              TEXT PRIMARY KEY,
  fuente          TEXT NOT NULL,
  inicio          TEXT,
  fin             TEXT,
  proyecto        TEXT,
  rama            TEXT,
  canal           TEXT,                 -- telegram | cli | …  (Hermes)
  modelo          TEXT,
  titulo          TEXT,                 -- el primer prompt, recortado
  mensajes        INTEGER NOT NULL DEFAULT 0
);

-- ── lo que le pediste. La tabla más sensible de la base. ─────────────────
CREATE TABLE IF NOT EXISTS prompts (
  id              INTEGER PRIMARY KEY,
  sesion          TEXT,
  fuente          TEXT NOT NULL,
  ts              TEXT NOT NULL,
  texto           TEXT NOT NULL,
  ref             TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_prompts_ts ON prompts(ts);

-- ── qué herramientas y qué skills se invocaron de verdad ─────────────────
CREATE TABLE IF NOT EXISTS invocaciones (
  id              INTEGER PRIMARY KEY,
  ts              TEXT NOT NULL,
  sesion          TEXT,
  fuente          TEXT NOT NULL,
  clase           TEXT NOT NULL,        -- herramienta | skill | agente | mcp
  nombre          TEXT NOT NULL,
  ref             TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_inv_nombre ON invocaciones(clase, nombre);
CREATE INDEX IF NOT EXISTS ix_inv_ts     ON invocaciones(ts);

-- ── lo que existe declarado, se use o no ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  clase           TEXT NOT NULL,        -- agente | skill | mcp | plugin
  nombre          TEXT NOT NULL,
  ambito          TEXT NOT NULL,        -- global | proyecto | hermes | openclaw | multiverso
  ruta            TEXT,
  descripcion     TEXT,
  modelo          TEXT,
  modificado      TEXT,
  usos            INTEGER DEFAULT 0,    -- cruzado con `invocaciones`
  ultimo_uso      TEXT,
  PRIMARY KEY (clase, nombre, ambito)
);

-- ── el sistema de memoria y su frescura ──────────────────────────────────
CREATE TABLE IF NOT EXISTS memoria (
  ruta            TEXT PRIMARY KEY,
  sistema         TEXT NOT NULL,        -- vault (MOTOR_NOTAS) | multiverso | claude-mem | hermes
  titulo          TEXT,
  modificado      TEXT,
  dias_sin_tocar  INTEGER,
  bytes           INTEGER,
  enlaces_salen   INTEGER DEFAULT 0,
  enlaces_entran  INTEGER DEFAULT 0,
  tipo            TEXT                  -- nucleo | decision | sesion | habilidad | archivo
);

-- ── las aristas del grafo de memoria ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS enlaces (
  origen          TEXT NOT NULL,
  destino         TEXT NOT NULL,
  PRIMARY KEY (origen, destino)
);

-- ── cuatro cifras sueltas que no merecen tabla propia ────────────────────
CREATE TABLE IF NOT EXISTS state_motor (clave TEXT PRIMARY KEY, valor TEXT);

-- ── el denominador del ROI ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suscripciones (
  nombre          TEXT PRIMARY KEY,
  usd_mes         REAL NOT NULL,
  cubre           TEXT NOT NULL,        -- qué fuentes paga
  desde           TEXT,
  nota            TEXT
);

-- ── dinero que sale de verdad de la cuenta ───────────────────────────────
CREATE TABLE IF NOT EXISTS gasto_real (
  proveedor       TEXT NOT NULL,
  ts              TEXT NOT NULL,
  usd             REAL NOT NULL,
  detalle         TEXT,
  PRIMARY KEY (proveedor, ts)
);

-- ── el sueño: sugiere, nunca ejecuta ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sueno (
  id              INTEGER PRIMARY KEY,
  fecha           TEXT NOT NULL,
  categoria       TEXT NOT NULL,        -- skill | memoria | modelo | coste | higiene
  titulo          TEXT NOT NULL,
  cuerpo          TEXT NOT NULL,
  evidencia       TEXT,                 -- las cifras que lo sostienen, en JSON
  accion          TEXT,                 -- lo que copiarías y pegarías
  -- nueva | resuelta | descartada. OJO: `resuelta` la pone el sueño SOLO cuando
  -- la condición deja de cumplirse (en pantalla: «ya no se cumple»). No significa
  -- que alguien aplicara la sugerencia: eso el motor no lo puede saber.
  estado          TEXT NOT NULL DEFAULT 'nueva',
  huella          TEXT UNIQUE,          -- para no repetir mañana lo mismo
  origen          TEXT DEFAULT 'medido', -- medido (contadores) | leído (conversaciones)
  gancho          TEXT                  -- dos palabras en imperativo, derivadas de la huella
);

-- ── el incremental: cuánto se leyó ya de cada archivo ────────────────────
CREATE TABLE IF NOT EXISTS lectura (
  ruta            TEXT PRIMARY KEY,
  inode           INTEGER,              -- si cambia, el archivo se recreó: releer entero
  bytes_leidos    INTEGER NOT NULL DEFAULT 0,
  mtime           REAL,
  ultima          TEXT
);

-- ── la salud del propio lector ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salud (
  fuente          TEXT PRIMARY KEY,
  ultima_ok       TEXT,
  ultima_intento  TEXT,
  ms              INTEGER,
  filas           INTEGER,
  error           TEXT,                 -- falló de verdad
  nota            TEXT                  -- funcionó, pero hay algo que decir
);

-- ── lo que va a correr sin ti: una foto, no un histórico (fuentes/cron.py) ─
CREATE TABLE IF NOT EXISTS programado (
  id              TEXT PRIMARY KEY,
  motor           TEXT NOT NULL,        -- launchd | hermes
  nombre          TEXT NOT NULL,
  cuando          TEXT,
  siguiente       TEXT,
  activo          INTEGER NOT NULL DEFAULT 0,
  detalle         TEXT
);

-- ── lo que tienes enchufado (fuentes/conexiones.py) ──────────────────────
CREATE TABLE IF NOT EXISTS conexiones (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  via             TEXT NOT NULL,        -- conector | mcp
  marca           TEXT,
  detalle         TEXT,
  estado          TEXT NOT NULL,
  origen          TEXT,
  usos            INTEGER DEFAULT 0,
  ultimo_uso      TEXT
);

-- ── el plan contratado, clave → valor (fuentes/plan.py) ──────────────────
CREATE TABLE IF NOT EXISTS plan (clave TEXT PRIMARY KEY, valor TEXT);

-- ── cada vez que la API dijo que no (fuentes/plan.py) ────────────────────
CREATE TABLE IF NOT EXISTS topes (
  ts              TEXT PRIMARY KEY,
  tipo            TEXT,
  ventana         TEXT,
  reset_ts        TEXT,
  extra_estado    TEXT,
  extra_motivo    TEXT,
  sesion          TEXT
);
