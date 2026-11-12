import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseSeed } from "./validate.js";

test("the shipped seed accepts 16 homepage cards and hides 6 alternates", () => {
  const raw = JSON.parse(readFileSync(new URL("../../data/seed/seed-games.json", import.meta.url), "utf8"));
  const parsed = parseSeed(raw);
  assert.equal(parsed.documentError, null);
  assert.deepEqual(parsed.rejected, []);
  assert.equal(parsed.accepted.filter((row) => row.placement === "homepage").length, 16);
  assert.equal(parsed.accepted.filter((row) => row.placement === "alternate").length, 6);
  assert.equal(parsed.accepted.some((row) => row.title === "Turbo Tails" && row.placement === "alternate"), true);
  assert.equal(parsed.accepted.some((row) => row.title === "Saltline" && row.placement === "homepage"), true);
});

test("missing fields and non-https urls are rejected without being filled in", () => {
  const parsed = parseSeed([
    {
      title: "Ok card",
      author_handle: "example_author",
      post_url: "https://example.com/post",
      play_url: "https://example.com/play",
      summary: "Placeholder only.",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
    {
      title: "Plain http",
      author_handle: "example_author",
      post_url: "http://example.com/post",
      play_url: "https://example.com/play",
      summary: "no",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
    {
      author_handle: "example_author",
      post_url: "https://example.com/post-2",
      play_url: "https://example.com/play-2",
      summary: "no title",
      model: "Other",
      license_status: "unknown",
      engagement: "example",
    },
  ]);
  assert.equal(parsed.accepted.length, 1);
  assert.equal(parsed.accepted[0]?.title, "Ok card");
  assert.equal(parsed.rejected.length, 2);
  assert.match(parsed.rejected[0]?.reason ?? "", /not https: post_url/);
  assert.match(parsed.rejected[1]?.reason ?? "", /missing title/);
  assert.equal(JSON.stringify(parsed.accepted).includes("http://example.com"), false);
});
