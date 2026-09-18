import { test } from "node:test";
import assert from "node:assert/strict";
import { isLoopback, isLocalRequest } from "../src/lib/loopback.ts";

test("loopback hosts are allowed", () => {
  for (const h of ["127.0.0.1", "127.0.0.1:8796", "localhost", "localhost:8796", "[::1]", "[::1]:8796", "127.1.2.3:80"]) {
    assert.equal(isLoopback(h), true, h);
  }
});

test("anything else is refused", () => {
  for (const h of [null, "", "192.168.1.20:8796", "0.0.0.0:8796", "example.com", "localhost.example.com",
                   "127.0.0.1.nip.io", "[2001:db8::1]:8796", "localhost:abc", "[::1]evil"]) {
    assert.equal(isLoopback(h), false, String(h));
  }
});

test("forwarding headers must point to loopback too", () => {
  const hdr = (h: Record<string, string>) => new Headers(h);
  assert.equal(isLocalRequest(hdr({ host: "127.0.0.1:8796" })), true);
  assert.equal(isLocalRequest(hdr({ host: "example.com" })), false);
  // what Next.js itself fills in for a direct local request
  assert.equal(isLocalRequest(hdr({
    host: "127.0.0.1:8796", "x-forwarded-host": "127.0.0.1:8796",
    "x-forwarded-for": "::ffff:127.0.0.1", "x-forwarded-port": "8796", "x-forwarded-proto": "http",
  })), true);
  assert.equal(isLocalRequest(hdr({ host: "localhost", "x-forwarded-for": "::1", forwarded: "for=127.0.0.1" })), true);
  const extras: Record<string, string>[] = [
    { "x-forwarded-for": "203.0.113.7" },
    { "x-forwarded-for": "127.0.0.1, 203.0.113.7" },
    { "x-forwarded-host": "dash.example.com" },
    { forwarded: "for=203.0.113.7;proto=https" },
    { forwarded: 'for="[2001:db8::1]:443"' },
    { forwarded: "for=127.0.0.1;host=dash.example.com" },
    { "x-real-ip": "203.0.113.7" },
  ];
  for (const extra of extras) {
    assert.equal(isLocalRequest(hdr({ host: "127.0.0.1:8796", ...extra })), false, JSON.stringify(extra));
  }
});
