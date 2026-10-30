import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const authoringPath = "packages/tokens/repository-tokens.json";
const builderPath =
  "packages/tokens/src/styleDictionary/buildStyleDictionary.ts";
const marker = "source: [allTokensPath]";
const hook =
  "source: [allTokensPath, new URL('../../repository-tokens.json', import.meta.url).pathname]";
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validName = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const sort = (value) =>
  Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, sort(value[k])]),
        )
      : value;
const serialize = (value) => JSON.stringify(sort(value), null, 4) + "\n";
function pathFor(name, manifest, sourceToken) {
  const existing = manifest.tokens?.find((t) => t.id === name);
  if (existing)
    return existing.category === "colors"
      ? ["color", ...existing.keyPath.slice(1)]
      : existing.keyPath.slice(1);
  if (
    sourceToken?.type === "COLOR" &&
    sourceToken.name?.includes("/") &&
    sourceToken.name.replaceAll("/", "-") === name
  )
    return sourceToken.name.split("/");
  const prefix = [
    "typography-font-size",
    "typography-line-height",
    "typography-letter-spacing",
    "border-radius",
    "border-width",
    "spacing",
    "size",
    "color",
    "opacity",
  ].find((p) => name.startsWith(p + "-"));
  if (!prefix)
    throw Error(
      "Choose a token name with a color, spacing, size, border, typography or opacity category.",
    );
  return prefix.startsWith("typography-")
    ? ["typography", prefix.slice(11), name.slice(prefix.length + 1)]
    : [prefix, name.slice(prefix.length + 1)];
}
function get(tree, path) {
  return path.reduce(
    (value, key) => (value && own(value, key) ? value[key] : undefined),
    tree,
  );
}
function set(tree, path, value) {
  let node = tree;
  for (const part of path.slice(0, -1)) {
    if (["__proto__", "prototype", "constructor"].includes(part))
      throw Error("Invalid token path.");
    if (node[part]?.value !== undefined)
      throw Error("Token path conflicts with an existing token.");
    node = node[part] ??= {};
  }
  const last = path.at(-1);
  if (["__proto__", "prototype", "constructor"].includes(last))
    throw Error("Invalid token name.");
  if (node[last] && node[last].value === undefined)
    throw Error("Token name conflicts with an existing group.");
  node[last] = value;
}
function normalizeValue(token, value, references) {
  const alias =
    value?.alias ?? (value?.type === "VARIABLE_ALIAS" ? value.id : undefined);
  if (alias) {
    const target = references.get(alias);
    if (!target) throw Error(`Unresolved token alias: ${alias}`);
    if (target.type !== token.type)
      throw Error(`Token alias type mismatch: ${token.name}`);
    return "ref_" + target.cssName;
  }
  if (token.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw Error(
        "Size, spacing and border values must be finite non-negative numbers.",
      );
    return value;
  }
  if (token.type === "COLOR") {
    if (
      !value ||
      typeof value !== "object" ||
      !["r", "g", "b"].every(
        (k) => typeof value[k] === "number" && value[k] >= 0 && value[k] <= 1,
      )
    )
      throw Error("Colors must contain r/g/b values between 0 and 1.");
    const alpha = value.a ?? 1;
    if (
      typeof alpha !== "number" ||
      !Number.isFinite(alpha) ||
      alpha < 0 ||
      alpha > 1
    )
      throw Error("Color alpha must be between 0 and 1.");
    return { r: value.r, g: value.g, b: value.b, a: alpha };
  }
  throw Error(`Token type ${token.type} needs a dedicated authoring adapter.`);
}
/** Proposes durable repository-owned tokens through the existing Style Dictionary
 * build. Figma remains the input for other tokens. Generated outputs are built by
 * Fondue's token pipeline; never mistake authored source for a completed build.
 */
export function createTokenAuthoringAdapter({ bundle }) {
  return {
    reproducible: true,
    preservesImport: true,
    async generate({ tokens, tokenNames = {}, sourceRoot, baselineRoot }) {
      const read = (p) => readFile(join(sourceRoot, p), "utf8");
      const original = await read(authoringPath).catch((e) =>
        e.code === "ENOENT" ? null : Promise.reject(e),
      );
      const tree = original === null ? {} : JSON.parse(original);
      if (!tree || typeof tree !== "object" || Array.isArray(tree))
        throw Error("Invalid repository token source.");
      const manifest = JSON.parse(
        await read("packages/tokens/dist/manifest.json"),
      );
      // Compare the exact edited token declarations, preserving unrelated token
      // changes while preventing an imported value from overwriting upstream drift.
      if (baselineRoot && tokens.some((token) => token.existing)) {
        for (const file of [
          "packages/tokens/dist/css/base.css",
          "packages/tokens/dist/themes/themes.module.css",
        ]) {
          const baseline = await readFile(join(baselineRoot, file), "utf8");
          const pinned = bundle.provenance?.inputs?.[file];
          if (
            pinned &&
            createHash("sha256").update(baseline).digest("hex") !== pinned
          )
            throw Error("Pinned token baseline hash differs from bundle.");
          const current = await read(file);
          for (const token of tokens.filter((token) => token.existing)) {
            const definition = bundle.tokens.find((t) => t.id === token.id);
            const name = definition?.css?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1];
            if (!name)
              throw Error(
                "This variable has no exported source token. Propose a new authored token instead.",
              );
            const values = (text) =>
              [
                ...text
                  .replace(/\/\*[\s\S]*?\*\//g, "")
                  .matchAll(
                    new RegExp(
                      `(?:^|[;{}])\\s*--${name}\\s*:\\s*([^;}]+)`,
                      "g",
                    ),
                  ),
              ].map((match) => match[1].trim());
            if (
              JSON.stringify(values(baseline)) !==
              JSON.stringify(values(current))
            )
              throw Error(
                `Upstream token ${name} changed since import. Resolve the token conflict before pushing.`,
              );
          }
        }
      }
      const references = new Map(
        bundle.tokens.map((t) => [
          t.id,
          {
            ...t,
            cssName: t.css?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1] ?? t.id,
          },
        ]),
      );
      const names = new Set();
      for (const token of tokens) {
        const cssName = token.existing
          ? references.get(token.id)?.cssName
          : (tokenNames[token.id] ?? token.name);
        if (!validName(cssName))
          throw Error(`Choose a CSS token name for ${token.name}.`);
        if (names.has(cssName)) throw Error(`Duplicate token name: ${cssName}`);
        names.add(cssName);
        if (
          !token.existing &&
          (bundle.tokens.some(
            (t) => t.id === cssName || t.css === `var(--${cssName})`,
          ) ||
            manifest.tokens?.some((t) => t.id === cssName))
        )
          throw Error(`Token already exists: ${cssName}`);
        references.set(token.id, { ...token, cssName });
      }
      const visit = (id, chain = new Set()) => {
        if (chain.has(id)) throw Error(`Token alias cycle at ${id}`);
        const token = references.get(id);
        if (!token) throw Error(`Missing token ${id}`);
        for (const value of Object.values(token.values ?? {})) {
          const alias =
            value?.alias ??
            (value?.type === "VARIABLE_ALIAS" ? value.id : undefined);
          if (alias) {
            const next = new Set(chain);
            next.add(id);
            visit(alias, next);
          }
        }
      };
      for (const token of tokens) {
        visit(token.id);
        const cssName = references.get(token.id).cssName;
        const path = pathFor(
          cssName,
          manifest,
          token.existing ? references.get(token.id) : undefined,
        );
        const color = token.type === "COLOR";
        if ((path[0] === "color") !== color)
          throw Error("Token category does not match its value type.");
        const entries = Object.entries(token.values ?? {});
        if (!entries.length)
          throw Error(`Token ${cssName} has no mode values.`);
        const themed = entries.some(([mode]) => /^(light|dark)$/i.test(mode));
        if (
          themed &&
          (!entries.some(([m]) => /^light$/i.test(m)) ||
            !entries.some(([m]) => /^dark$/i.test(m)))
        )
          throw Error(`Token ${cssName} requires both Light and Dark values.`);
        if (entries.length > 1 && !themed)
          throw Error("Only Value or Light/Dark token modes are supported.");
        for (const [mode, value] of entries) {
          if (path[0] === "opacity" && typeof value === "number" && value > 1)
            throw Error("Opacity token values must be between 0 and 1.");
          const theme = themed ? mode.toLowerCase() : "default";
          if (themed && !["light", "dark"].includes(theme))
            throw Error(`Unsupported token mode ${mode}`);
          const tokenPath = [theme, ...path];
          const existing = get(tree, tokenPath);
          if (!token.existing && existing)
            throw Error(`Repository-owned token already exists: ${cssName}`);
          set(tree, tokenPath, {
            name: path.join("/"),
            type: color ? "color" : "float",
            value: normalizeValue(token, value, references),
            attributes: {
              collection: "repository",
              type: themed ? "theme" : "base",
              theme,
              ...(!color && path[0] !== "opacity"
                ? {
                    unit: /^(spacing|border-radius)$/.test(path[0])
                      ? "rem"
                      : "px",
                  }
                : {}),
            },
          });
        }
      }
      const beforeBuilder = await read(builderPath);
      let afterBuilder = beforeBuilder;
      if (!beforeBuilder.includes(hook)) {
        if (beforeBuilder.split(marker).length !== 2)
          throw Error(
            "Token build source changed. Review the repository-token build hook.",
          );
        afterBuilder = beforeBuilder.replace(marker, hook);
      }
      const files = [
        { path: authoringPath, before: original, after: serialize(tree) },
      ];
      if (afterBuilder !== beforeBuilder)
        files.push({
          path: builderPath,
          before: beforeBuilder,
          after: afterBuilder,
        });
      return {
        files,
        warnings: [
          "Repository-owned tokens override their matching Figma inputs. Review token ownership and regenerate token outputs before merge.",
        ],
      };
    },
  };
}
