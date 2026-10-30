import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGitHubClient,
  digest,
  validPath,
  REPOSITORY,
} from "./push-github.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const allowedOrigins = new Set([
  "null",
  "https://www.figma.com",
  "https://figma.com",
]);
const checkList = [
  "Repository formatting, lint, typecheck and builds: pending",
  "Component unit and browser tests: pending",
  "Keyboard, focus, labels, ARIA and affected visual states: pending",
  "Contrast and target size checks for affected modes: pending",
  "Maintainer review: required",
];
const block = (message, code = "proposal") => ({
  code,
  message,
  blocking: true,
});
function unifiedDiff(files) {
  return files
    .map(({ path, before, after }) => {
      const old = before === null ? [] : before.replace(/\n$/, "").split("\n");
      const next = after.replace(/\n$/, "").split("\n");
      return `diff --git a/${path} b/${path}\n--- ${before === null ? "/dev/null" : `a/${path}`}\n+++ b/${path}\n@@ -${old.length ? 1 : 0},${old.length} +1,${next.length} @@\n${old
        .map((line) => "-" + line)
        .concat(next.map((line) => "+" + line))
        .join("\n")}\n`;
    })
    .join("\n");
}
export function createPushService({
  sessionSecret,
  github,
  generatePatch,
  prepareFiles,
  sourceRoot = resolve(directory, "../../source"),
  baselineRoot,
  tokenAuthoring,
  mappings = [],
  bundle,
  clock = Date.now,
  ttlMs = 30 * 60_000,
}) {
  if (!sessionSecret || sessionSecret.length < 24)
    throw Error("Session secret must contain at least 24 characters.");
  const reviews = new Map();
  function authorized(header) {
    const supplied = Buffer.from(header ?? "");
    const expected = Buffer.from(`Bearer ${sessionSecret}`);
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  }
  async function preview(input) {
    const {
      report,
      selectedChangeIds,
      description = "",
      tokenNames,
      mappingChoices,
    } = input;
    if (
      !report ||
      report.schemaVersion !== 1 ||
      !Array.isArray(report.changes) ||
      !Array.isArray(selectedChangeIds) ||
      !selectedChangeIds.length
    )
      throw Error("Select at least one detected change.");
    if (
      selectedChangeIds.length > 500 ||
      new Set(selectedChangeIds).size !== selectedChangeIds.length
    )
      throw Error("Invalid change selection.");
    const byId = new Map(report.changes.map((change) => [change.id, change]));
    const changes = selectedChangeIds.map((id) => {
      if (!byId.has(id)) throw Error("Unknown selected change.");
      return byId.get(id);
    });
    const title =
      input.title || "fix(components): apply reviewed Fondue design changes";
    if (
      !/^(feat|fix|chore|docs|build|refactor|perf|test|ci)(\([a-zA-Z0-9_/-]+\))?!?: [^\r\n]{1,180}$/.test(
        title,
      )
    )
      throw Error(
        "Use a conventional PR title, for example fix(components): adjust button radius.",
      );
    if (typeof description !== "string" || description.length > 10_000)
      throw Error("Invalid description.");
    const baseSha = await github.head();
    const neededTokens = new Set(
      changes.flatMap((change) => change.tokenIds ?? []),
    );
    const reportTokens = new Map(
      (report.tokens ?? []).map((token) => [token.id, token]),
    );
    const collectAliases = (value) => {
      if (!value || typeof value !== "object") return;
      if (value.type === "VARIABLE_ALIAS" && typeof value.id === "string") {
        if (!neededTokens.has(value.id)) {
          neededTokens.add(value.id);
          collectAliases(reportTokens.get(value.id)?.values);
        }
      } else if (typeof value.alias === "string") {
        if (!neededTokens.has(value.alias)) {
          neededTokens.add(value.alias);
          collectAliases(reportTokens.get(value.alias)?.values);
        }
      } else Object.values(value).forEach(collectAliases);
    };
    for (const id of [...neededTokens])
      collectAliases(reportTokens.get(id)?.values);
    const proposal = {
      ...report,
      tokens: [...reportTokens.values()].filter((token) =>
        neededTokens.has(token.id),
      ),
      changes,
      title,
      description,
      tokenNames,
      mappingChoices,
    };
    const generated = await generatePatch({
      proposal,
      sourceRoot,
      baselineRoot,
      tokenAuthoring,
      mappings,
      bundle,
    });
    const blockers = [
      ...(generated.issues ?? []).filter((issue) => issue.blocking !== false),
    ];
    // Generator decides which report issues apply to the chosen subset.
    let files = generated.files ?? [];
    const preparationChecks = [];
    if (
      !blockers.length &&
      files.some(
        (file) =>
          file.path.startsWith("packages/tokens/") &&
          !file.path.startsWith("packages/tokens/dist/"),
      )
    ) {
      if (!prepareFiles)
        blockers.push(
          block(
            "Token PRs require an isolated token build and generated outputs before submission.",
            "token-build-unconfigured",
          ),
        );
      else {
        const prepared = await prepareFiles({
          files,
          sourceRoot,
          proposal,
          bundle,
        });
        files = prepared.files ?? files;
        blockers.push(
          ...(prepared.issues ?? []).filter(
            (issue) => issue.blocking !== false,
          ),
        );
        preparationChecks.push(...(prepared.checks ?? []));
      }
    }
    if (!files.length)
      blockers.push(block("No source changes were generated.", "empty"));
    const paths = new Set();
    for (const file of files) {
      if (
        !validPath(file.path) ||
        paths.has(file.path) ||
        typeof file.after !== "string" ||
        !(file.before === null || typeof file.before === "string")
      ) {
        blockers.push(
          block("Generator returned an invalid or duplicate file.", "path"),
        );
        continue;
      }
      paths.add(file.path);
      if ((await github.read(file.path, baseSha)) !== file.before)
        blockers.push(
          block(
            `Source conflict in ${file.path}; refresh the source checkout and preview again.`,
            "source-conflict",
          ),
        );
    }
    const seed = digest({ baseSha, title, description, files });
    if (files.length && !blockers.length) {
      const packageNames = {
        components: "@frontify/fondue-components",
        tokens: "@frontify/fondue-tokens",
        charts: "@frontify/fondue-charts",
        rte: "@frontify/fondue-rte",
        "rich-text-editor": "@frontify/fondue-rich-text-editor",
        fondue: "@frontify/fondue",
      };
      const packages = new Set(
        files.flatMap((file) => {
          const name = file.path.match(/^packages\/([^/]+)\//)?.[1];
          return packageNames[name] ? [packageNames[name]] : [];
        }),
      );
      if (packages.size) {
        const path = `.changeset/fondue-sync-${seed.slice(0, 16)}.md`;
        const before = await github.read(path, baseSha);
        if (before !== null)
          blockers.push(
            block(
              "Changeset name already exists. Refresh the proposal.",
              "changeset",
            ),
          );
        else
          files.push({
            path,
            before: null,
            after: `---\n${[...packages]
              .sort()
              .map((name) => `'${name}': patch`)
              .join("\n")}\n---\n\n${title}\n`,
          });
      }
    }
    const fingerprint = digest({ baseSha, title, description, files });
    const sourceLinks =
      typeof report.figmaFileKey === "string" &&
      /^[a-zA-Z0-9]+$/.test(report.figmaFileKey)
        ? [
            ...new Set(
              changes
                .map((change) => change.selectionId)
                .filter(
                  (id) =>
                    typeof id === "string" && /^[a-zA-Z0-9:;-]+$/.test(id),
                ),
            ),
          ]
            .map(
              (id) =>
                `[Selected Figma object](https://www.figma.com/design/${report.figmaFileKey}?node-id=${encodeURIComponent(id)})`,
            )
            .join(" · ")
        : "Figma file link unavailable in this plugin context.";
    const previewId = randomBytes(18).toString("hex");
    const review = {
      previewId,
      fingerprint,
      baseSha,
      title,
      files,
      blockers,
      checks: [...preparationChecks, ...checkList],
      diff: unifiedDiff(files),
      coverage: generated.coverage,
      warnings: generated.warnings ?? [],
      expiresAt: clock() + ttlMs,
      body: `## Proposed change\n\n${description || title}\n\nSelected Figma changes: ${changes.length}.\n${sourceLinks}\nImported source commit: \`${report.sourceCommit || "unknown"}\`.\nTarget base: \`${baseSha}\`.\nReview fingerprint: \`${fingerprint}\`.\n\n## Validation\n\n${(generated.warnings ?? []).map((warning) => "- " + warning).join("\n")}\n\n${[...preparationChecks, ...checkList].map((item) => "- " + item).join("\n")}\n\nGenerated from a selected-object proposal. Other automated checks remain pending. Review component behavior, token ownership, and affected states before merging.`,
    };
    reviews.set(previewId, review);
    for (const [id, stored] of reviews)
      if (stored.expiresAt <= clock()) reviews.delete(id);
    if (reviews.size > 100) reviews.delete(reviews.keys().next().value);
    return review;
  }
  async function submit(input) {
    const review = reviews.get(input.previewId);
    if (!review || review.expiresAt <= clock())
      throw Error("Preview expired. Review the proposal again.");
    if (input.fingerprint !== review.fingerprint)
      throw Error("Review fingerprint does not match.");
    if (review.blockers.length)
      throw Error("Resolve preview blockers before creating a PR.");
    if (review.result) return review.result;
    if (review.pending) return review.pending;
    review.pending = github
      .createDraft(review)
      .then((result) => {
        review.result = result;
        return result;
      })
      .finally(() => {
        delete review.pending;
      });
    return review.pending;
  }
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const host = req.headers.host ?? "";
    if (
      !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ||
      (origin !== undefined && !allowedOrigins.has(origin))
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (origin !== undefined)
      res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "OPTIONS") {
      if (req.headers["access-control-request-private-network"] === "true")
        res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.writeHead(204);
      res.end();
      return;
    }
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Invalid companion session." }));
      return;
    }
    try {
      if (req.method === "GET" && req.url === "/status") {
        res.end(
          JSON.stringify({
            repository: REPOSITORY,
            base: github.base,
            authenticated: true,
            checks: checkList,
          }),
        );
        return;
      }
      if (
        req.method !== "POST" ||
        !["/preview", "/pull-request"].includes(req.url)
      ) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found." }));
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 2_000_000)
          throw Error("Proposal exceeds 2 MB.");
      }
      const input = JSON.parse(body);
      const result =
        req.url === "/preview" ? await preview(input) : await submit(input);
      const { pending, ...output } = result;
      res.end(JSON.stringify(output));
    } catch (error) {
      res.writeHead(400);
      // Do not expose upstream request bodies, credentials, or stack traces.
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Proposal failed.",
        }),
      );
    }
  });
  return { server, preview, submit };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { generatePushPatch } = await import("./push-patches.mjs");
  const { createTokenAuthoringAdapter } = await import("./push-tokens.mjs");
  const { createTokenBuildPreparation } = await import("./push-validation.mjs");
  const bundle = JSON.parse(
    await readFile(
      resolve(directory, "../bundles/fondue-13.11.1.json"),
      "utf8",
    ),
  );
  const sessionSecret =
    process.env.FONDUE_PUSH_SESSION || randomBytes(32).toString("hex");
  const github = createGitHubClient({
    token: process.env.FONDUE_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    base: process.env.FONDUE_PUSH_BASE || "main",
  });
  const port = Number(process.env.FONDUE_PUSH_PORT || 3848);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("Invalid FONDUE_PUSH_PORT.");
  const { server } = createPushService({
    sessionSecret,
    github,
    generatePatch: generatePushPatch,
    bundle,
    tokenAuthoring: createTokenAuthoringAdapter({ bundle }),
    prepareFiles: createTokenBuildPreparation(),
    sourceRoot:
      process.env.FONDUE_SOURCE_ROOT || resolve(directory, "../../source"),
    baselineRoot: process.env.FONDUE_BASELINE_ROOT,
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Fondue PR companion: http://127.0.0.1:${port}`);
    console.log(`Pairing secret: ${sessionSecret}`);
    console.log(
      "Paste the address and pairing secret into the plugin Push changes tab. Keep this terminal private.",
    );
  });
}
