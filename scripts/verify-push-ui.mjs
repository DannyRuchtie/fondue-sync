const { chromium } = await import(
  new URL(
    "../.cache/browser/node_modules/playwright/index.mjs",
    import.meta.url,
  )
);
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 500, height: 850 } });
  const report = {
    schemaVersion: 1,
    release: "13.11.1",
    fingerprint: "test",
    sourceCommit: "abc",
    selectionIds: ["1"],
    components: [{ componentName: "Button" }],
    changes: [
      {
        id: "c1",
        componentName: "Button",
        property: "cornerRadius",
        before: 4,
        after: 10,
        tokenIds: ["t1"],
      },
    ],
    tokens: [
      {
        id: "t1",
        name: "border-radius-custom",
        type: "FLOAT",
        values: { Value: 10 },
        existing: false,
      },
    ],
    issues: [],
    warnings: [],
  };
  let posts = [];
  let requireMapping = false;
  await page.route("http://localhost:3848/**", async (route) => {
    const req = route.request();
    const body = req.postDataJSON();
    posts.push({ path: new URL(req.url()).pathname, body });
    const path = new URL(req.url()).pathname;
    const result =
      path === "/status"
        ? { repository: "Frontify/fondue" }
        : path === "/preview"
          ? {
              previewId: "p1",
              fingerprint: "review1",
              baseSha: "abc",
              diff: "diff --git a/button.scss b/button.scss\n-border-radius:4px;\n+border-radius:var(--border-radius-custom);",
              blockers: [],
              checks: ["Browser accessibility tests"],
            }
          : { url: "https://github.com/Frontify/fondue/pull/123" };
    if (path === "/preview" && requireMapping && !body.mappingChoices?.c1)
      result.blockers = [
        {
          message: "Review source target",
          changeId: "c1",
          candidates: [
            {
              id: "source1",
              path: "button.scss",
              selector: ".root",
              property: "border-radius",
              expectedValue: "4px",
            },
          ],
        },
      ];
    await route.fulfill({
      json: result,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.setContent(
    '<html><body><iframe title="Fondue plugin" style="width:480px;height:800px;border:0"></iframe></body></html>',
  );
  await page.evaluate(
    ({ report }) => {
      window.addEventListener("message", (event) => {
        if (event.data?.pluginMessage?.type === "status")
          event.source.postMessage(
            {
              pluginMessage: {
                type: "status",
                release: "13.11.1",
                fingerprint: "test1234",
                applied: "13.11.1",
                appliedFingerprint: "test1234",
                counts: { tokens: 444, styles: 51, icons: 420, recipes: 218 },
                gaps: [],
                tokenChoices: [
                  {
                    id: "border-radius-large",
                    name: "border/radius/large",
                    type: "FLOAT",
                    values: { Value: 8 },
                    css: "var(--border-radius-large)",
                  },
                ],
              },
            },
            "*",
          );
        if (event.data?.pluginMessage?.type === "push-scan")
          event.source.postMessage(
            {
              pluginMessage: {
                type: "push-report",
                requestId: event.data.pluginMessage.requestId,
                report,
              },
            },
            "*",
          );
      });
    },
    { report },
  );
  const ui = await readFile(root + "/dist/ui.html", "utf8");
  await page.locator("iframe").evaluate((frame, ui) => {
    frame.srcdoc = ui;
  }, ui);
  const frame = page.frameLocator("iframe");
  await frame.getByRole("tab", { name: "Sync", exact: true }).focus();
  await frame
    .getByRole("tab", { name: "Sync", exact: true })
    .press("ArrowRight");
  assert.equal(
    await frame
      .getByRole("tab", { name: "Push changes" })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await frame.getByRole("button", { name: "Preview PR diff" }).isDisabled(),
    true,
  );
  await frame.getByRole("button", { name: "Review selected object" }).click();
  await frame
    .getByText("1 changes found in the selection.", { exact: true })
    .waitFor();
  await frame.getByText("Connect PR service", { exact: true }).click();
  await frame.getByLabel("Pairing secret").fill("a".repeat(32));
  await frame.getByRole("button", { name: "Connect", exact: true }).click();
  await frame
    .getByText("Connected · Frontify/fondue", { exact: true })
    .waitFor();
  await frame.getByRole("combobox").selectOption("border-radius-large");
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame
    .getByText("Source diff ready for review.", { exact: true })
    .waitFor();
  assert.equal(
    await frame.getByRole("button", { name: "Create draft PR" }).isDisabled(),
    true,
  );
  await frame
    .getByLabel("I reviewed the diff and its shared component/token impact.")
    .check();
  assert.equal(
    await frame.getByRole("button", { name: "Create draft PR" }).isEnabled(),
    true,
  );
  await frame.getByRole("button", { name: "Create draft PR" }).click();
  await frame.getByRole("link", { name: "Open draft PR" }).waitFor();
  assert.deepEqual(
    posts.find((p) => p.path === "/preview").body.selectedChangeIds,
    ["c1"],
  );
  assert.deepEqual(
    posts.find((p) => p.path === "/preview").body.report.changes[0].after,
    { tokenId: "border-radius-large" },
  );
  assert.equal(
    posts
      .find((p) => p.path === "/preview")
      .body.report.tokens.some((token) => token.id === "t1"),
    false,
  );
  assert.deepEqual(posts.find((p) => p.path === "/pull-request").body, {
    previewId: "p1",
    fingerprint: "review1",
  });
  requireMapping = true;
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame.getByText("Review source target", { exact: true }).waitFor();
  await frame
    .getByLabel("Source declaration to change")
    .selectOption("source1");
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame
    .getByText("Source diff ready for review.", { exact: true })
    .waitFor();
  await frame
    .getByLabel("Reason for this change")
    .fill("Improve the selected component radius");
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame
    .getByText("Source diff ready for review.", { exact: true })
    .waitFor();
  assert.equal(
    posts.filter((p) => p.path === "/preview").at(-1).body.mappingChoices.c1,
    "source1",
  );
  requireMapping = false;
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame
    .getByText("Source diff ready for review.", { exact: true })
    .waitFor();
  await page
    .locator("iframe")
    .evaluate((frame) =>
      frame.contentWindow.postMessage(
        { pluginMessage: { type: "push-invalidated" } },
        "*",
      ),
    );
  await frame
    .getByText(
      "Selection or document changed. Review the selected object again.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await frame.getByRole("button", { name: "Preview PR diff" }).isDisabled(),
    true,
  );
  await mkdir(root + "/docs/evidence/push-changes", { recursive: true });
  await frame.getByRole("button", { name: "Review selected object" }).click();
  await frame.getByRole("button", { name: "Preview PR diff" }).click();
  await frame
    .getByText("Source diff ready for review.", { exact: true })
    .waitFor();
  await page.locator("iframe").evaluate((frame) => {
    frame.style.height =
      frame.contentDocument.documentElement.scrollHeight + "px";
    frame.contentWindow.scrollTo(0, 0);
  });
  await page.screenshot({
    path: root + "/docs/evidence/push-changes/review.png",
    fullPage: true,
  });
  await writeFile(
    root + "/docs/evidence/push-changes/browser.json",
    JSON.stringify(
      {
        environment:
          "Headless Chromium; simulated Figma messages and mocked PR service. No native Figma execution or live GitHub writes.",
        checks: [
          "Keyboard tab navigation",
          "Selection changes only",
          "Service pairing",
          "Exact diff review gates PR creation",
          "Only selected change IDs sent",
          "Reviewed preview fingerprint submitted",
          "Selection invalidation disables stale preview",
          "Existing token choice replaces new token dependency",
          "Reviewed source mappings persist across successive previews",
        ],
        result: "passed",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Browser flow checks passed.");
} finally {
  await browser.close();
}
