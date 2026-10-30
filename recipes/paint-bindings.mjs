/** Exact, source-reviewed color/effect bindings. No nearest-color/value matching. */
import fs from "node:fs";
import path from "node:path";
const SHADOW_SOURCE = "packages/components/src/utilities/shadow.module.scss";
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const rgba = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[\da-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a: 1,
  };
};
const ref = (token) => token.values.Value ?? token.values.Light;
export function augmentPaintBindings(
  bundle,
  { sourceRoot = new URL("../.cache/release/", import.meta.url).pathname } = {},
) {
  const report = {
    release: bundle.release,
    policy:
      "Exact released semantic roles or exact source literals; no nearest-value substitution. Fixture artwork, picker gradients and arbitrary data colors remain explicit content exceptions.",
    counts: {
      literalPaintsBound: 0,
      svgPaintRules: 0,
      shadowLayersStyled: 0,
      effectFieldsBound: 0,
      derivedEffectVariables: 0,
      derivedEffectStyles: 0,
    },
    derived: [],
    exceptions: [],
    svgRules: [],
  };
  const tokens = new Map(bundle.tokens.map((t) => [t.id, t]));
  const primitive = (value) =>
    bundle.tokens
      .filter(
        (t) =>
          t.type === "COLOR" &&
          t.collection === "Primitives" &&
          equal(ref(t), value),
      )
      .sort((a, b) => a.id.localeCompare(b.id))[0];
  const addToken = (id, type, value, source, role) => {
    if (tokens.has(id)) {
      const existing = tokens.get(id);
      if (existing.type !== type || !equal(ref(existing), value))
        throw Error("Conflicting exact source paint constant " + id);
      return id;
    }
    const token = {
      id,
      name: id.replaceAll("-", "/"),
      type,
      collection: "Primitives",
      values: { Value: value },
      css:
        type === "FLOAT"
          ? String(value) + "px"
          : `rgba(${value.r * 255}, ${value.g * 255}, ${value.b * 255}, ${value.a})`,
      scopes: [type === "FLOAT" ? "EFFECT_FLOAT" : "EFFECT_COLOR"],
      provenance: { kind: "released-source-literal", source, role },
    };
    bundle.tokens.push(token);
    tokens.set(id, token);
    report.counts.derivedEffectVariables++;
    report.derived.push({ id, type, value, source, role });
    return id;
  };
  const number = (value, field, source) => {
    const id = `source-shadow-${field}-${String(value).replace("-", "negative-").replace(".", "point-")}`;
    return addToken(id, "FLOAT", value, source, field);
  };
  const effectsBindings = (style, source) => {
    style.effectBindings = style.effects.map((effect, index) => {
      if (!["DROP_SHADOW", "INNER_SHADOW"].includes(effect.type)) {
        report.exceptions.push({
          kind: "unsupported-effect",
          id: style.id,
          index,
          type: effect.type,
        });
        return {};
      }
      const color =
        style.colorTokens?.[index] ??
        style.colorToken ??
        addToken(
          (style.id.startsWith("source-") ? style.id : "source-" + style.id) +
            "-color",
          "COLOR",
          effect.color,
          source,
          "shadow-color",
        );
      const target = tokens.get(color);
      if (!target) throw Error("Missing source shadow color " + color);
      target.scopes = [...new Set([...(target.scopes ?? []), "EFFECT_COLOR"])];
      const bindings = {
        color,
        radius: number(effect.radius, "radius", source),
        spread: number(effect.spread ?? 0, "spread", source),
        offsetX: number(effect.offset.x, "offset-x", source),
        offsetY: number(effect.offset.y, "offset-y", source),
      };
      report.counts.effectFieldsBound += Object.keys(bindings).length;
      return bindings;
    });
  };
  for (const style of bundle.styles)
    if (style.type === "EFFECT")
      effectsBindings(
        style,
        style.source ?? "packages/tokens/dist/css/base.css",
      );
  const sourceText = fs.readFileSync(
    path.join(sourceRoot, SHADOW_SOURCE),
    "utf8",
  );
  const utilityStyles = [];
  for (const level of ["md", "lg"]) {
    const body = sourceText.match(
      new RegExp("@mixin\\s+shadow-" + level + "\\s*\\{([\\s\\S]*?)\\n\\}"),
    )?.[1];
    const match = body?.match(
      /box-shadow:\s*([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)/,
    );
    if (!match)
      throw Error("Cannot extract exact released shadow utility " + level);
    const [x, y, radius, spread, r, g, b, a] = match.slice(1).map(Number);
    const effect = {
      type: "DROP_SHADOW",
      color: { r: r / 255, g: g / 255, b: b / 255, a },
      offset: { x, y },
      radius,
      spread,
      visible: true,
      blendMode: "NORMAL",
    };
    const style = {
      id: "source-shadow-" + level,
      name: "source/shadow/" + level,
      type: "EFFECT",
      source: SHADOW_SOURCE,
      provenance: {
        kind: "released-source-literal",
        source: SHADOW_SOURCE,
        mixin: "shadow-" + level,
      },
      effects: [effect],
    };
    const existing = bundle.styles.find((s) => s.id === style.id);
    if (existing) {
      utilityStyles.push(existing);
      continue;
    }
    effectsBindings(style, SHADOW_SOURCE);
    bundle.styles.push(style);
    utilityStyles.push(style);
    report.counts.derivedEffectStyles++;
  }
  const resolveColor = (id, seen = new Set()) => {
    if (seen.has(id)) throw Error("Cycle in focus color " + id);
    seen.add(id);
    const value = ref(tokens.get(id));
    return value?.alias ? resolveColor(value.alias, seen) : value;
  };
  const focusStyle = {
    id: "source-focus-outline",
    name: "source/focus/outline",
    type: "EFFECT",
    source: "packages/components/src/utilities/focusStyle.module.scss",
    provenance: {
      kind: "released-source-composite",
      source: "packages/components/src/utilities/focusStyle.module.scss",
      mixin: "focus-outline-styles",
    },
    colorTokens: ["color-surface-default", "color-focus-default"],
    effects: [
      ["color-surface-default", 2],
      ["color-focus-default", 6],
    ].map(([id, spread]) => ({
      type: "DROP_SHADOW",
      color: resolveColor(id),
      offset: { x: 0, y: 0 },
      radius: 0,
      spread,
      visible: true,
      blendMode: "NORMAL",
    })),
  };
  if (!bundle.styles.some((style) => style.id === focusStyle.id)) {
    effectsBindings(focusStyle, focusStyle.source);
    bundle.styles.push(focusStyle);
    report.counts.derivedEffectStyles++;
  }
  const cardFocus = {
    id: "source-card-focus-outline",
    name: "source/focus/card-outline",
    type: "EFFECT",
    source: "packages/components/src/components/Card/styles/card.module.scss",
    provenance: {
      kind: "released-source-composite",
      source: "packages/components/src/components/Card/styles/card.module.scss",
      css: "outline: 4px solid var(--color-focus-default)",
    },
    colorTokens: ["color-focus-default"],
    effects: [
      {
        type: "DROP_SHADOW",
        color: resolveColor("color-focus-default"),
        offset: { x: 0, y: 0 },
        radius: 0,
        spread: 4,
        visible: true,
        blendMode: "NORMAL",
      },
    ],
  };
  if (!bundle.styles.some((style) => style.id === cardFocus.id)) {
    effectsBindings(cardFocus, cardFocus.source);
    bundle.styles.push(cardFocus);
    report.counts.derivedEffectStyles++;
  }
  const chartRoles = {
    "#6acb75": "color-charts-primary-default",
    "#d59bff": "color-charts-secondary-default",
    "#e6a23c": "color-charts-tertiary-default",
  };
  const walk = (node, context) => {
    const where = context + "/" + node.id;
    const fixture =
      context.startsWith("patterns/") || context.startsWith("example:");
    for (const [field, binding] of [
      ["fill", "fills"],
      ["stroke", "strokes"],
    ]) {
      if (!node[field] || node.bindings?.[binding]) continue;
      if (fixture) {
        report.exceptions.push({
          kind: "fixture-artwork",
          path: where,
          field,
          value: node[field],
        });
        node.paintRole = "fixture-content";
        continue;
      }
      const value = rgba(node[field]);
      const match = value ? primitive(value) : null;
      if (match) {
        node.bindings = { ...(node.bindings ?? {}), [binding]: match.id };
        delete node[field];
        report.counts.literalPaintsBound++;
      } else
        report.exceptions.push({
          kind: "unmatched-source-literal",
          path: where,
          field,
          value: node[field],
        });
    }
    if (node.focusRing) {
      const ring = node.focusRing;
      if (
        ring.inner === "color-surface-default" &&
        ring.outer === "color-focus-default" &&
        (ring.innerSpread ?? 2) === 2 &&
        (ring.outerSpread ?? 6) === 6
      ) {
        node.effectStyle = "source-focus-outline";
        delete node.focusRing;
        report.counts.shadowLayersStyled++;
      } else if (
        context.startsWith("components/Card") &&
        ring.outer === "color-focus-default" &&
        (ring.innerSpread ?? 2) === 0 &&
        (ring.outerSpread ?? 6) === 4
      ) {
        node.effectStyle = "source-card-focus-outline";
        delete node.focusRing;
        report.counts.shadowLayersStyled++;
      } else
        report.exceptions.push({
          kind: "unmatched-focus-composite",
          path: where,
          focusRing: ring,
        });
    }
    if (node.effects?.length) {
      const match = bundle.styles.find(
        (s) => s.type === "EFFECT" && equal(s.effects, node.effects),
      );
      if (match) {
        node.effectStyle = match.id;
        delete node.effects;
        report.counts.shadowLayersStyled++;
      } else
        report.exceptions.push({
          kind: "unmatched-source-effect",
          path: where,
          effects: node.effects,
        });
    }
    if (node.kind === "svg") {
      node.clearSvgRootFills = true;
      if (node.iconColor) {
        report.svgRules.push({
          path: where,
          role: "uniform-source-color",
          tokenId: node.iconColor,
        });
      } else if (context.startsWith("components/ColorPicker")) {
        node.paintRole = "picker-data-gradient";
        const white = primitive(rgba("#ffffff"));
        if (white && /stroke=["']#fff(?:fff)?["']/i.test(node.svg)) {
          node.svgPaintBindings = [
            { paint: "stroke", color: "#ffffff", tokenId: white.id },
          ];
          report.counts.svgPaintRules++;
          report.svgRules.push({
            path: where,
            role: "fixed-source-selection-outline",
            rules: node.svgPaintBindings,
          });
        }
        report.exceptions.push({
          kind: "picker-data-gradient",
          path: where,
          reason:
            "Source picker gradients and selected color are data values, not design-system surface colors.",
        });
      } else if (
        context.startsWith("components/Textarea") &&
        node.id === "resize-handle"
      ) {
        node.svgFillNone = true;
        node.svgPaintBindings = [
          { paint: "stroke", color: "#808080", tokenId: "color-line-mid" },
        ];
        report.svgRules.push({
          path: where,
          source:
            "packages/components/src/components/Textarea/styles/textarea.module.scss",
          role: "source-resize-mask-color",
          rules: node.svgPaintBindings,
        });
        report.counts.svgPaintRules++;
      } else {
        const matches = [
          ...node.svg.matchAll(
            /\b(fill|stroke)=["'](#[\da-f]{3}(?:[\da-f]{3})?)["']/gi,
          ),
        ];
        const rules = [];
        for (const match of matches) {
          const hex = match[2].toLowerCase();
          const tokenId = context.startsWith("charts/")
            ? chartRoles[hex]
            : primitive(rgba(hex))?.id;
          if (
            tokenId &&
            !rules.some((r) => r.paint === match[1] && r.color === hex)
          )
            rules.push({ paint: match[1], color: hex, tokenId });
          else if (!tokenId)
            report.exceptions.push({
              kind: "unmatched-svg-source-color",
              path: where,
              paint: match[1],
              value: hex,
            });
        }
        if (rules.length) {
          node.svgPaintBindings = rules;
          report.counts.svgPaintRules += rules.length;
          report.svgRules.push({ path: where, rules });
        }
      }
    }
    for (const child of node.children ?? []) walk(child, where);
  };
  for (const recipe of bundle.recipes)
    for (const variant of recipe.variants)
      walk(variant.root, recipe.id + "/" + variant.id);
  for (const example of bundle.examples ?? [])
    walk(example.root, "example:" + example.id);
  // Default icon currentColor is a source semantic role, not fixed black artwork.
  for (const icon of bundle.icons)
    icon.defaultColorToken = "color-primary-default";
  report.iconDefaultRole = {
    tokenId: "color-primary-default",
    source: "packages/icons/src/createFondueIcon.ts",
    meaning:
      "Default currentColor resolves to primary text; consuming instance colors may override this binding.",
  };
  bundle.tokens.sort((a, b) => a.id.localeCompare(b.id, "en"));
  return report;
}
