import { test } from "node:test";
import assert from "node:assert/strict";
import { canonical, decide } from "../src/plan";
const entry = {
  id: "recipe:Button",
  kind: "recipe" as const,
  definition: "next",
};
test("three-way update protects local drift even if target unchanged", () => {
  assert.equal(
    decide(
      entry,
      { nodeId: "1", definition: "next", snapshot: "before" },
      "edited",
    ).action,
    "conflict",
  );
});
test("missing managed nodes never silently recreate", () => {
  assert.equal(
    decide(entry, { nodeId: "1", definition: "old", snapshot: "before" }, null)
      .action,
    "missing",
  );
});
test("unchanged and source-only update are distinct", () => {
  assert.equal(
    decide(
      entry,
      { nodeId: "1", definition: "next", snapshot: "before" },
      "before",
    ).action,
    "unchanged",
  );
  assert.equal(
    decide(
      entry,
      { nodeId: "1", definition: "old", snapshot: "before" },
      "before",
    ).action,
    "update",
  );
});
test("canonical object ordering is deterministic", () =>
  assert.equal(
    canonical({ b: 2, a: { z: 3, c: 1 } }),
    canonical({ a: { c: 1, z: 3 }, b: 2 }),
  ));
test("conflicts report changed fields without hiding local changes", () => {
  const result = decide(
    entry,
    {
      nodeId: "1",
      definition: "next",
      snapshot: canonical({ name: "Button", description: "Original" }),
    },
    canonical({ name: "Button", description: "Edited" }),
  );
  assert.equal(result.action, "conflict");
  assert.deepEqual(result.changes, ["description"]);
  assert.match(result.reason!, /description/);
});
