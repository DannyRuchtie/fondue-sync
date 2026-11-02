import test from "node:test";
import assert from "node:assert/strict";
import { checkUpdates, isNewer, stableVersion } from "../src/updates";

test("stable releases compare numerically and reject preview or malformed versions", () => {
  assert.equal(isNewer("13.12.0", "13.9.9"), true);
  assert.equal(isNewer("v0.2.0", "0.1.1"), true);
  assert.equal(isNewer("13.11.1+build.2", "13.11.1"), false);
  assert.equal(isNewer("13.10.0", "13.11.1"), false);
  for (const value of [
    "14.0.0-beta.1",
    "01.2.3",
    "next",
    null,
    "999999999999999999.0.0",
  ])
    assert.equal(stableVersion(value), null);
});

test("independent checks detect updates without sending credentials", async () => {
  const request = (async (url, options) => {
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    return new Response(
      JSON.stringify(
        String(url).includes("api.github.com")
          ? { tag_name: "v0.2.0", draft: false, prerelease: false }
          : { name: "@frontify/fondue", version: "13.12.0" },
      ),
    );
  }) as typeof fetch;
  const results = await checkUpdates("0.1.1", "13.11.1", request);
  assert.deepEqual(
    results.map((r) => r.state),
    ["available", "available"],
  );
});

test("missing plugin release does not prevent checking Fondue", async () => {
  const request = (async (url) =>
    String(url).includes("api.github.com")
      ? new Response("{}", { status: 404 })
      : new Response(
          JSON.stringify({ name: "@frontify/fondue", version: "13.11.1" }),
        )) as typeof fetch;
  const results = await checkUpdates("0.1.1", "13.11.1", request);
  assert.deepEqual(
    results.map((r) => r.state),
    ["unavailable", "current"],
  );
});

test("offline, rate-limited, prerelease and invalid responses never claim up to date", async () => {
  for (const request of [
    async () => {
      throw Error("offline");
    },
    async () => new Response("{}", { status: 403 }),
    async () => new Response("not json"),
    async () =>
      new Response(
        JSON.stringify({ tag_name: "v0.2.0", draft: false, prerelease: true }),
      ),
  ]) {
    const results = await checkUpdates(
      "0.1.1",
      "13.11.1",
      request as typeof fetch,
    );
    assert.ok(results.every((r) => r.state === "unavailable"));
  }
});

test("a stalled request is aborted so the check can be retried", async () => {
  const request = ((_url, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(Error("aborted")),
        { once: true },
      );
    })) as typeof fetch;
  const results = await checkUpdates("0.1.1", "13.11.1", request);
  assert.ok(results.every((r) => r.state === "unavailable"));
});
