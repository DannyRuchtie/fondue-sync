import test from "node:test";
import assert from "node:assert/strict";
import { withCheckpoint } from "../src/checkpoint";
const settled = async () => {};

test("sync waits for an acknowledged checkpoint before any mutations", async () => {
  const order: string[] = [];
  let resolve!: (value: { id: string }) => void;
  const pending = withCheckpoint(
    {
      saveVersionHistoryAsync: (title, description) => {
        order.push("save");
        assert.match(title, /^Before Fondue update/);
        assert.match(description!, /13.11.1/);
        return new Promise((done) => {
          resolve = done;
        });
      },
    },
    "update",
    "13.11.1",
    async (checkpoint) => {
      order.push("mutate");
      assert.equal(checkpoint.id, "v123");
      return "done";
    },
    async () => {
      order.push("settle");
    },
  );
  await Promise.resolve();
  assert.deepEqual(order, ["settle", "save"]);
  resolve({ id: "v123" });
  assert.equal(await pending, "done");
  assert.deepEqual(order, ["settle", "save", "mutate"]);
});

test("failed or unconfirmed checkpoints block imports without mutation", async () => {
  for (const save of [
    async () => {
      throw Error("offline");
    },
    async () => null,
    async () => ({ id: "" }),
    async () => ({ id: "  " }),
  ]) {
    let changed = false;
    await assert.rejects(
      withCheckpoint(
        { saveVersionHistoryAsync: save },
        "import",
        "13.11.1",
        async () => {
          changed = true;
        },
        settled,
      ),
      /No changes made/,
    );
    assert.equal(changed, false);
  }
});

test("mutation failures preserve the original error and never trigger a whole-file restore", async () => {
  await assert.rejects(
    withCheckpoint(
      { saveVersionHistoryAsync: async () => ({ id: "v123" }) },
      "update",
      "13.11.1",
      async () => {
        throw Error("sync interrupted");
      },
      settled,
    ),
    /sync interrupted/,
  );
});
