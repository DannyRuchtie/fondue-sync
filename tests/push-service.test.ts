import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore Node companion modules deliberately run without bundling.
import { createPushService } from "../scripts/push-service.mjs";
// @ts-ignore Node companion modules deliberately run without bundling.
import { createGitHubClient, validPath } from "../scripts/push-github.mjs";

const secret = "test-session-secret-at-least-24-characters";
const file = {
  path: "packages/components/src/components/Button/styles/button.module.scss",
  before: ".root { border-radius: var(--border-radius-medium); }\n",
  after: ".root { border-radius: var(--border-radius-large); }\n",
};
const report = {
  schemaVersion: 1,
  sourceCommit: "imported",
  changes: [{ id: "selected" }, { id: "unselected" }],
  tokens: [],
};
function fixture(options: any = {}) {
  let calls = 0;
  let received: any;
  const github = {
    base: "main",
    head: async () => "base-sha",
    read: async (path: string) => (path === file.path ? file.before : null),
    createDraft: async () => {
      calls++;
      return {
        url: "https://github.com/Frontify/fondue/pull/123",
        number: 123,
      };
    },
    ...options.github,
  };
  const service = createPushService({
    sessionSecret: secret,
    github,
    clock: options.clock,
    ttlMs: options.ttlMs,
    generatePatch: async (input: any) => {
      received = input;
      return { files: [{ ...file }], issues: [], ...options.generated };
    },
  });
  return { ...service, calls: () => calls, received: () => received };
}
const input = {
  report,
  selectedChangeIds: ["selected"],
  title: "fix(components): adjust button radius",
};

test("preview only passes selected changes, adds package changeset, and reports checks as pending", async () => {
  const f = fixture();
  const review = await f.preview(input);
  assert.deepEqual(f.received().proposal.changes, [{ id: "selected" }]);
  assert.equal(review.files.length, 2);
  assert.match(review.files[1].after, /'@frontify\/fondue-components': patch/);
  assert.match(review.diff, /border-radius-large/);
  assert.ok(
    review.checks.every((check: string) => /pending|required/.test(check)),
  );
  assert.equal(f.calls(), 0);
});
test("submission uses stored review, rejects mismatched fingerprints, and is idempotent", async () => {
  const f = fixture();
  const review = await f.preview(input);
  await assert.rejects(
    f.submit({ previewId: review.previewId, fingerprint: "different" }),
    /fingerprint/,
  );
  const request = {
    previewId: review.previewId,
    fingerprint: review.fingerprint,
  };
  const results = await Promise.all([f.submit(request), f.submit(request)]);
  assert.deepEqual(results[0], results[1]);
  await f.submit(request);
  assert.equal(f.calls(), 1);
});
test("conflicts, generator blockers and expired reviews cannot create PRs", async () => {
  const f = fixture({ github: { read: async () => "upstream changed" } });
  const review = await f.preview(input);
  assert.ok(review.blockers.length);
  await assert.rejects(
    f.submit({ previewId: review.previewId, fingerprint: review.fingerprint }),
    /blockers/,
  );
  const g = fixture({
    generated: {
      issues: [
        { code: "mapping", blocking: true, message: "Ambiguous selector" },
      ],
    },
  });
  const blocked = await g.preview(input);
  assert.equal(blocked.blockers[0].code, "mapping");
  let now = 0;
  const expired = fixture({ clock: () => now, ttlMs: 10 });
  const old = await expired.preview(input);
  now = 11;
  await assert.rejects(
    expired.submit({ previewId: old.previewId, fingerprint: old.fingerprint }),
    /expired/,
  );
});
test("unknown change selection and unsafe paths are blocked", async () => {
  const f = fixture();
  await assert.rejects(
    f.preview({ ...input, selectedChangeIds: ["unknown"] }),
    /Unknown/,
  );
  for (const path of [
    ".github/workflows/evil.yml",
    "../package.json",
    "packages/components/../tokens/file",
    "/etc/passwd",
  ])
    assert.equal(validPath(path), false);
  const unsafe = fixture({
    generated: { files: [{ ...file, path: ".github/workflows/evil.yml" }] },
  });
  assert.equal((await unsafe.preview(input)).blockers[0].code, "path");
});
test("HTTP companion enforces session and allowed origins", async () => {
  const f = fixture();
  await new Promise<void>((resolve) =>
    f.server.listen(0, "127.0.0.1", resolve),
  );
  const address = f.server.address();
  const url = `http://127.0.0.1:${address.port}/status`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (
        await fetch(url, {
          headers: {
            Authorization: `Bearer ${secret}`,
            Origin: "https://evil.example",
          },
        })
      ).status,
      403,
    );
    const success = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}`, Origin: "null" },
    });
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("access-control-allow-origin"), "null");
    assert.equal((await success.json()).repository, "Frontify/fondue");
    const localhost = await fetch(url.replace("127.0.0.1", "localhost"), {
      headers: { Authorization: `Bearer ${secret}`, Origin: "null" },
    });
    assert.equal(localhost.status, 200);
    const { request } = await import("node:http");
    const rebinding = await new Promise<number | undefined>(
      (resolve, reject) => {
        const req = request(
          url,
          {
            headers: {
              Authorization: `Bearer ${secret}`,
              Host: "attacker.example",
            },
          },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        req.on("error", reject);
        req.end();
      },
    );
    assert.equal(rebinding, 403);
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "null",
        "Access-Control-Request-Private-Network": "true",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-private-network"),
      "true",
    );
  } finally {
    await new Promise<void>((resolve) => f.server.close(resolve));
  }
});
test("GitHub client rejects a stale target before writes and never leaks credentials in errors", async () => {
  const requests: any[] = [];
  const github = createGitHubClient({
    token: "private-test-token",
    fetchImpl: async (url: string, options: any) => {
      requests.push({ url, options });
      return new Response(
        JSON.stringify(
          url.includes("/pulls?") ? [] : { object: { sha: "new-base" } },
        ),
        { status: 200 },
      );
    },
  });
  await assert.rejects(
    github.createDraft({
      fingerprint: "abc",
      baseSha: "old-base",
      files: [file],
    }),
    /target branch changed/,
  );
  assert.ok(requests.every((request) => request.options.method === "GET"));
  assert.throws(
    () => createGitHubClient({ token: "x", repository: "other/repository" }),
    /Only Frontify/,
  );
});

test("GitHub client creates one exact draft with a commit on the reviewed base", async () => {
  const writes: { path: string; body: any }[] = [];
  const github = createGitHubClient({
    token: "server-only-secret",
    fetchImpl: async (url: string, options: any) => {
      const path = new URL(url).pathname.replace("/repos/Frontify/fondue", "");
      const body = options.body ? JSON.parse(options.body) : undefined;
      if (options.method !== "GET") writes.push({ path, body });
      let result: any;
      let status = 200;
      if (path === "/pulls" && options.method === "GET") result = [];
      else if (path === "/git/ref/heads/main")
        result = { object: { sha: "base" } };
      else if (path.startsWith("/contents/"))
        result = {
          type: "file",
          encoding: "base64",
          content: Buffer.from(file.before).toString("base64"),
        };
      else if (path.startsWith("/git/ref/heads/fondue-sync")) {
        status = 404;
        result = {};
      } else if (path === "/git/commits/base")
        result = { tree: { sha: "base-tree" } };
      else if (path === "/git/blobs") result = { sha: "blob" };
      else if (path === "/git/trees") result = { sha: "tree" };
      else if (path === "/git/commits") result = { sha: "commit" };
      else if (path === "/git/refs") result = { object: { sha: "commit" } };
      else if (path === "/pulls" && options.method === "POST")
        result = {
          number: 9,
          html_url: "https://github.com/Frontify/fondue/pull/9",
        };
      else throw Error("Unexpected request " + path);
      return new Response(JSON.stringify(result), { status });
    },
  });
  const result = await github.createDraft({
    fingerprint: "f".repeat(64),
    baseSha: "base",
    title: "fix(components): radius",
    body: "Checks pending",
    files: [file],
  });
  assert.equal(result.number, 9);
  assert.deepEqual(
    writes.find((write) => write.path === "/git/commits")?.body.parents,
    ["base"],
  );
  assert.equal(
    writes.find((write) => write.path === "/git/blobs")?.body.content,
    file.after,
  );
  assert.equal(
    writes.find((write) => write.path === "/pulls")?.body.draft,
    true,
  );
  assert.equal(
    writes.find((write) => write.path === "/pulls")?.body.body,
    "Checks pending",
  );
});

test("selection includes required token alias dependencies and excludes unrelated new tokens", async () => {
  const f = fixture();
  const tokenReport = {
    ...report,
    changes: [
      { id: "selected", tokenIds: ["semantic"] },
      { id: "unselected", tokenIds: ["unrelated"] },
    ],
    tokens: [
      {
        id: "semantic",
        existing: false,
        values: { Light: { alias: "primitive" } },
      },
      { id: "primitive", existing: false, values: { Value: 8 } },
      { id: "unrelated", existing: false, values: { Value: 20 } },
    ],
  };
  await f.preview({ ...input, report: tokenReport });
  assert.deepEqual(
    f.received().proposal.tokens.map((token: any) => token.id),
    ["semantic", "primitive"],
  );
});

test("real patch generator previews selected component plus new token source against mock GitHub", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  // @ts-ignore Node companion module.
  const { generatePushPatch } = await import("../scripts/push-patches.mjs");
  const { createTokenAuthoringAdapter } =
    // @ts-ignore Node companion module.
    await import("../scripts/push-tokens.mjs");
  const { createTokenBuildPreparation } =
    // @ts-ignore Node companion module.
    await import("../scripts/push-validation.mjs");
  const temp = await mkdtemp(join(tmpdir(), "fondue-service-integration-"));
  const sourceRoot = join(temp, "source");
  const baselineRoot = join(temp, "baseline");
  const builderPath =
    "packages/tokens/src/styleDictionary/buildStyleDictionary.ts";
  const builder = "export const dictionary = { source: [allTokensPath] };\n";
  const manifestPath = "packages/tokens/dist/manifest.json";
  const contents = new Map([
    [file.path, file.before],
    [builderPath, builder],
    [manifestPath, '{"tokens":[]}'],
    [
      "packages/tokens/dist/css/base.css",
      ":root { --border-radius-medium: 4px; }",
    ],
    [
      "packages/tokens/dist/themes/themes.module.css",
      ".base { --border-radius-medium: 4px; }",
    ],
    ["packages/tokens/dist/json/all-tokens.json", "{}"],
  ]);
  try {
    for (const root of [sourceRoot, baselineRoot])
      for (const [path, value] of contents) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), value);
      }
    const bundle = {
      fingerprint: "bundle",
      provenance: { commit: "abc" },
      recipes: [
        { id: "components/Button", name: "Button", source: [file.path] },
      ],
      tokens: [
        {
          id: "border-radius-medium",
          type: "FLOAT",
          css: "var(--border-radius-medium)",
          values: { Value: 4 },
        },
      ],
    };
    const tokenReport = {
      schemaVersion: 1,
      sourceCommit: "abc",
      fingerprint: "bundle",
      changes: [
        {
          id: "selected",
          recipeId: "components/Button",
          layerId: "button",
          property: "cornerRadius",
          before: 4,
          after: { tokenId: "new-radius" },
          tokenIds: ["new-radius"],
          scope: "component",
        },
        { id: "unselected", tokenIds: ["unrelated"] },
      ],
      tokens: [
        {
          id: "new-radius",
          name: "border-radius-custom",
          type: "FLOAT",
          existing: false,
          values: { Value: { alias: "border-radius-medium" } },
        },
        {
          id: "border-radius-medium",
          name: "border-radius-medium",
          type: "FLOAT",
          css: "var(--border-radius-medium)",
          existing: true,
          values: { Value: 4 },
        },
        {
          id: "unrelated",
          name: "spacing-unrelated",
          type: "FLOAT",
          existing: false,
          values: { Value: 100 },
        },
      ],
      issues: [],
    };
    const service = createPushService({
      sessionSecret: secret,
      bundle,
      sourceRoot,
      baselineRoot,
      tokenAuthoring: createTokenAuthoringAdapter({ bundle }),
      prepareFiles: createTokenBuildPreparation({
        figmaToken: "mock-only",
        requireToolchain: false,
        execute: async ({ cwd }: any) => {
          await writeFile(
            join(cwd, manifestPath),
            JSON.stringify({
              tokens: [
                {
                  id: "border-radius-custom",
                  cssVariable: "var(--border-radius-custom)",
                },
              ],
            }),
          );
          await writeFile(
            join(cwd, "packages/tokens/dist/css/base.css"),
            ":root { --border-radius-medium: 4px; --border-radius-custom: var(--border-radius-medium); }",
          );
          await writeFile(
            join(cwd, "packages/tokens/dist/themes/themes.module.css"),
            ".base { --border-radius-medium: 4px; --border-radius-custom: var(--border-radius-medium); }",
          );
        },
      }),
      generatePatch: generatePushPatch,
      mappings: [
        {
          recipeId: "components/Button",
          layerId: "button",
          figmaProperty: "cornerRadius",
          path: file.path,
          selector: ".root",
          property: "border-radius",
          expectedValue: "var(--border-radius-medium)",
        },
      ],
      github: {
        base: "main",
        head: async () => "base",
        read: async (path: string) => contents.get(path) ?? null,
        createDraft: async () => {
          throw Error("No external mutation in preview test");
        },
      },
    });
    const preview = await service.preview({ ...input, report: tokenReport });
    assert.deepEqual(preview.blockers, []);
    assert.match(
      preview.files.find((entry: any) => entry.path === file.path).after,
      /var\(--border-radius-custom\)/,
    );
    const authored = preview.files.find((entry: any) =>
      entry.path.endsWith("repository-tokens.json"),
    ).after;
    assert.match(authored, /ref_border-radius-medium/);
    assert.doesNotMatch(authored, /unrelated/);
    assert.ok(preview.files.some((entry: any) => entry.path === builderPath));
    assert.match(
      preview.files.find((entry: any) => entry.path.startsWith(".changeset/"))
        .after,
      /fondue-components/,
    );
    assert.match(
      preview.files.find((entry: any) => entry.path.startsWith(".changeset/"))
        .after,
      /fondue-tokens/,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("token source-only preview cannot create a draft PR without verified generated outputs", async () => {
  const f = fixture({
    generated: {
      files: [
        {
          path: "packages/tokens/repository-tokens.json",
          before: null,
          after: "{}",
        },
      ],
    },
  });
  const review = await f.preview(input);
  assert.equal(review.blockers[0].code, "token-build-unconfigured");
  await assert.rejects(
    f.submit({ previewId: review.previewId, fingerprint: review.fingerprint }),
    /blockers/,
  );
  assert.equal(f.calls(), 0);
});
