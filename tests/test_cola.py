"""Incremental reading: byte offset, half-written lines, rotation by inode."""
from __future__ import annotations

import os

from comun import Cola


def leer(cola, ruta):
    return [linea.decode() for linea in cola.nuevo(ruta)]


def test_offset_only_returns_new_lines(cx, tmp_path):
    ruta = tmp_path / "t.jsonl"
    ruta.write_text("uno\ndos\n")
    cola = Cola(cx)
    assert leer(cola, ruta) == ["uno", "dos"]
    assert leer(cola, ruta) == []                      # nothing new, nothing read
    with ruta.open("a") as f:
        f.write("tres\n")
    assert leer(cola, ruta) == ["tres"]


def test_half_written_line_waits_for_next_pass(cx, tmp_path):
    ruta = tmp_path / "t.jsonl"
    ruta.write_text('{"a": 1}\n{"b": ')              # second line still being written
    cola = Cola(cx)
    assert leer(cola, ruta) == ['{"a": 1}']
    with ruta.open("a") as f:
        f.write("2}\n")
    assert leer(cola, ruta) == ['{"b": 2}']


def test_rotation_with_new_inode_rereads_from_zero(cx, tmp_path):
    ruta = tmp_path / "t.jsonl"
    ruta.write_text("viejo-1\nviejo-2\n")
    cola = Cola(cx)
    assert leer(cola, ruta) == ["viejo-1", "viejo-2"]
    inode_antes = ruta.stat().st_ino

    # Same path, new file, and LONGER than the old offset: a size check alone
    # would seek into the middle of it and return garbage.
    nuevo = tmp_path / "t.jsonl.tmp"
    nuevo.write_text("nuevo-1\nnuevo-2\nnuevo-3\n")
    os.replace(nuevo, ruta)
    assert ruta.stat().st_ino != inode_antes

    assert leer(cola, ruta) == ["nuevo-1", "nuevo-2", "nuevo-3"]


def test_truncated_file_is_reread(cx, tmp_path):
    ruta = tmp_path / "t.jsonl"
    ruta.write_text("aaaaaaaaaa\nbbbbbbbbbb\n")
    cola = Cola(cx)
    leer(cola, ruta)
    ruta.write_text("c\n")                             # same inode, smaller than the offset
    assert leer(cola, ruta) == ["c"]


def test_marks_keep_independent_cursors(cx, tmp_path):
    ruta = tmp_path / "t.jsonl"
    ruta.write_text("x\n")
    assert leer(Cola(cx), ruta) == ["x"]
    assert leer(Cola(cx, marca="plan::"), ruta) == ["x"]   # not swallowed by the first cursor
