import {
  access,
  cp,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { join, relative, sep, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const outputPrefix = "packages/tokens/dist/";
const failure = (code, message) => ({ code, message, blocking: true });
const tokenChanged = (file) =>
  file.path.startsWith("packages/tokens/") &&
  !file.path.startsWith(outputPrefix);
async function readOutputs(root) {
  const files = new Map();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw Error("Generated token outputs cannot contain symlinks.");
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files.set(
          relative(root, path).split(sep).join("/"),
          await readFile(path, "utf8"),
        );
    }
  }
  await visit(join(root, outputPrefix));
  return files;
}
export async function runTokenBuild({ cwd, figmaToken, timeoutMs }) {
  // Fixed executable and argument vector. No command or environment supplied by the plugin.
  await new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@frontify/fondue-tokens", "build"],
      {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          TMPDIR: process.env.TMPDIR,
          CI: "true",
          FIGMA_ACCESS_TOKEN: figmaToken,
        },
        detached: process.platform !== "win32",
      },
    );
    const timer = setTimeout(() => {
      try {
        if (process.platform !== "win32" && child.pid)
          process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        /* Process may already have exited. */
      }
    }, timeoutMs);
    // Drain output without returning logs that might include credentials.
    child.stdout.resume();
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      reject(
        Error(
          "Could not run pnpm token build. Check the installed Fondue toolchain.",
        ),
      );
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            Error(
              signal
                ? "Token build timed out or was interrupted."
                : `Token build failed (exit ${code}).`,
            ),
          );
    });
  });
}
/** Build only in a disposable source copy. A new token must have actual generated
 * exports before its PR can be created; source-only proposals stay blocked.
 */
export function createTokenBuildPreparation({
  figmaToken = process.env.FIGMA_ACCESS_TOKEN,
  execute = runTokenBuild,
  timeoutMs = 180_000,
  requireToolchain = true,
} = {}) {
  return async ({ files, sourceRoot, proposal, bundle }) => {
    if (!files.some(tokenChanged)) return { files, issues: [], checks: [] };
    if (!figmaToken)
      return {
        files,
        issues: [
          failure(
            "token-build-credentials",
            "Token PRs require FIGMA_ACCESS_TOKEN on the local companion to regenerate Fondue token outputs. No PR can be created until generation succeeds.",
          ),
        ],
        checks: [],
      };
    if (requireToolchain) {
      try {
        await access(join(sourceRoot, "node_modules"));
        await access(join(sourceRoot, "packages/tokens/node_modules"));
      } catch {
        return {
          files,
          issues: [
            failure(
              "token-build-toolchain",
              "Install the matching Fondue pnpm workspace dependencies in FONDUE_SOURCE_ROOT before preparing a token PR.",
            ),
          ],
          checks: [],
        };
      }
    }
    let temp;
    try {
      const beforeOutputs = await readOutputs(sourceRoot);
      temp = await mkdtemp(join(tmpdir(), "fondue-token-build-"));
      const working = join(temp, "fondue");
      await cp(sourceRoot, working, {
        recursive: true,
        dereference: false,
        filter: (source) =>
          !relative(sourceRoot, source)
            .split(sep)
            .some((part) =>
              [
                ".git",
                ".cache",
                ".tmp",
                "storybook-static",
                "playwright-report",
                "test-results",
              ].includes(part),
            ),
      });
      for (const file of files) {
        if (
          typeof file.after !== "string" ||
          !/^packages\/(components|tokens|charts|rte|rich-text-editor|fondue)\//.test(
            file.path,
          ) ||
          file.path.split("/").some((part) => part === ".." || part === ".") ||
          file.path.includes("\\")
        )
          throw Error("Invalid prepared source path.");
        const destination = join(working, file.path);
        // Reject symlinks so applying a patch cannot escape the disposable copy.
        let cursor = working;
        for (const part of file.path.split("/")) {
          cursor = join(cursor, part);
          const info = await lstat(cursor).catch((error) =>
            error.code === "ENOENT" ? null : Promise.reject(error),
          );
          if (info?.isSymbolicLink())
            throw Error("Prepared source path contains a symlink.");
        }
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.after);
      }
      await execute({ cwd: working, figmaToken, timeoutMs });
      const outputs = await readOutputs(working);
      for (const required of [
        "manifest.json",
        "json/all-tokens.json",
        "css/base.css",
        "themes/themes.module.css",
      ]) {
        if (!outputs.has(outputPrefix + required))
          throw Error(`Token build did not produce ${required}.`);
      }
      const manifest = JSON.parse(outputs.get(outputPrefix + "manifest.json"));
      const css = [...outputs]
        .filter(([path]) => path.endsWith(".css"))
        .map(([, value]) => value)
        .join("\n");
      const allowedNames = new Set();
      const requiredTokens = (proposal.tokens ?? []).filter(
        (token) => !token.existing || token.before !== undefined,
      );
      for (const token of requiredTokens) {
        const original = bundle?.tokens?.find((value) => value.id === token.id);
        const name = token.existing
          ? (original?.css?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1] ?? token.id)
          : (proposal.tokenNames?.[token.id] ?? token.name);
        allowedNames.add(name);
        if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
          throw Error("Invalid authored token name.");
        // Fondue intentionally omits base primitive colors from its SDK manifest.
        // They still must exist as CSS variables; themed colors and numeric tokens
        // retain the normal manifest export requirement.
        const modes = Object.keys(token.values ?? {});
        const primitiveColor =
          token.type === "COLOR" &&
          modes.length === 1 &&
          /^(value|default)$/i.test(modes[0]);
        if (
          !primitiveColor &&
          !manifest.tokens?.some(
            (entry) =>
              entry.id === name && entry.cssVariable === `var(--${name})`,
          )
        )
          throw Error(`Token build did not export ${name} in the manifest.`);
        if (!new RegExp(`--${name}\\s*:`).test(css))
          throw Error(`Token build did not export ${name} in CSS.`);
        const baseCss = outputs.get(outputPrefix + "css/base.css");
        if (
          [...baseCss.matchAll(new RegExp(`--${name}\\s*:`, "g"))].length !== 1
        )
          throw Error(
            `Token ${name} has an ambiguous or missing base CSS declaration. Review its authoring path.`,
          );
      }
      // A live upstream Figma fetch must not smuggle unrelated token edits into a
      // selected-object PR. Compare every nonselected CSS token across modes.
      const declarations = (value) => {
        const result = new Map();
        for (const match of value.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
          if (!allowedNames.has(match[1]))
            result.set(match[1], [
              ...(result.get(match[1]) ?? []),
              match[2].trim(),
            ]);
        }
        return JSON.stringify(
          [...result].sort(([a], [b]) => a.localeCompare(b)),
        );
      };
      for (const [path, after] of outputs) {
        if (
          path.endsWith(".css") &&
          declarations(beforeOutputs.get(path) ?? "") !== declarations(after)
        )
          throw Error(
            `Unrelated token changes detected in ${path}. Refresh the reviewed Fondue baseline before pushing.`,
          );
      }
      for (const path of beforeOutputs.keys())
        if (!outputs.has(path))
          throw Error(
            `Token build removed ${path}; an explicit migration is required.`,
          );
      const generated = [...outputs]
        .filter(([path, after]) => beforeOutputs.get(path) !== after)
        .map(([path, after]) => ({
          path,
          before: beforeOutputs.get(path) ?? null,
          after,
        }));
      if (!generated.length)
        throw Error(
          "Token build produced no changed outputs for the authored token changes.",
        );
      const result = new Map(files.map((file) => [file.path, file]));
      for (const file of generated) result.set(file.path, file);
      return {
        files: [...result.values()],
        issues: [],
        checks: [
          "Fondue token build: passed in isolated copy; generated exports verified",
        ],
      };
    } catch (error) {
      return {
        files,
        issues: [
          failure(
            "token-build-failed",
            error instanceof Error
              ? error.message
              : "Isolated token generation failed.",
          ),
        ],
        checks: [],
      };
    } finally {
      if (temp) await rm(temp, { recursive: true, force: true });
    }
  };
}
