import { test } from "node:test";
import assert from "node:assert/strict";
import { esLoopback } from "../src/lib/loopback.ts";

test("loopback hosts are allowed", () => {
  for (const h of ["127.0.0.1", "127.0.0.1:8796", "localhost", "localhost:8796", "[::1]", "[::1]:8796", "127.1.2.3:80"]) {
    assert.equal(esLoopback(h), true, h);
  }
});

test("anything else is refused", () => {
  for (const h of [null, "", "192.168.1.20:8796", "0.0.0.0:8796", "example.com", "localhost.example.com",
                   "127.0.0.1.nip.io", "[2001:db8::1]:8796", "localhost:abc", "[::1]evil"]) {
    assert.equal(esLoopback(h), false, String(h));
  }
});
