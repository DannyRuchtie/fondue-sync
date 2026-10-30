/** Authored composition examples. Fondue definitions always come from the pinned released repository. */
import fs from "node:fs";
const demo = JSON.parse(
  fs.readFileSync(new URL("../fixtures/demo.json", import.meta.url), "utf8"),
);
const binding = (domain, field, type = "string", entityId) => ({
  schemaVersion: 1,
  dataset: demo.datasetId,
  domain,
  field,
  type,
  ...(entityId ? { entityId } : {}),
  status: "fixture",
});
const frame = (id, children = [], options = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "VERTICAL",
  gap: 16,
  padding: 0,
  children,
  ...options,
});
const inst = (id, componentName, text, variantProps = {}, options = {}) => ({
  id,
  kind: "componentInstance",
  name: id,
  componentName,
  variantProps,
  ...(text ? { text } : {}),
  ...options,
});
const patternInst = (id, recipeId, variantProps = {}, options = {}) => ({
  id,
  kind: "componentInstance",
  name: id,
  recipeId,
  variantProps,
  ...options,
});
const heading = (id, value, size = "x-large") =>
  inst(id, "Heading", value, { size, weight: "default", color: "default" });
const text = (id, value, color = "default") =>
  inst(id, "Text", value, { size: "medium", weight: "default", color });
const button = (id, value, emphasis = "strong") =>
  inst(id, "Button", value, {
    size: "medium",
    variant: "default",
    emphasis,
    rounding: "medium",
    aspect: "default",
    state: "default",
  });
const row = (id, children, o = {}) =>
  frame(id, children, { layout: "HORIZONTAL", gap: 16, ...o });
const authoredSource = [
  "packages/components/src/components/Button/Button.tsx",
  "packages/components/src/components/Text/Text.tsx",
  "packages/components/src/components/Heading/Heading.tsx",
  "packages/components/src/components/TextInput/TextInput.tsx",
  "packages/components/src/components/Card/Card.ts",
];
const documentation = (purpose, usage) => ({
  purpose,
  usage,
  properties:
    "Nested library component instances expose their actual source properties. Fixture bindings identify synthetic content; they do not run queries.",
  description: purpose,
  origin:
    "Authored Fondue Sync example composition; component definitions from released repository only.",
  metadataSource: "fixtures/demo.json",
  links: [],
});
const make = (name, variants, purpose) => ({
  id: "patterns/" + name,
  name,
  package: "fondue-sync/patterns",
  source: authoredSource,
  status: "partial",
  limitations: [
    "Authored layout example, not a shipped Fondue component or live account replica.",
    "Nested instance state availability follows source component recipe coverage. Browser navigation, queries and actions are inert fixture metadata.",
  ],
  documentation: documentation(
    purpose,
    "Insert the pattern from the published Fondue Sync patterns library; adjust real nested component properties and replace synthetic fixture data.",
  ),
  variants: variants.map(({ props, root }) => ({
    id: Object.entries(props)
      .map(([k, v]) => `${k}=${v}`)
      .join(";"),
    props,
    root,
  })),
});
const navigation = (section) =>
  frame(
    "navigation",
    [
      heading("workspace", "Spruce workspace", "medium"),
      inst(
        "search",
        "TextInput",
        "Find a page",
        {
          status: "neutral",
          mode: "default",
          content: "placeholder",
          slots: "none",
        },
        { dataBinding: binding("ui", "navigation.search", "search") },
      ),
      ...["Overview", "Guidelines", "Libraries", "Projects", "Agentic hub"].map(
        (label) =>
          button(
            "nav-" + label.toLowerCase().replaceAll(" ", "-"),
            label,
            label === section ? "default" : "weak",
          ),
      ),
      text("fixture-label", "Synthetic workspace", "weak"),
    ],
    {
      width: 256,
      height: 840,
      padding: 16,
      bindings: {
        fills: "color-surface-dim",
        strokes: "color-line-subtle",
        itemSpacing: "spacing-medium",
      },
    },
  );
const toolbar = (domain) =>
  row(
    "toolbar",
    [
      inst(
        "search",
        "TextInput",
        domain === "brands"
          ? "Search brands"
          : domain === "guidelines"
            ? "Search guidelines"
            : "Search assets",
        {
          status: "neutral",
          mode: "default",
          content: "placeholder",
          slots: "none",
        },
        { width: 520, dataBinding: binding(domain, "query", "search") },
      ),
      button("filter", "Filters", "weak"),
      button("sort", "Name", "weak"),
    ],
    { padding: 16, bindings: { strokes: "color-line-subtle" } },
  );
const artwork = (id, color) =>
  frame(
    id,
    [
      {
        id: "shape-a",
        kind: "ellipse",
        name: "Synthetic circle",
        width: 64,
        height: 64,
        fill: color,
      },
      {
        id: "shape-b",
        kind: "rectangle",
        name: "Synthetic block",
        width: 100,
        height: 24,
        fill: "#FFFFFF",
        radius: 4,
      },
    ],
    { width: 272, height: 140, padding: 24, gap: 8, fill: color },
  );
const tiles = (domain) => {
  const records = demo[domain];
  return row(
    "tiles",
    records.map((record) =>
      frame(
        record.id,
        [
          artwork("artwork", record.color ?? "#D5E5EF"),
          inst(
            "card",
            "Card",
            record.name,
            { selected: "false", state: "default" },
            {
              width: 272,
              dataBinding: binding(domain, "name", "string", record.id),
            },
          ),
          ...(domain === "assets"
            ? [
                text(
                  "permission",
                  record.permissions.canDownload
                    ? "Download available"
                    : "View only",
                  "weak",
                ),
              ]
            : []),
        ],
        { width: 272, gap: 8 },
      ),
    ),
    { gap: 16 },
  );
};
const empty = () =>
  frame(
    "empty-state",
    [
      {
        id: "guideline-symbol",
        kind: "instance",
        name: "Guideline symbol",
        iconId: "icon:document-list",
        width: 64,
        height: 64,
        iconColor: "color-secondary-default",
      },
      heading("title", "Start your guidelines", "xx-large"),
      text(
        "description",
        "Create a sample guide for your fictional brand.",
        "weak",
      ),
      button("create", "Create guideline"),
      inst("learn", "Link", "Explore the sample setup", { state: "default" }),
    ],
    {
      width: 920,
      height: 500,
      padding: 40,
      gap: 16,
      counterAlign: "CENTER",
      bindings: {
        fills: "color-surface-dim",
        cornerRadius: "border-radius-x-large",
      },
    },
  );
export const patterns = [
  make(
    "NavigationShell",
    ["Overview", "Guidelines", "Agentic hub"].map((section) => ({
      props: { section },
      root: navigation(section),
    })),
    "A reusable workspace sidebar composed of real Fondue navigation controls.",
  ),
  make(
    "SearchToolbar",
    ["brands", "guidelines", "assets"].map((domain) => ({
      props: { domain },
      root: toolbar(domain),
    })),
    "A search/filter/sort toolbar with typed fixture search metadata.",
  ),
  make(
    "AssetBrowser",
    ["brands", "assets"].map((domain) => ({
      props: { domain },
      root: frame("browser", [toolbar(domain), tiles(domain)], {
        width: 920,
        padding: 16,
        dataBinding: binding(domain, "items", "collection"),
      }),
    })),
    "A reusable asset or brand browser; cards remain nested native Fondue instances.",
  ),
  make(
    "GuidelinesEmptyState",
    [{ props: { state: "empty" }, root: empty() }],
    "An empty state inspired by the inspected Guidelines example, with synthetic content.",
  ),
  make(
    "AgenticFeatureGrid",
    [
      {
        props: { state: "ready" },
        root: row(
          "features",
          demo.agenticFeatures.map((feature) =>
            frame(
              feature.id,
              [
                heading("name", feature.name, "medium"),
                text("description", feature.description, "weak"),
                button("open", "Explore", "weak"),
              ],
              {
                width: 272,
                padding: 16,
                bindings: {
                  strokes: "color-line-subtle",
                  cornerRadius: "border-radius-medium",
                },
              },
            ),
          ),
          { gap: 16 },
        ),
      },
    ],
    "A feature grid for an authored Agentic hub example; actions are fixture-only.",
  ),
];
const screen = (id, name, section, content) => ({
  id: "examples/" + id,
  name,
  width: 1280,
  height: 840,
  fixture: demo.datasetId,
  layoutReference: {
    source: "explorer/SOURCE.md",
    files: [
      "explorer/src/ProductViews.tsx",
      "explorer/src/ProductPages.tsx",
      "explorer/src/product-views.css",
    ],
    role: "Composition reference only; never a Fondue definition or data source.",
    observedLayoutDate: "2026-10-28",
  },
  limitations: [
    "Editable frame composition using real generated Fondue and pattern instances. Not an interactive prototype export.",
    "Synthetic fixtures and original native artwork replace all account-specific data and CDN reference imagery.",
  ],
  root: row(
    "screen",
    [
      patternInst("navigation", "patterns/NavigationShell", { section }),
      frame("main", content, {
        width: 1024,
        height: 840,
        padding: 24,
        gap: 24,
        bindings: { fills: "color-surface-default" },
      }),
    ],
    { width: 1280, height: 840, gap: 0 },
  ),
  documentation: documentation(
    name,
    "Duplicate this example frame into a design file and swap enabled library instances. Binding metadata describes fixture values only.",
  ),
});
export const screens = [
  screen("dashboard", "Example / Dashboard", "Overview", [
    row(
      "header",
      [
        heading("title", "Overview", "medium"),
        button("new-brand", "New brand"),
      ],
      { width: 976, primaryAlign: "SPACE_BETWEEN" },
    ),
    patternInst(
      "brands",
      "patterns/AssetBrowser",
      { domain: "brands" },
      { dataBinding: binding("brands", "items", "collection") },
    ),
  ]),
  screen("guidelines", "Example / Guidelines", "Guidelines", [
    row(
      "header",
      [
        heading("title", "Guidelines", "medium"),
        button("new-guideline", "New guideline"),
      ],
      { width: 976, primaryAlign: "SPACE_BETWEEN" },
    ),
    patternInst("search", "patterns/SearchToolbar", { domain: "guidelines" }),
    patternInst(
      "empty",
      "patterns/GuidelinesEmptyState",
      { state: "empty" },
      { dataBinding: binding("guidelines", "items", "collection") },
    ),
  ]),
  screen("agentic", "Example / Agentic hub", "Agentic hub", [
    heading("title", "Agentic hub", "xx-large"),
    text(
      "intro",
      "Explore tools and workflows in a fictional workspace.",
      "weak",
    ),
    row("automation-hero", [
      artwork("workflow-art", "#DDD5F0"),
      frame(
        "automation-copy",
        [
          heading("heading", "Workflow automations"),
          text(
            "description",
            "Arrange a sample workflow with synthetic assets.",
            "weak",
          ),
          button("explore", "Explore workflow", "weak"),
        ],
        { width: 560 },
      ),
    ]),
    heading("features-title", "Features"),
    patternInst("features", "patterns/AgenticFeatureGrid", { state: "ready" }),
    heading("learn-title", "Learn"),
    row(
      "learn",
      demo.learning.map((item) =>
        inst(
          item.id,
          "Card",
          item.title,
          { selected: "false", state: "default" },
          {
            width: 272,
            dataBinding: binding("learning", "title", "string", item.id),
          },
        ),
      ),
    ),
  ]),
];
export default patterns;
