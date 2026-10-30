import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".cache");
fs.mkdirSync(cache, { recursive: true });
const checkout = path.join(cache, "upstream.git");
const target = path.join(cache, "release");
if (!fs.existsSync(checkout)) {
  execFileSync("git", ["init", "--bare", checkout], { stdio: "inherit" });
  execFileSync(
    "git",
    [
      "--git-dir",
      checkout,
      "remote",
      "add",
      "origin",
      "https://github.com/Frontify/fondue.git",
    ],
    { stdio: "inherit" },
  );
}
execFileSync(
  "git",
  [
    "--git-dir",
    checkout,
    "fetch",
    "--depth=1",
    "origin",
    "tag",
    "@frontify/fondue@13.11.1",
  ],
  { stdio: "inherit" },
);
const commit = execFileSync(
  "git",
  ["--git-dir", checkout, "rev-parse", "@frontify/fondue@13.11.1^{}"],
  { encoding: "utf8" },
).trim();
if (commit !== "ebcc9b8579a7f862f43a2732f5a5b9c3105e6796")
  throw Error(`Release tag moved: ${commit}`);
const tar = execFileSync("git", ["--git-dir", checkout, "archive", commit], {
  maxBuffer: 100 * 1024 * 1024,
});
// Only the task-owned release cache is replaced. Never invoke the live token builder.
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
execFileSync("tar", ["-x", "-C", target], { input: tar });
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const inputs = Object.fromEntries(
  files(target).map((f) => [
    path.relative(target, f).split(path.sep).join("/"),
    crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
  ]),
);
const lock = { commit, tag: "@frontify/fondue@13.11.1", files: inputs };
fs.writeFileSync(
  path.join(cache, "source-lock.json"),
  JSON.stringify(lock, null, 2) + "\n",
);
console.log(
  `Prepared ${commit}; locked ${Object.keys(inputs).length} source files`,
);
