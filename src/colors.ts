import type { Bundle, Token } from "./schema";
import { Presentation, type PresentationIndex } from "./presentation";
export type ColorGroup = {
  id: string;
  name: string;
  usage: string;
  tokens: Token[];
  preview:
    | "text"
    | "surface"
    | "border"
    | "feedback"
    | "container"
    | "focus"
    | "chart"
    | "effect";
};
export type ColorReference = {
  semantic: ColorGroup[];
  palettes: { id: string; name: string; usage: string; tokens: Token[] }[];
  implementation: Token[];
};
const DEFINITIONS: Array<
  Omit<ColorGroup, "tokens"> & { matches: (id: string) => boolean }
> = [
  {
    id: "text-icons",
    name: "Text and icons",
    usage:
      "Choose primary for important content and secondary for supporting content. Disabled roles communicate unavailable controls; on-color roles belong on their matching background.",
    preview: "text",
    matches: (id) =>
      /^color-(primary|secondary|disabled|low-contrast)-/.test(id),
  },
  {
    id: "surfaces",
    name: "Surfaces",
    usage:
      "Use these backgrounds for pages, elevated content and interactive surfaces. Overlay is the source scrim role, not an invented opacity.",
    preview: "surface",
    matches: (id) => /^color-(surface|overlay)-/.test(id),
  },
  {
    id: "borders",
    name: "Borders and dividers",
    usage:
      "Use subtle for quiet separation, mid for control boundaries and strong where emphasis is required.",
    preview: "border",
    matches: (id) => id.startsWith("color-line-"),
  },
  {
    id: "feedback-error",
    name: "Error",
    usage:
      "Use error for destructive or invalid states. Pair on-error foreground with its error background.",
    preview: "feedback",
    matches: (id) => id.startsWith("color-error-"),
  },
  {
    id: "feedback-warning",
    name: "Warning",
    usage:
      "Use warning to draw attention before a problem occurs. Pair on-warning foreground with its warning background.",
    preview: "feedback",
    matches: (id) => id.startsWith("color-warning-"),
  },
  {
    id: "feedback-success",
    name: "Success",
    usage:
      "Use success for positive confirmation. Pair on-success foreground with its success background.",
    preview: "feedback",
    matches: (id) => id.startsWith("color-success-"),
  },
  {
    id: "containers",
    name: "Containers",
    usage:
      "Use a container background with its matching on-container foreground. These are semantic roles, not raw palette shades.",
    preview: "container",
    matches: (id) => id.startsWith("color-container-"),
  },
  {
    id: "highlight-focus",
    name: "Highlight and focus",
    usage:
      "Highlight distinguishes selected or emphasized content. Focus roles identify keyboard focus; keep source focus treatments rather than substituting an arbitrary border.",
    preview: "focus",
    matches: (id) => /^color-(highlight|focus)-/.test(id),
  },
  {
    id: "charts",
    name: "Charts",
    usage:
      "Use the released series colors and their hover/subtle counterparts for data. Missing, dim and negative are explicit data roles.",
    preview: "chart",
    matches: (id) => id.startsWith("color-charts-"),
  },
  {
    id: "effects",
    name: "Effect colors",
    usage:
      "This role supports composite shadow styles. For ordinary elevation, use the shared effect style rather than painting a flat shadow color.",
    preview: "effect",
    matches: (id) => id === "color-shadow-default",
  },
];
const HUES = ["neutral", "error", "warning", "success", "marker"];
export function naturalShadeCompare(a: string, b: string) {
  const av = a.match(/-(\d+)$/),
    bv = b.match(/-(\d+)$/);
  return av && bv
    ? Number(av[1]) - Number(bv[1]) || a.localeCompare(b)
    : a.localeCompare(b, "en", { numeric: true });
}
function semanticOrder(a: Token, b: Token) {
  const state = (id: string) =>
    id.includes("-on-")
      ? 4
      : id.endsWith("-default")
        ? 0
        : id.endsWith("-hover")
          ? 1
          : id.endsWith("-active")
            ? 2
            : 3;
  const base = (id: string) =>
    id.replace(/-(default|hover|active)$/, "").split("-on-")[0];
  return (
    base(a.id).localeCompare(base(b.id), "en") ||
    state(a.id) - state(b.id) ||
    a.id.localeCompare(b.id, "en")
  );
}
export function colorReference(bundle: Pick<Bundle, "tokens">): ColorReference {
  const colors = bundle.tokens.filter((token) => token.type === "COLOR");
  const semantic: ColorGroup[] = DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    usage: def.usage,
    preview: def.preview,
    tokens: colors
      .filter((t) => t.collection === "Semantic" && def.matches(t.id))
      .sort(semanticOrder),
  })).filter((g) => g.tokens.length);
  const covered = new Set(semantic.flatMap((g) => g.tokens.map((t) => t.id)));
  const unmatched = colors.filter(
    (t) => t.collection === "Semantic" && !covered.has(t.id),
  );
  if (unmatched.length)
    throw Error(
      "Semantic color needs reviewed usage grouping: " +
        unmatched.map((t) => t.id).join(", "),
    );
  const palettes = HUES.map((hue) => ({
    id: hue,
    name: hue[0].toUpperCase() + hue.slice(1),
    usage:
      hue === "neutral"
        ? "Neutral foundations for token authors. Component consumers should choose semantic text, surface or border roles."
        : "Raw " +
          hue +
          " ramp for token authors. Prefer the matching semantic role when designing a component.",
    tokens: colors
      .filter(
        (t) =>
          t.collection === "Primitives" &&
          new RegExp("^color-" + hue + "-\\d+$").test(t.id),
      )
      .sort((a, b) => naturalShadeCompare(a.id, b.id)),
  })).filter((g) => g.tokens.length);
  const ramps = new Set(palettes.flatMap((p) => p.tokens.map((t) => t.id)));
  return {
    semantic,
    palettes,
    implementation: colors
      .filter((t) => t.collection === "Primitives" && !ramps.has(t.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
export function friendlyColorLabel(id: string) {
  let value = id.replace(/^color-/, "");
  value = value.replace(/^container-/, "").replace(/^charts-/, "");
  value = value
    .replace(/-on-(.+?)(?:-variant)?$/, " / Foreground")
    .replace(/-default$/, "")
    .replace(/-hover$/, " / Hover")
    .replace(/-active$/, " / Pressed")
    .replace(/-subtle$/, " / Subtle")
    .replace(/-/g, " ");
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}
export type ColorPageReport = {
  pageId: string;
  groupIds: string[];
  createdNodeIds: string[];
  mutatedNodeIds: string[];
  warnings: string[];
  counts: { semantic: number; primitive: number; implementation: number };
  modePairs: {
    tokenId: string;
    collectionId: string;
    light: string;
    dark: string;
  }[];
};
export async function syncColorsPage(
  api: PluginAPI,
  bundle: Bundle,
  index: PresentationIndex,
  save: () => void,
): Promise<ColorPageReport> {
  const model = colorReference(bundle),
    ctx = new Presentation(api, index, save);
  await ctx.preflight();
  const sourceColors = [
    ...model.semantic.flatMap((g) => g.tokens),
    ...model.palettes.flatMap((p) => p.tokens),
    ...model.implementation,
  ];
  const modePairs: ColorPageReport["modePairs"] = [],
    collections = new Map<string, VariableCollection>();
  for (const token of sourceColors) {
    const v = await ctx.variable(token.id, "COLOR");
    if (!collections.has(v.variableCollectionId)) {
      const c = await api.variables.getVariableCollectionByIdAsync(
        v.variableCollectionId,
      );
      if (!c) throw Error("Missing source collection for " + token.id);
      collections.set(c.id, c);
    }
    if (token.collection === "Semantic") {
      const c = collections.get(v.variableCollectionId)!;
      const light = c.modes.find((m) => m.name === "Light"),
        dark = c.modes.find((m) => m.name === "Dark");
      if (!light || !dark)
        throw Error("Missing native Light/Dark modes for " + token.id);
      modePairs.push({
        tokenId: token.id,
        collectionId: c.id,
        light: light.modeId,
        dark: dark.modeId,
      });
    }
  }
  const page = await ctx.page("Colors");
  await api.setCurrentPageAsync(page);
  const existing = new Set([
    ...Object.values(index.presentationNodes ?? {}),
    ...Object.values(index.presentationInstances ?? {}),
  ]);
  const notes = page.children.filter((n) => !existing.has(n.id));
  const y = notes.length
    ? Math.max(...notes.map((n) => n.y + n.height)) +
      ctx.number("spacing-xx-large")
    : 0;
  const width = 1120,
    pad = ctx.number("spacing-x-large"),
    contentWidth = width - 2 * pad;
  const document = await ctx.frame("colors/document", page);
  ctx.auto(
    document,
    "VERTICAL",
    "component-constant-spacing-0",
    "spacing-xx-large",
  );
  const header = await ctx.frame("colors/header", document, "", "surface");
  ctx.auto(header, "VERTICAL", "spacing-x-large", "spacing-small");
  await ctx.text(
    "colors/header/title",
    header,
    "Colors",
    "text-heading-xx-large-default",
    "color-primary-default",
    contentWidth,
  );
  await ctx.text(
    "colors/header/guide",
    header,
    "Choose a semantic role for components. Use raw hue ramps when authoring or extending tokens.",
    "text-body-medium-default",
    "color-primary-default",
    contentWidth,
  );
  await ctx.text(
    "colors/header/modes",
    header,
    "Light and Dark previews use the exact shared variables and source modes.",
    "text-body-small-default",
    "color-secondary-default",
    contentWidth,
  );
  const groupIds: string[] = [];
  async function groupHeader(key: string, name: string, usage: string) {
    const root = await ctx.frame(key, document, "", "surface");
    ctx.auto(root, "VERTICAL", "spacing-x-large", "spacing-large");
    await ctx.text(
      key + "/title",
      root,
      name,
      "text-heading-x-large-default",
      "color-primary-default",
      contentWidth,
    );
    await ctx.text(
      key + "/usage",
      root,
      usage,
      "text-body-medium-default",
      "color-secondary-default",
      contentWidth,
    );
    return root;
  }
  async function semanticCard(
    token: Token,
    group: ColorGroup,
    parent: FrameNode,
  ) {
    const key = "colors/role/" + token.id;
    const card = await ctx.frame(key, parent, "", "card");
    ctx.auto(card, "VERTICAL", "spacing-medium", "spacing-x-small");
    await ctx.text(
      key + "/label",
      card,
      friendlyColorLabel(token.id),
      "text-body-medium-strong",
      "color-primary-default",
      304,
    );
    await ctx.text(
      key + "/css",
      card,
      "--" + token.id,
      "text-body-x-small-default",
      "color-secondary-default",
      304,
    );
    const pair = await ctx.frame(key + "/modes", card);
    ctx.auto(
      pair,
      "HORIZONTAL",
      "component-constant-spacing-0",
      "spacing-x-small",
    );
    const mode = modePairs.find((p) => p.tokenId === token.id)!;
    const collection = collections.get(mode.collectionId)!;
    for (const label of ["Light", "Dark"] as const) {
      const panel = await ctx.frame(key + "/" + label, pair, "", "surface");
      ctx.auto(panel, "VERTICAL", "spacing-small", "spacing-x-small");
      panel.setExplicitVariableModeForCollection(
        collection,
        label === "Light" ? mode.light : mode.dark,
      );
      await ctx.text(
        key + "/" + label + "/name",
        panel,
        label,
        "text-body-x-small-strong",
        "color-secondary-default",
        124,
      );
      const foreground = token.id.includes("-on-");
      const backgroundId = foreground
        ? token.id.split("-on-")[0] + "-default"
        : "color-surface-default";
      if (group.preview === "text" || foreground) {
        if (foreground && ctx.variables.has(backgroundId))
          ctx.paint(panel, "fills", backgroundId);
        await ctx.text(
          key + "/" + label + "/sample",
          panel,
          "Sample text",
          "text-body-medium-strong",
          token.id,
          124,
        );
      } else {
        const sample = await ctx.node(
          key + "/" + label + "/sample",
          "RECTANGLE",
          panel,
        );
        sample.name = "";
        sample.resize(124, 48);
        ctx.bind(sample, "cornerRadius", "border-radius-medium");
        if (group.preview === "border") {
          ctx.paint(sample, "fills", "color-surface-default");
          ctx.paint(sample, "strokes", token.id);
          ctx.bind(sample, "strokeWeight", "border-width-large");
        } else ctx.paint(sample, "fills", token.id);
      }
    }
    return card;
  }
  for (const group of model.semantic) {
    const key = "colors/semantic/" + group.id;
    const root = await groupHeader(key, group.name, group.usage);
    const grid = await ctx.frame(key + "/grid", root);
    ctx.wrap(grid, contentWidth);
    for (const token of group.tokens) await semanticCard(token, group, grid);
    groupIds.push(root.id);
  }
  await groupHeader(
    "colors/authors",
    "Primitive palettes - for token authors",
    "Raw ramps are grouped by hue and ordered by numeric shade. They support semantic aliases; they are not the default choice for component colors.",
  );
  for (const palette of model.palettes) {
    const key = "colors/palette/" + palette.id;
    const root = await groupHeader(key, palette.name, palette.usage);
    const grid = await ctx.frame(key + "/grid", root);
    ctx.wrap(grid, contentWidth, "spacing-x-small");
    for (const token of palette.tokens) {
      const tk = key + "/" + token.id;
      const tile = await ctx.frame(tk, grid, "", "card");
      ctx.auto(tile, "VERTICAL", "spacing-x-small", "spacing-x-small");
      await ctx.text(
        tk + "/shade",
        tile,
        token.id.match(/-(\d+)$/)![1],
        "text-body-medium-strong",
        "color-primary-default",
        88,
      );
      const sample = await ctx.node(tk + "/sample", "RECTANGLE", tile);
      sample.name = "";
      sample.resize(88, 48);
      ctx.paint(sample, "fills", token.id);
      ctx.bind(sample, "cornerRadius", "border-radius-medium");
      await ctx.text(
        tk + "/css",
        tile,
        "--" + token.id,
        "text-body-x-small-default",
        "color-secondary-default",
        88,
      );
    }
    groupIds.push(root.id);
  }
  if (model.implementation.length) {
    const root = await groupHeader(
      "colors/implementation",
      "Effect implementation colors",
      "These exact source colors support composite effects. Choose a shared effect style for shadows; these colors are not component palette recommendations.",
    );
    for (const token of model.implementation) {
      const row = await ctx.frame(
        "colors/implementation/" + token.id + "/row",
        root,
      );
      ctx.auto(
        row,
        "HORIZONTAL",
        "component-constant-spacing-0",
        "spacing-large",
      );
      await ctx.text(
        "colors/implementation/" + token.id + "/label",
        row,
        token.id,
        "text-body-x-small-default",
        "color-secondary-default",
        600,
      );
      const sample = await ctx.node(
        "colors/implementation/" + token.id + "/sample",
        "RECTANGLE",
        row,
      );
      sample.name = "";
      sample.resize(120, 40);
      ctx.paint(sample, "fills", token.id);
    }
    groupIds.push(root.id);
  }
  ctx.position(document, 0, y);
  save();
  return {
    pageId: page.id,
    groupIds,
    createdNodeIds: [...ctx.created],
    mutatedNodeIds: [...ctx.mutated],
    warnings: ctx.warnings,
    counts: {
      semantic: modePairs.length,
      primitive: model.palettes.reduce((n, p) => n + p.tokens.length, 0),
      implementation: model.implementation.length,
    },
    modePairs,
  };
}
