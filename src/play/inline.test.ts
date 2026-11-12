import assert from "node:assert/strict";
import { test } from "node:test";
import { inlineBundle } from "./inline.js";

test("local script and css are inlined and remote urls stay put", () => {
  const files = new Map<string, Uint8Array>([
    ["index.html", new TextEncoder().encode(`<!doctype html>
<link rel="stylesheet" href="css/game.css">
<script src="js/game.js"></script>
<script src="https://example.com/remote.js"></script>
<base href="https://example.com/">`)],
    ["css/game.css", new TextEncoder().encode("body{color:#111}")],
    ["js/game.js", new TextEncoder().encode("var marker = 'bird-wing';")],
  ]);
  const html = inlineBundle(files);
  assert.match(html, /bird-wing/);
  assert.match(html, /color:#111/);
  assert.equal(html.includes('src="js/game.js"'), false);
  assert.match(html, /src="https:\/\/example\.com\/remote\.js"/);
  assert.equal(html.includes("<base"), false);
});
