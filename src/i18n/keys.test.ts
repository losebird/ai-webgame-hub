import assert from "node:assert/strict";
import { test } from "node:test";
import { en } from "./en.js";
import { zh } from "./zh.js";

test("en and zh dictionaries have identical keys", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
});
