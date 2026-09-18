"""Incremental reading: byte offset, half-written lines, rotation by inode."""
from __future__ import annotations

import os

from common import Tail


def read(tail, path):
    return [line.decode() for line in tail.new_lines(path)]


def test_offset_only_returns_new_lines(cx, tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text("one\ntwo\n")
    tail = Tail(cx)
    assert read(tail, path) == ["one", "two"]
    assert read(tail, path) == []                      # nothing new, nothing read
    with path.open("a") as f:
        f.write("three\n")
    assert read(tail, path) == ["three"]


def test_half_written_line_waits_for_next_pass(cx, tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text('{"a": 1}\n{"b": ')              # second line still being written
    tail = Tail(cx)
    assert read(tail, path) == ['{"a": 1}']
    with path.open("a") as f:
        f.write("2}\n")
    assert read(tail, path) == ['{"b": 2}']


def test_rotation_with_new_inode_rereads_from_zero(cx, tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text("old-1\nold-2\n")
    tail = Tail(cx)
    assert read(tail, path) == ["old-1", "old-2"]
    inode_before = path.stat().st_ino

    # Same path, new file, and LONGER than the old offset: a size check alone
    # would seek into the middle of it and return garbage.
    new = tmp_path / "t.jsonl.tmp"
    new.write_text("new-1\nnew-2\nnew-3\n")
    os.replace(new, path)
    assert path.stat().st_ino != inode_before

    assert read(tail, path) == ["new-1", "new-2", "new-3"]


def test_truncated_file_is_reread(cx, tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text("aaaaaaaaaa\nbbbbbbbbbb\n")
    tail = Tail(cx)
    read(tail, path)
    path.write_text("c\n")                             # same inode, smaller than the offset
    assert read(tail, path) == ["c"]


def test_marks_keep_independent_cursors(cx, tmp_path):
    path = tmp_path / "t.jsonl"
    path.write_text("x\n")
    assert read(Tail(cx), path) == ["x"]
    assert read(Tail(cx, mark="plan::"), path) == ["x"]   # not swallowed by the first cursor
