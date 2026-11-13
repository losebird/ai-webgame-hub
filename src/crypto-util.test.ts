import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSecrets, hashPassword, verifyPassword } from "./crypto-util.js";

test("compareSecrets is length-independent xor of bytes", () => {
  assert.equal(compareSecrets("abc", "abc"), true);
  assert.equal(compareSecrets("abc", "abd"), false);
  assert.equal(compareSecrets("abc", "ab"), false);
});

test("password hashes verify", async () => {
  const stored = await hashPassword("long-password");
  assert.equal(await verifyPassword("long-password", stored), true);
  assert.equal(await verifyPassword("wrong-password", stored), false);
});
