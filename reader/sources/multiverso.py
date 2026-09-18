"""
MULTIVERSO · OPTIONAL adapter.

It reads an already generated index of "universes" (the format produced by
the public `multiverso-context-engine` repo: `data/manifest.json` plus one JSON
per universe with its nodes). Nothing is recomputed here: the manifest is read
and the nodes are stored as memory, which feeds the Memory section.

"multiverso" is the name of that external project, so it is kept as is (module,
source name and MOTOR_MULTIVERSO). The node keys `nodos` and `ruta` below
belong to that external format and are not translated either.

It only runs if `MOTOR_MULTIVERSO` points at the root of that index. Without
the variable, the reader does not even try: not having it is not a failure.
"""
from __future__ import annotations

import json
import time

from common import PATHS, record_health, shorten

SOURCE = "multiverso"


def read(cx) -> int:
    t0, n = time.time(), 0
    if PATHS["multiverso"] is None:
        return 0
    data = PATHS["multiverso"] / "data"
    man = data / "manifest.json"
    if not man.exists():
        record_health(cx, SOURCE, 0, 0, f"{shorten(man)} does not exist")
        return 0

    d = json.loads(man.read_text())
    for u in d.get("universes", []):
        st = u.get("stats") or {}
        cx.execute(
            """INSERT INTO inventory (kind,name,scope,path,description,modified,uses)
               VALUES ('universe',?, 'multiverso', ?, ?, ?, ?)
               ON CONFLICT(kind,name,scope) DO UPDATE SET
                 description=excluded.description, uses=excluded.uses,
                 modified=excluded.modified""",
            (u.get("name") or u.get("id"), shorten(data / f"{u.get('id')}.json"),
             (u.get("sub") or u.get("tagline") or "")[:400],
             d.get("generated"), st.get("nodes") or 0),
        )
        n += 1

        # The universe's nodes, as memory files with their links.
        f = data / f"{u.get('id')}.json"
        if not f.exists():
            continue
        try:
            uni = json.loads(f.read_text())
        except Exception:
            continue
        nodes = uni.get("nodes") or uni.get("nodos") or []
        if isinstance(nodes, dict):
            nodes = list(nodes.values())
        for nd in nodes[:4000]:
            if not isinstance(nd, dict):
                continue
            path = nd.get("path") or nd.get("ruta") or nd.get("id")
            if not path:
                continue
            cx.execute(
                """INSERT INTO memory (path,system,title,modified,bytes,links_out)
                   VALUES (?, 'multiverso', ?, ?, ?, ?)
                   ON CONFLICT(path) DO UPDATE SET
                     title=excluded.title, modified=excluded.modified""",
                (str(path), (nd.get("label") or nd.get("name") or "")[:200],
                 nd.get("mtime") or nd.get("modified"), nd.get("size") or 0,
                 len(nd.get("links") or nd.get("children") or [])),
            )
            n += 1
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None)
    return n
