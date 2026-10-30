/** Shared source typography with exact effective metrics, never nearest-style matching. */
const weightNames = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
};
const weights = {
  Light: 300,
  Regular: 400,
  Medium: 500,
  "Semi Bold": 600,
  SemiBold: 600,
  Bold: 700,
};
const key = (value) =>
  String(value)
    .replaceAll("-", "minus-")
    .replaceAll(".", "point-")
    .replaceAll(" ", "-")
    .toLowerCase();
const canonical = (value) => JSON.stringify(value);
export function augmentTypographyBindings(bundle) {
  const report = {
    release: bundle.release,
    policy:
      "Exact effective font family, size, weight, line height, letter spacing and case. CSS font stacks remain unchanged; native family aliases resolve only through confirmed font availability.",
    counts: {
      textLayers: 0,
      releasedStyleMatches: 0,
      existingExactStyles: 0,
      derivedStyles: 0,
      derivedVariables: 0,
      layerBindings: 0,
    },
    derivedStyles: [],
    derivedVariables: [],
    exceptions: [],
  };
  const tokens = new Map(bundle.tokens.map((token) => [token.id, token]));
  const resolve = (id, seen = new Set()) => {
    if (seen.has(id)) throw Error("Typography token alias cycle " + id);
    seen.add(id);
    const t = tokens.get(id);
    if (!t) throw Error("Missing typography token " + id);
    const value = t.values.Value ?? t.values.Light;
    return value?.alias ? resolve(value.alias, seen) : value;
  };
  const roles = {
    fontSize: { prefix: "typography-font-size-", scope: "FONT_SIZE" },
    fontWeight: { prefix: "typography-font-weight-", scope: "FONT_WEIGHT" },
    lineHeight: { prefix: "typography-line-height-", scope: "LINE_HEIGHT" },
    letterSpacing: {
      prefix: "typography-letter-spacing-",
      scope: "LETTER_SPACING",
    },
  };
  const constant = (field, value, source) => {
    const id = "source-typography-" + key(field) + "-" + key(value);
    let token = tokens.get(id);
    if (!token) {
      token = {
        id,
        name: "source/typography/" + field + "/" + value,
        type: "FLOAT",
        collection: "Primitives",
        values: { Value: value },
        css: String(value) + (field === "fontWeight" ? "" : "px"),
        scopes: [roles[field].scope],
        provenance: {
          kind: "reviewed-source-typography-constant",
          source,
          role: field,
          value,
          definitionInputs: "provenance.definitionInputs.recipes",
        },
      };
      tokens.set(id, token);
      bundle.tokens.push(token);
      report.counts.derivedVariables++;
      report.derivedVariables.push(token);
    }
    return id;
  };
  const numeric = (field, value, source, preferred) => {
    if (
      preferred &&
      tokens.get(preferred)?.type === "FLOAT" &&
      resolve(preferred) === value &&
      (preferred.startsWith("text-") ||
        preferred.startsWith(roles[field].prefix))
    )
      return preferred;
    const matches = bundle.tokens
      .filter(
        (t) =>
          t.type === "FLOAT" &&
          t.id.startsWith(roles[field].prefix) &&
          resolve(t.id) === value,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    return matches[0]?.id ?? constant(field, value, source);
  };
  const familyToken = (family, source) => {
    const id = "native-font-family-" + key(family);
    if (!tokens.has(id)) {
      const token = {
        id,
        name: "native/font-family/" + family,
        type: "STRING",
        collection: "Primitives",
        values: { Value: family },
        css: family,
        scopes: ["FONT_FAMILY"],
        nativeFontFamily: { sourceFamily: family, style: "Regular" },
        provenance: {
          kind: "native-font-family-alias",
          source,
          role: "fontFamily",
          sourceFamily: family,
          definitionNote:
            "CSS family/stack is retained. Native value is resolved by confirmed exact family or reviewed installed-font alias at import.",
        },
      };
      tokens.set(id, token);
      bundle.tokens.push(token);
      report.counts.derivedVariables++;
      report.derivedVariables.push(token);
    }
    return id;
  };
  const metric = (style) => ({
    fontFamily: style.fontFamily ?? "Diatype",
    fontSize: style.fontSize,
    fontWeight:
      style.fontWeight ?? weights[style.fontStyle ?? "Regular"] ?? 400,
    lineHeight:
      typeof style.lineHeight === "number"
        ? style.lineHeight
        : style.lineHeight?.unit === "PIXELS"
          ? style.lineHeight.value
          : "AUTO",
    letterSpacing:
      typeof style.letterSpacing === "number"
        ? style.letterSpacing
        : (style.letterSpacing?.value ?? 0),
    textCase: style.textCase ?? "ORIGINAL",
    textDecoration: style.textDecoration ?? "NONE",
  });
  const texts = bundle.styles.filter((style) => style.type === "TEXT");
  // Every canonical or derived shared style carries the same native binding contract.
  const bindStyle = (style, source) => {
    const m = metric(style);
    style.bindings = {
      ...(style.bindings ?? {}),
      fontFamily: familyToken(m.fontFamily, source),
      fontSize: numeric(
        "fontSize",
        m.fontSize,
        source,
        style.bindings?.fontSize,
      ),
      fontWeight: numeric(
        "fontWeight",
        m.fontWeight,
        source,
        style.bindings?.fontWeight,
      ),
      letterSpacing: numeric(
        "letterSpacing",
        m.letterSpacing,
        source,
        style.bindings?.letterSpacing,
      ),
      ...(m.lineHeight === "AUTO"
        ? {}
        : {
            lineHeight: numeric(
              "lineHeight",
              m.lineHeight,
              source,
              style.bindings?.lineHeight,
            ),
          }),
    };
    return m;
  };
  for (const style of texts)
    bindStyle(style, style.source ?? "packages/tokens/dist/css/base.css");
  const walk = (node, context, source) => {
    if (node.kind === "text") {
      report.counts.textLayers++;
      const prior = texts.find((style) => style.id === node.textStyle);
      const priorMetric = prior ? metric(prior) : {};
      const value = (field, fallback) =>
        node[field] !== undefined
          ? node[field]
          : node.bindings?.[field]
            ? resolve(node.bindings[field])
            : (priorMetric[field] ?? fallback);
      const m = {
        fontFamily: node.fontFamily ?? priorMetric.fontFamily ?? "Diatype",
        fontSize: value("fontSize", 14),
        fontWeight: value("fontWeight", 400),
        lineHeight: value("lineHeight", "AUTO"),
        letterSpacing: value("letterSpacing", 0),
        textCase: node.textCase ?? priorMetric.textCase ?? "ORIGINAL",
        textDecoration:
          node.textDecoration ?? priorMetric.textDecoration ?? "NONE",
      };
      let style =
        prior && canonical(metric(prior)) === canonical(m)
          ? prior
          : texts.find(
              (candidate) => canonical(metric(candidate)) === canonical(m),
            );
      if (style) {
        if (prior?.id === style.id) report.counts.existingExactStyles++;
        if (!style.provenance) report.counts.releasedStyleMatches++;
      } else {
        const id =
          "source-text-" +
          [
            key(m.fontFamily),
            m.fontSize,
            m.fontWeight,
            key(m.lineHeight),
            key(m.letterSpacing),
            key(m.textCase),
            key(m.textDecoration),
          ].join("-");
        style = texts.find((s) => s.id === id);
        if (!style) {
          style = {
            id,
            name:
              "source/" +
              m.fontFamily +
              "/" +
              m.fontSize +
              "/" +
              m.fontWeight +
              "/" +
              m.lineHeight +
              "/" +
              m.letterSpacing +
              "/" +
              m.textCase +
              "/" +
              m.textDecoration,
            type: "TEXT",
            fontFamily: m.fontFamily,
            fontStyle: weightNames[m.fontWeight] ?? "Regular",
            fontWeight: m.fontWeight,
            fontSize: m.fontSize,
            lineHeight:
              m.lineHeight === "AUTO" ? { unit: "AUTO" } : m.lineHeight,
            letterSpacing: m.letterSpacing,
            textCase: m.textCase,
            textDecoration: m.textDecoration,
            source,
            provenance: {
              kind: "reviewed-source-typography",
              source,
              firstLayer: context,
              definitionInputs: "provenance.definitionInputs.recipes",
              metrics: m,
            },
          };
          bindStyle(style, source);
          bundle.styles.push(style);
          texts.push(style);
          report.counts.derivedStyles++;
          report.derivedStyles.push({ id, metrics: m, source });
        }
      }
      node.textStyle = style.id;
      node.fontFamily = m.fontFamily;
      node.fontSize = m.fontSize;
      node.fontWeight = m.fontWeight;
      node.letterSpacing = m.letterSpacing;
      node.textCase = m.textCase;
      if (m.lineHeight !== "AUTO") node.lineHeight = m.lineHeight;
      node.bindings = {
        ...(node.bindings ?? {}),
        fontFamily: style.bindings.fontFamily,
        fontSize: style.bindings.fontSize,
        fontWeight: style.bindings.fontWeight,
        letterSpacing: style.bindings.letterSpacing,
        ...(style.bindings.lineHeight
          ? { lineHeight: style.bindings.lineHeight }
          : {}),
      };
      report.counts.layerBindings += Object.keys(style.bindings).length;
      if (m.lineHeight === "AUTO")
        report.exceptions.push({
          kind: "nonnumeric-auto-line-height",
          path: context,
          styleId: style.id,
          reason:
            "AUTO is not a numeric source value; native shared style retains AUTO rather than inventing a pixel value.",
        });
    }
    for (const child of node.children ?? [])
      walk(child, context + "/" + child.id, source);
  };
  for (const recipe of bundle.recipes)
    for (const variant of recipe.variants)
      walk(
        variant.root,
        recipe.id + "/" + variant.id + "/" + variant.root.id,
        recipe.source,
      );
  for (const example of bundle.examples ?? [])
    walk(
      example.root,
      example.id + "/" + example.root.id,
      example.layoutReference ?? "authored example composition",
    );
  bundle.tokens.sort((a, b) => a.id.localeCompare(b.id, "en"));
  bundle.typographyBindingCoverage = report;
  return report;
}
export default augmentTypographyBindings;
