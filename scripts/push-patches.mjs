import { createTokenAuthoringAdapter } from "./push-tokens.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  buildReverseCoverage,
  candidatesForChange,
  declarations,
  sourceDeclarations,
  hasRootStyleClass,
  selectorMatchesVariant,
  replacePaddingSide,
  scssBlocks,
  tokenCompatibleWithProperty,
  sourcePaths,
  visualProperties,
} from "../recipes/reverse-mappings.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const issue = (code, message, extra = {}) => ({
  code,
  message,
  blocking: true,
  ...extra,
});
const identifier = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const safePath = (value) =>
  typeof value === "string" &&
  /^packages\/[a-z-]+\//.test(value) &&
  !value.split("/").some((v) => v === ".." || v === ".") &&
  !value.includes("\\");

/** Build an in-memory patch only. Never modifies the repository or sync ledger.
 * mappings are trusted server configuration, not accepted from plugin messages.
 */
export async function generatePushPatch({
  proposal,
  sourceRoot,
  baselineRoot = path.join(root, ".cache/release"),
  bundle,
  mappings = [],
  tokenAuthoring,
}) {
  bundle ??= JSON.parse(
    await readFile(path.join(root, "bundles/fondue-13.11.1.json"), "utf8"),
  );
  if (tokenAuthoring === undefined)
    tokenAuthoring = createTokenAuthoringAdapter({ bundle });
  const issues = [],
    warnings = [],
    files = new Map(),
    edits = new Map(),
    baselines = new Map();
  const read = (p) => readFile(path.join(sourceRoot, p), "utf8");
  if (
    proposal.sourceCommit !== bundle.provenance.commit ||
    proposal.fingerprint !== bundle.fingerprint
  )
    issues.push(
      issue(
        "baseline-mismatch",
        "The proposal does not match this service’s reviewed source bundle. Refresh the plugin or configure the matching bundle.",
      ),
    );
  const coverage = await buildReverseCoverage(bundle, read, mappings);
  // Structural or unrepresentable selection edits cannot be silently dropped
  // while publishing its remaining visual changes. Reselect a clean object to
  // narrow the proposal when any scan issue cannot be safely scoped.
  for (const scanIssue of proposal.issues ?? []) {
    if (scanIssue.blocking !== false)
      issues.push(
        issue(
          scanIssue.code ?? "selection-blocked",
          scanIssue.message ?? "Selection requires review.",
          { nodeId: scanIssue.nodeId },
        ),
      );
  }
  const changes = proposal.changes ?? [];
  if (!changes.length)
    issues.push(issue("empty-proposal", "Select at least one change."));
  const load = async (p) => {
    if (files.has(p)) return files.get(p);
    if (!safePath(p)) throw Error("Invalid source path.");
    const before = await read(p);
    const baseline = await readFile(path.join(baselineRoot, p), "utf8");
    const pinned = bundle.provenance.inputs?.[p];
    if (pinned && hash(baseline) !== pinned)
      throw Error("Pinned source baseline hash differs from bundle.");
    baselines.set(p, baseline);
    const file = { path: p, before, after: before };
    files.set(p, file);
    return file;
  };
  const tokens = new Map((proposal.tokens ?? []).map((t) => [t.id, t]));
  const newTokens = [...tokens.values()].filter(
    (t) => !t.existing || (t.before && !isDeepStrictEqual(t.before, t.values)),
  );
  if (newTokens.length && !tokenAuthoring)
    issues.push(
      issue(
        "token-authoring-unconfigured",
        "New tokens require a durable upstream token-authoring adapter. Generated dist files alone would be overwritten by the Figma import workflow.",
      ),
    );
  for (const change of changes) {
    if (change.scope === "shared-token") {
      if (!tokenAuthoring)
        issues.push(
          issue(
            "shared-token-adapter-required",
            "Shared token value changes require the upstream token-authoring adapter and impact review.",
            { changeId: change.id },
          ),
        );
      warnings.push("Shared token change: review all consumers and themes.");
      continue;
    }
    const recipe = bundle.recipes.find((r) => r.id === change.recipeId);
    if (!recipe) {
      issues.push(
        issue("unknown-component", `Unknown component ${change.recipeId}.`),
      );
      continue;
    }
    let matches = mappings.filter(
      (m) =>
        m.recipeId === change.recipeId &&
        m.layerId === change.layerId &&
        m.figmaProperty === change.property &&
        (!m.variantId || m.variantId === change.variantId),
    );
    if (!matches.length && !proposal.mappingChoices?.[change.id]) {
      const variant = recipe.variants?.find((v) => v.id === change.variantId);
      const field = change.property.replace(/^boundVariables\./, "");
      const beforeToken = variant?.root?.bindings?.[field];
      if (variant?.root?.id === change.layerId && beforeToken) {
        const candidates = candidatesForChange(change, coverage).filter(
          (c) =>
            selectorMatchesVariant(c.selector, variant.props ?? {}) &&
            (c.expectedValue === `var(--${beforeToken})` ||
              (beforeToken.startsWith("component-constant-") &&
                field === "cornerRadius" &&
                c.expectedValue === `${variant.root.radius}px`)),
        );
        const verified = [];
        for (const candidate of candidates) {
          for (const tsxPath of recipe.source.filter(
            (p) =>
              p.endsWith(".tsx") &&
              (!beforeToken.startsWith("component-constant-") ||
                path.posix.basename(p, ".tsx") === recipe.id.split("/")[1]),
          )) {
            const tsx = await read(tsxPath).catch(() => "");
            const relative =
              "./" +
              path.posix.relative(path.posix.dirname(tsxPath), candidate.path);
            if (
              (tsx.includes(`from '${relative}'`) ||
                tsx.includes(`from \"${relative}\"`)) &&
              hasRootStyleClass(tsx)
            )
              verified.push(candidate);
          }
        }
        const unique = [...new Map(verified.map((c) => [c.id, c])).values()];
        if (unique.length === 1)
          matches = [
            {
              ...unique[0],
              allowLiteralPromotion: /^-?[0-9.]+px$/.test(
                unique[0].expectedValue,
              ),
              recipeId: change.recipeId,
              layerId: change.layerId,
              figmaProperty: change.property,
            },
          ];
      }
    }
    if (!matches.length && proposal.mappingChoices?.[change.id]) {
      const choice = candidatesForChange(change, coverage).find(
        (c) => c.id === proposal.mappingChoices[change.id],
      );
      if (choice)
        matches = [
          {
            ...choice,
            recipeId: change.recipeId,
            layerId: change.layerId,
            figmaProperty: change.property,
            allowLiteralPromotion: /^-?[0-9.]+(?:px|rem|em|%)?$/.test(
              choice.expectedValue,
            ),
            ...(choice.tokenReferences?.length === 1
              ? { replaceToken: choice.tokenReferences[0] }
              : {}),
          },
        ];
    }
    if (matches.length !== 1) {
      issues.push(
        issue(
          "mapping-required",
          `Review the exact source target for ${recipe.name} / ${change.layerId} / ${change.property}.`,
          {
            changeId: change.id,
            candidates: candidatesForChange(change, coverage),
          },
        ),
      );
      continue;
    }
    const mapping = matches[0];
    if (
      !sourcePaths(recipe).includes(mapping.path) ||
      !visualProperties[
        change.property.replace(/^boundVariables\./, "")
      ]?.includes(mapping.property)
    ) {
      issues.push(
        issue(
          "invalid-mapping",
          "Mapping points outside the owning style source or visual property.",
          { changeId: change.id },
        ),
      );
      continue;
    }
    try {
      const file = await load(mapping.path);
      const currentDeclarations = sourceDeclarations(mapping.path, file.before);
      const baselineSource = baselines.get(mapping.path);
      const baselineDeclarations = sourceDeclarations(
        mapping.path,
        baselineSource,
      );
      let declaration;
      if (mapping.kind === "insert") {
        if (!/\.s?css$/.test(mapping.path) || mapping.expectedValue !== "")
          throw Error(
            "New properties require an existing reviewed SCSS selector.",
          );
        const currentBlocks = scssBlocks(file.before),
          baselineBlocks = scssBlocks(baselineSource);
        const currentTargets = currentBlocks.filter(
            (b) => b.selector === mapping.selector,
          ),
          baselineTargets = baselineBlocks.filter(
            (b) => b.selector === mapping.selector,
          );
        if (currentTargets.length !== 1 || baselineTargets.length !== 1)
          throw Error(
            "Insertion selector is missing or ambiguous in the imported baseline or current source.",
          );
        const currentBlock = currentTargets[0],
          baselineBlock = baselineTargets[0];
        const structure = (blocks, block) =>
          blocks
            .filter((b) => b.start >= block.start && b.end <= block.end)
            .map((b) => b.selector);
        if (
          JSON.stringify(structure(currentBlocks, currentBlock)) !==
          JSON.stringify(structure(baselineBlocks, baselineBlock))
        )
          throw Error(
            "Insertion selector structure changed since the imported baseline.",
          );
        if (
          [...currentDeclarations, ...baselineDeclarations].some(
            (d) =>
              d.selector === mapping.selector &&
              d.property === mapping.property,
          )
        )
          throw Error(
            "Property already exists in the baseline or current selector; review the existing declaration instead.",
          );
        declaration = {
          selector: mapping.selector,
          property: mapping.property,
          value: "",
          start: currentBlock.start,
          end: currentBlock.start,
          tokens: [],
          kind: "insert",
        };
      } else {
        const candidates = currentDeclarations.filter(
          (d) =>
            d.selector === mapping.selector && d.property === mapping.property,
        );
        if (
          candidates.length !== 1 ||
          candidates[0].value !== mapping.expectedValue
        )
          throw Error(
            "Declaration is ambiguous or no longer matches the reviewed mapping.",
          );
        declaration = candidates[0];
        const baselineTargets = baselineDeclarations.filter(
          (d) =>
            d.selector === mapping.selector && d.property === mapping.property,
        );
        if (
          baselineTargets.length !== 1 ||
          baselineTargets[0].value !== mapping.expectedValue
        )
          throw Error(
            "Mapped source property changed since the imported baseline or is ambiguous; review and rebase this property.",
          );
      }
      const key = `${mapping.path}:${declaration.start}:${declaration.end}${declaration.kind === "insert" ? ":" + declaration.property : ""}`;
      const previous = edits.get(key);
      let replacement;
      // Only named, approved tokens enter component styles. Literals must first
      // be promoted into the durable authoring pipeline.
      const nextId =
        typeof change.after === "string"
          ? change.after
          : (change.after?.tokenId ??
            (change.tokenIds?.length === 1 ? change.tokenIds[0] : undefined));
      const token =
        tokens.get(nextId) ?? bundle.tokens.find((t) => t.id === nextId);
      if (!token)
        throw Error(
          "Resolve this value to an existing token or an authored new token before generating code.",
        );
      const field = change.property.replace(/^boundVariables\./, "");
      const expectedType = ["fills", "strokes"].includes(field)
        ? "COLOR"
        : "FLOAT";
      if (token.type && token.type !== expectedType)
        throw Error(`Expected a ${expectedType} token for ${field}.`);
      const tokenName =
        token.existing === false
          ? (proposal.tokenNames?.[token.id] ?? token.name)
          : (token.css?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1] ?? token.id);
      if (
        !identifier(tokenName) ||
        token.provenance?.origin === "reviewed-native-recipe-constant"
      )
        throw Error(
          "This variable is not an exported CSS token. Create an authored token or choose an existing one.",
        );
      if (
        !tokenCompatibleWithProperty(token, field, tokenName, [
          ...bundle.tokens,
          ...tokens.values(),
        ])
      )
        throw Error(
          `Token ${tokenName} belongs to an incompatible semantic category for ${field}.`,
        );
      if (field === "opacity") {
        const seen = new Set();
        const checkOpacity = (current) => {
          if (seen.has(current.id)) return;
          seen.add(current.id);
          for (const value of Object.values(current.values ?? {})) {
            if (
              typeof value === "number" &&
              (!Number.isFinite(value) || value < 0 || value > 1)
            )
              throw Error(
                "Opacity tokens must use unitless values between 0 and 1.",
              );
            const alias =
              value?.alias ??
              (value?.type === "VARIABLE_ALIAS" ? value.id : undefined);
            const target =
              tokens.get(alias) ?? bundle.tokens.find((t) => t.id === alias);
            if (target) checkOpacity(target);
          }
        };
        checkOpacity(token);
      }
      replacement = `var(--${tokenName})`;
      if (declaration.kind === "insert") {
        const suffix = file.before.slice(declaration.start);
        const existingIndent = suffix.match(/^\s*\n([ \t]+)\S/)?.[1];
        const selectorLine = file.before
          .slice(0, declaration.start)
          .split("\n")
          .at(-1);
        const indent =
          existingIndent ?? (selectorLine.match(/^[ \t]*/)?.[0] ?? "") + "    ";
        replacement =
          `\n${indent}${declaration.property}: ${replacement};` +
          (/^\s*\n/.test(suffix) ? "" : `\n${indent}`);
      } else if (
        declaration.property === "padding" &&
        field.startsWith("padding")
      ) {
        replacement = replacePaddingSide(
          previous?.replacement ?? declaration.value,
          field,
          replacement,
        );
      } else if (mapping.replaceToken) {
        const original = `var(--${mapping.replaceToken})`;
        if (declaration.value.split(original).length !== 2)
          throw Error("Mapped token reference is missing or ambiguous.");
        replacement = declaration.value.replace(original, replacement);
      } else if (declaration.kind === "tailwind") {
        const base = declaration.value.split(":").at(-1);
        const modifiers = declaration.value.slice(
          0,
          declaration.value.length - base.length,
        );
        replacement = `${modifiers}${base.startsWith("!") ? "!" : ""}tw-[${declaration.property}:var(--${tokenName})]`;
      } else if (
        !/^var\(--[a-z0-9-]+\)$/.test(declaration.value) &&
        !mapping.allowLiteralPromotion
      ) {
        throw Error(
          "Calculated or literal declarations require an explicit reviewed token replacement mapping.",
        );
      }
      if (
        previous &&
        previous.replacement !== replacement &&
        !(
          declaration.property === "padding" &&
          field.startsWith("padding") &&
          (!previous.fields?.[field] || previous.fields[field] === tokenName)
        )
      )
        throw Error(
          "Selected changes propose conflicting values for one source declaration.",
        );
      edits.set(key, {
        path: mapping.path,
        start: declaration.start,
        end: declaration.end,
        replacement,
        fields: { ...(previous?.fields ?? {}), [field]: tokenName },
      });
      // A component's calculated inner radius must keep following its outer
      // radius. Update only radius references to this exact token in this same
      // owning stylesheet; slot-specific zero radii and focus rules stay intact.
      if (change.property.replace(/^boundVariables\./, "") === "cornerRadius") {
        const oldTokens = declaration.tokens;
        if (
          oldTokens.length === 1 &&
          declaration.value === `var(--${oldTokens[0]})`
        ) {
          for (const dependent of declarations(file.before).filter(
            (d) =>
              /radius$/.test(d.property) &&
              d.tokens.includes(oldTokens[0]) &&
              d.start !== declaration.start,
          )) {
            const baselineDependents = baselineDeclarations.filter(
              (d) =>
                d.selector === dependent.selector &&
                d.property === dependent.property,
            );
            if (
              baselineDependents.length !== 1 ||
              baselineDependents[0].value !== dependent.value
            )
              throw Error(
                "Calculated radius dependency changed since the imported baseline or is ambiguous.",
              );
            const oldReference = `var(--${oldTokens[0]})`;
            const dependentReplacement = dependent.value
              .split(oldReference)
              .join(`var(--${tokenName})`);
            const dependentKey = `${mapping.path}:${dependent.start}:${dependent.end}`;
            if (
              edits.has(dependentKey) &&
              edits.get(dependentKey).replacement !== dependentReplacement
            )
              throw Error("Conflicting calculated radius dependency.");
            edits.set(dependentKey, {
              path: mapping.path,
              start: dependent.start,
              end: dependent.end,
              replacement: dependentReplacement,
            });
          }
        }
      }
      if (!mapping.variantId)
        warnings.push(
          `${recipe.name}: this declaration is shared across source variants; review its full impact.`,
        );
    } catch (error) {
      issues.push(
        issue("source-conflict", `${mapping.path}: ${error.message}`, {
          changeId: change.id,
        }),
      );
    }
  }
  if (tokenAuthoring && newTokens.length) {
    // Adapter returns durable source and regenerated outputs; service config owns
    // it. It must attest a reproducible build and protect the existing Figma import.
    if (!tokenAuthoring.reproducible || !tokenAuthoring.preservesImport)
      issues.push(
        issue(
          "invalid-token-authoring",
          "Token adapter must declare reproducibility and preservation across upstream Figma imports.",
        ),
      );
    else {
      try {
        const authored = await tokenAuthoring.generate({
          tokens: newTokens,
          tokenNames: proposal.tokenNames ?? {},
          sourceRoot,
          baselineRoot,
        });
        warnings.push(...(authored.warnings ?? []));
        for (const file of authored.files ?? []) {
          if (
            !safePath(file.path) ||
            !file.path.startsWith("packages/tokens/") ||
            files.has(file.path)
          )
            throw Error("Invalid or duplicate token authoring path.");
          const actual = await read(file.path).catch((e) =>
            e.code === "ENOENT" ? null : Promise.reject(e),
          );
          if (actual !== file.before)
            throw Error(`Token source conflict: ${file.path}`);
          files.set(file.path, file);
        }
        if (!(authored.files ?? []).some((f) => !f.path.includes("/dist/")))
          throw Error("Token adapter only produced generated outputs.");
      } catch (error) {
        issues.push(issue("token-authoring-failed", error.message));
      }
    }
  }
  for (const file of files.values()) {
    for (const edit of [...edits.values()]
      .filter((e) => e.path === file.path)
      .sort((a, b) => b.start - a.start))
      file.after =
        file.after.slice(0, edit.start) +
        edit.replacement +
        file.after.slice(edit.end);
  }
  return {
    files: issues.length
      ? []
      : [...files.values()].filter((f) => f.before !== f.after),
    issues,
    warnings,
    coverage,
    checks: [
      "format",
      "lint",
      "typecheck",
      "build",
      "unit-tests",
      "component-tests",
      "accessibility",
      "visual-review",
      "changeset",
    ],
  };
}
