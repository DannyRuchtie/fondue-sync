import ts from "typescript";
/** Reverse mappings refer to declarations, never to coincidentally equal values.
 * Every recipe is inventoried; only explicitly reviewed layer/property targets
 * are executable. Candidate discovery is deliberately separate from approval.
 */
export const visualProperties = Object.freeze({
  cornerRadius: ["border-radius"],
  topLeftRadius: ["border-top-left-radius", "border-start-start-radius"],
  topRightRadius: ["border-top-right-radius", "border-start-end-radius"],
  bottomLeftRadius: ["border-bottom-left-radius", "border-end-start-radius"],
  bottomRightRadius: ["border-bottom-right-radius", "border-end-end-radius"],
  paddingTop: ["padding-top", "padding-block-start", "padding"],
  paddingBottom: ["padding-bottom", "padding-block-end", "padding"],
  paddingLeft: ["padding-left", "padding-inline-start", "padding"],
  paddingRight: ["padding-right", "padding-inline-end", "padding"],
  itemSpacing: ["gap", "column-gap", "row-gap"],
  width: ["width"],
  height: ["height"],
  strokeWeight: ["border-width"],
  fills: ["background-color", "background", "color"],
  strokes: ["border-color"],
  fontSize: ["font-size"],
  lineHeight: ["line-height"],
  letterSpacing: ["letter-spacing"],
  opacity: ["opacity"],
});

/** Lex SCSS declaration boundaries while retaining exact immutable source offsets.
 * Interpolation, mixins and variables remain candidates for manual mapping only.
 */
export function declarations(source) {
  const result = [],
    stack = [];
  let start = 0,
    quote = "",
    comment = "",
    parens = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i],
      next = source[i + 1];
    if (comment === "line") {
      if (ch === "\n") {
        comment = "";
        start = i + 1;
      }
      continue;
    }
    if (comment === "block") {
      if (ch === "*" && next === "/") {
        comment = "";
        i++;
        start = i + 1;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "*") {
      comment = "block";
      i++;
      continue;
    }
    if (ch === "/" && next === "/" && parens === 0) {
      comment = "line";
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[") parens++;
    if (ch === ")" || ch === "]") parens--;
    if (parens) continue;
    if (ch === "{") {
      stack.push(source.slice(start, i).trim());
      start = i + 1;
    } else if (ch === "}") {
      stack.pop();
      start = i + 1;
    } else if (ch === ";") {
      const raw = source.slice(start, i),
        match = raw.match(/^\s*([a-z][a-z-]*)\s*:\s*([\s\S]*?)\s*$/);
      if (
        match &&
        stack.length &&
        !stack.some((s) => s.startsWith("@") || s.includes("#{"))
      ) {
        const valueStart =
          start +
          raw.indexOf(":") +
          1 +
          raw.slice(raw.indexOf(":") + 1).search(/\S/);
        const value = match[2];
        result.push({
          selector: stack.join(" > "),
          property: match[1],
          value,
          start: valueStart,
          end: valueStart + value.length,
          tokens: [...value.matchAll(/var\(\s*--([a-z0-9-]+)\s*(?:,|\))/g)].map(
            (m) => m[1],
          ),
        });
      }
      start = i + 1;
    }
  }
  return result;
}

export function sourcePaths(recipe) {
  return [
    ...new Set(
      recipe.source.filter(
        (p) =>
          /\.(?:s?css|tsx)$/.test(p) &&
          /^packages\/[a-z-]+\/src\//.test(p) &&
          !p.includes("/utilities/"),
      ),
    ),
  ];
}

export async function buildReverseCoverage(bundle, readSource, mappings = []) {
  const entries = await Promise.all(
    bundle.recipes.map(async (recipe) => {
      const sources = [];
      for (const path of sourcePaths(recipe)) {
        try {
          const source = await readSource(path);
          sources.push({
            path,
            declarations: sourceDeclarations(path, source),
            blocks:
              path.endsWith(".scss") || path.endsWith(".css")
                ? scssBlocks(source)
                : [],
          });
        } catch {
          sources.push({ path, declarations: [], missing: true });
        }
      }
      return {
        recipeId: recipe.id,
        componentName: recipe.name,
        sources,
        reviewedMappings: mappings.filter((m) => m.recipeId === recipe.id),
        status: mappings.some((m) => m.recipeId === recipe.id)
          ? "mapped"
          : "needs-review",
        reason: sources.length
          ? "Review exact layer/property declaration mappings before pushing."
          : "No owning SCSS declarations; needs a component-specific adapter.",
      };
    }),
  );
  return {
    total: entries.length,
    mapped: entries.filter((e) => e.status === "mapped").length,
    entries,
  };
}

/** A mapping is an explicit reviewed record, including a pinned declaration value.
 * No token-value matching is used to manufacture an executable source mapping.
 */
export function candidatesForChange(change, coverage) {
  const property = change.property.replace(/^boundVariables\./, "");
  const cssProperties = visualProperties[property] ?? [];
  const entry = coverage.entries.find((e) => e.recipeId === change.recipeId);
  return (entry?.sources ?? []).flatMap((s) => {
    const existing = s.declarations
      .filter((d) => cssProperties.includes(d.property))
      .map((d) => ({
        id: [
          change.recipeId,
          change.layerId,
          change.property,
          s.path,
          d.selector,
          d.property,
          d.value,
        ].join("::"),
        path: s.path,
        selector: d.selector,
        property: d.property,
        expectedValue: d.value,
        tokenReferences: d.tokens,
        kind: d.kind,
        start: d.start,
      }));
    const cssProperty = cssProperties[0];
    const insertions = !cssProperty
      ? []
      : (s.blocks ?? [])
          .filter(
            (block) =>
              s.blocks.filter((b) => b.selector === block.selector).length ===
                1 &&
              !s.declarations.some(
                (d) =>
                  d.selector === block.selector &&
                  cssProperties.includes(d.property),
              ),
          )
          .map((block) => ({
            id: [
              change.recipeId,
              change.layerId,
              change.property,
              s.path,
              block.selector,
              cssProperty,
              "insert",
            ].join("::"),
            path: s.path,
            selector: block.selector,
            property: cssProperty,
            expectedValue: "",
            tokenReferences: [],
            kind: "insert",
          }));
    return [...existing, ...insertions];
  });
}

/** Static Tailwind class strings inside className JSX attributes only. Dynamic
 * expressions remain unsupported; no scanning/replacement of arbitrary TS text.
 */
export function tailwindDeclarations(source) {
  const ast = ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const result = [];
  const classes = {
    rounded: "border-radius",
    p: "padding",
    px: "padding-inline",
    py: "padding-block",
    pt: "padding-top",
    pb: "padding-bottom",
    pl: "padding-left",
    pr: "padding-right",
    gap: "gap",
    w: "width",
    h: "height",
    bg: "background-color",
    text: "color",
    border: "border-color",
    opacity: "opacity",
    leading: "line-height",
    tracking: "letter-spacing",
  };
  const classOwners = new Map();
  let classSequence = 0;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "className")
      classOwners.set(node, { id: classSequence++, strings: 0 });
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      let owner = node.parent;
      let safe = true;
      while (owner && !ts.isJsxAttribute(owner)) {
        // Never rewrite TypeScript types, property names, or inputs to unknown
        // transforms merely because they appear beneath a className expression.
        if (
          ts.isTypeNode(owner) ||
          ts.isPropertyAssignment(owner) ||
          ts.isComputedPropertyName(owner)
        )
          safe = false;
        if (
          ts.isCallExpression(owner) &&
          (!ts.isIdentifier(owner.expression) ||
            !["merge", "clsx", "classNames", "cn"].includes(
              owner.expression.text,
            ))
        )
          safe = false;
        owner = owner.parent;
      }
      if (safe && owner?.name?.getText(ast) === "className") {
        const identity = classOwners.get(owner);
        const selector = `className#${identity.id}:${identity.strings++}`;
        const raw = source.slice(node.getStart(ast) + 1, node.end - 1);
        for (const match of raw.matchAll(/\S+/g)) {
          const value = match[0],
            utility = value.split(":").at(-1).replace(/^!/, "");
          const key = utility.match(/^tw-([a-z]+)(?:-|$)/)?.[1];
          const property = classes[key];
          if (!property || value.includes("[") || value.includes("\\"))
            continue;
          const start = node.getStart(ast) + 1 + match.index;
          result.push({
            selector,
            property,
            value,
            start,
            end: start + value.length,
            tokens: [],
            kind: "tailwind",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}
export function sourceDeclarations(path, source) {
  return path.endsWith(".tsx")
    ? tailwindDeclarations(source)
    : declarations(source);
}

export function hasRootStyleClass(source) {
  const ast = ts.createSourceFile(
    "component.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === "className" &&
      node.initializer
    ) {
      function inspect(n) {
        if (
          ts.isPropertyAccessExpression(n) &&
          n.expression.getText(ast) === "styles" &&
          n.name.text === "root"
        )
          found = true;
        ts.forEachChild(n, inspect);
      }
      inspect(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
export function selectorMatchesVariant(selector, props) {
  if (selector === ".root") return true;
  const rest = selector.replace(/^\.root > /, "");
  if (
    rest === selector ||
    !/^&(?:\[data-[a-z-]+=['"][a-z0-9-]+['"]\])+$/.test(rest)
  )
    return false;
  return [...rest.matchAll(/\[data-([a-z-]+)=['"]([a-z0-9-]+)['"]\]/g)].every(
    ([, key, value]) =>
      String(
        props[key] ??
          props[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())],
      ) === value,
  );
}

export function replacePaddingSide(value, field, replacement) {
  const pieces = [];
  let start = 0,
    depth = 0;
  for (let i = 0; i <= value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if ((i === value.length || /\s/.test(ch)) && depth === 0) {
      const part = value.slice(start, i).trim();
      if (part) pieces.push(part);
      start = i + 1;
    }
  }
  if (
    depth !== 0 ||
    pieces.length < 1 ||
    pieces.length > 4 ||
    /[;{}!]/.test(value)
  )
    throw Error("Unsupported padding shorthand.");
  const sides =
    pieces.length === 1
      ? [pieces[0], pieces[0], pieces[0], pieces[0]]
      : pieces.length === 2
        ? [pieces[0], pieces[1], pieces[0], pieces[1]]
        : pieces.length === 3
          ? [pieces[0], pieces[1], pieces[2], pieces[1]]
          : pieces;
  const index = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ].indexOf(field);
  if (index < 0) throw Error("Unknown padding side.");
  sides[index] = replacement;
  return sides.join(" ");
}

/** Reject clear semantic category mismatches while preserving generic source
 * aliases whose role cannot be inferred from their name. Native scopes and alias
 * targets establish roles for otherwise generic names; FLOAT alone does not.
 */
export function tokenRole(token, cssName, tokens = [], seen = new Set()) {
  if (seen.has(token.id)) return undefined;
  seen.add(token.id);
  const name =
    cssName ??
    token.css?.match(/^var\(--([a-z0-9-]+)\)$/)?.[1] ??
    token.name?.replaceAll("/", "-") ??
    token.id;
  const categories = [
    ["radius", /^border-radius-/],
    ["border-width", /^border-width-/],
    ["spacing", /^spacing-/],
    ["size", /^(?:size|dimension)-/],
    ["color", /^color-/],
    ["font-size", /^(?:typography-font-size-|text-.*-font-size)/],
    ["line-height", /^(?:typography-line-height-|text-.*-line-height)/],
    [
      "letter-spacing",
      /^(?:typography-letter-spacing-|text-.*-letter-spacing)/,
    ],
    ["opacity", /^opacity-/],
  ];
  const named = categories.find(([, pattern]) => pattern.test(name));
  if (named) return named[0];
  const scopes = {
    CORNER_RADIUS: "radius",
    STROKE_FLOAT: "border-width",
    GAP: "spacing",
    WIDTH_HEIGHT: "size",
    FONT_SIZE: "font-size",
    LINE_HEIGHT: "line-height",
    LETTER_SPACING: "letter-spacing",
    OPACITY: "opacity",
  };
  const scoped = [
    ...new Set((token.scopes ?? []).map((s) => scopes[s]).filter(Boolean)),
  ];
  if (scoped.length === 1) return scoped[0];
  const aliasRoles = Object.values(token.values ?? {})
    .map(
      (value) =>
        value?.alias ??
        (value?.type === "VARIABLE_ALIAS" ? value.id : undefined),
    )
    .filter(Boolean)
    .map((id) => tokens.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => tokenRole(t, undefined, tokens, new Set(seen)))
    .filter(Boolean);
  return aliasRoles.length && new Set(aliasRoles).size === 1
    ? aliasRoles[0]
    : undefined;
}
export function tokenCompatibleWithProperty(
  token,
  field,
  cssName,
  tokens = [],
) {
  const role = tokenRole(token, cssName, tokens);
  if (!role) return true; // Generic source aliases remain valid unless disproven.
  const allowed = {
    cornerRadius: ["radius"],
    topLeftRadius: ["radius"],
    topRightRadius: ["radius"],
    bottomLeftRadius: ["radius"],
    bottomRightRadius: ["radius"],
    paddingTop: ["spacing", "size"],
    paddingRight: ["spacing", "size"],
    paddingBottom: ["spacing", "size"],
    paddingLeft: ["spacing", "size"],
    itemSpacing: ["spacing", "size"],
    width: ["size", "spacing"],
    height: ["size", "spacing"],
    strokeWeight: ["border-width"],
    strokeTopWeight: ["border-width"],
    strokeRightWeight: ["border-width"],
    strokeBottomWeight: ["border-width"],
    strokeLeftWeight: ["border-width"],
    fills: ["color"],
    strokes: ["color"],
    fontSize: ["font-size"],
    lineHeight: ["line-height"],
    letterSpacing: ["letter-spacing"],
    opacity: ["opacity"],
  };
  return !allowed[field] || allowed[field].includes(role);
}

/** Existing SCSS selector blocks with source offsets. At-rules, interpolation
 * and mixins are excluded from executable insertion targets. */
export function scssBlocks(source) {
  const result = [],
    stack = [];
  let start = 0,
    quote = "",
    comment = "",
    parens = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i],
      next = source[i + 1];
    if (comment === "line") {
      if (ch === "\n") {
        comment = "";
        start = i + 1;
      }
      continue;
    }
    if (comment === "block") {
      if (ch === "*" && next === "/") {
        comment = "";
        i++;
        start = i + 1;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "*") {
      comment = "block";
      i++;
      continue;
    }
    if (ch === "/" && next === "/" && parens === 0) {
      comment = "line";
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[") parens++;
    if (ch === ")" || ch === "]") parens--;
    if (parens) continue;
    if (ch === "{") {
      stack.push({ name: source.slice(start, i).trim(), start: i + 1 });
      start = i + 1;
    } else if (ch === "}") {
      const block = stack.pop();
      if (
        block &&
        !stack.some((s) => s.name.startsWith("@") || s.name.includes("#")) &&
        !block.name.startsWith("@") &&
        !block.name.includes("#") &&
        block.name
      ) {
        result.push({
          selector: [...stack.map((s) => s.name), block.name].join(" > "),
          start: block.start,
          end: i,
        });
      }
      start = i + 1;
    } else if (ch === ";") start = i + 1;
  }
  return result.sort((a, b) => a.start - b.start);
}
