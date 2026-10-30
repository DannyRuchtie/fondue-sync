/** Production-grounded compositions: measured read-only Frontify UI, synthetic content.
 * These are authored layouts composed from released native Fondue instances, not new
 * upstream Fondue component definitions. Private screenshots remain outside this repository.
 */
import fs from "node:fs";
import {
  createAdditionalExamples,
  approvedImageProps,
} from "./additional-examples.mjs";
const demo = JSON.parse(
  fs.readFileSync(new URL("../fixtures/demo.json", import.meta.url), "utf8"),
);
const profiles = {
  wide: { width: 1920, height: 960, main: 1663, card: 310.2, mobile: false },
  desktop: {
    width: 1440,
    height: 960,
    main: 1183,
    card: 271.75,
    mobile: false,
  },
  tablet: { width: 768, height: 960, main: 511, card: 463, mobile: false },
  mobile: { width: 390, height: 844, main: 390, card: 342, mobile: true },
};
const S = {
  surface: "color-surface-default",
  dim: "color-surface-dim",
  text: "color-primary-default",
  muted: "color-secondary-default",
  line: "color-line-subtle",
};
const binding = (domain, field, type = "string", entityId) => ({
  schemaVersion: 1,
  dataset: demo.datasetId,
  domain,
  field,
  type,
  ...(entityId ? { entityId } : {}),
  status: "fixture",
});
const frame = (id, children = [], o = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "VERTICAL",
  padding: 0,
  gap: 0,
  counterAlign: "MIN",
  primaryAlign: "MIN",
  children,
  ...o,
});
const row = (id, children = [], o = {}) =>
  frame(id, children, { layout: "HORIZONTAL", counterAlign: "CENTER", ...o });
const inst = (id, componentName, text, variantProps = {}, o = {}) => ({
  id,
  kind: "componentInstance",
  name: id,
  componentName,
  variantProps,
  ...(text !== undefined ? { text } : {}),
  ...o,
});
const part = (id, recipeId, variantProps = {}, o = {}) => ({
  id,
  kind: "componentInstance",
  name: id,
  recipeId,
  variantProps,
  ...o,
});
const body = (
  id,
  value,
  size = "medium",
  color = "default",
  weight = "default",
  o = {},
) => inst(id, "Text", value, { size, color, weight }, o);
const title = (id, value, size = "medium", o = {}) =>
  inst(id, "Heading", value, { size, weight: "default", color: "default" }, o);
const button = (id, value, emphasis = "strong", o = {}) =>
  inst(
    id,
    "Button",
    value,
    {
      variant: "default",
      emphasis,
      size: "medium",
      rounding: "medium",
      aspect: "default",
      state: "default",
    },
    o,
  );
const icon = (id, name, size = 16, color = S.text, o = {}) => ({
  id,
  kind: "instance",
  name: id,
  iconId: "icon:" + name,
  width: size,
  height: size,
  iconColor: color,
  ...o,
});
const rect = (id, w, h, color, radius = 0) => ({
  id,
  kind: "rectangle",
  name: id,
  width: w,
  height: h,
  radius,
  bindings: { fills: color },
});
const sources = [
  "packages/components/src/components/Text/Text.tsx",
  "packages/components/src/components/Heading/Heading.tsx",
  "packages/components/src/components/Button/Button.tsx",
  "packages/components/src/components/Link/Link.tsx",
  "packages/components/src/components/Card/CardRoot.tsx",
  "packages/components/src/components/Card/CardBanner.tsx",
  "packages/components/src/components/Card/CardContent.tsx",
];
const observation = {
  method:
    "Read-only signed-in UI inspection and browser layout measurements; no private entity names, images, account IDs, credentials or CDN resources copied.",
  observedDate: "2026-10-30",
  viewports: [1920, 1440, 768, 390],
  routePatterns: [
    "workspace brands overview",
    "/brands/{brandId}/guidelines",
    "/brands/{brandId}/libraries",
  ],
  content: "fixtures/demo.json; synthetic entities only",
  reference: "docs/production-layout-reference.md",
};
const docs = (purpose) => ({
  purpose,
  usage:
    "Compose with the real nested Fondue instances; edit text, icon and exposed instance properties. Content is synthetic and actions do not execute.",
  properties:
    "Finite measured viewport profiles, not an invented universal responsive rule. Source-family typography and shared token bindings remain editable.",
  description: purpose,
  origin:
    "Authored production-grounded composition, measured UI structure; released Fondue definitions only.",
  metadataSource: "fixtures/demo.json",
  links: [],
});
const patterns = [];
function make(name, variants, purpose, limitations = []) {
  const recipe = {
    id: "patterns/Production" + name,
    name: "Production" + name,
    package: "fondue-sync/patterns",
    source: sources,
    status: "partial",
    limitations: [
      "Production-grounded authored layout; not a newly exported Fondue component or interactive application.",
      "Fictional labels and approved real image assets replace private account records; observed illustration geometry remains native and editable.",
      ...limitations,
    ],
    documentation: docs(purpose),
    productionReference: observation,
    variants: variants.map(({ props, root }) => ({
      id: Object.entries(props)
        .map(([k, v]) => k + "=" + v)
        .join(";"),
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, String(v)]),
      ),
      root,
    })),
  };
  patterns.push(recipe);
  return recipe;
}
const avatar = (id, size = 40, brand = demo.brands[0]) =>
  frame(id, [], {
    width: size,
    height: size,
    radius: 4,
    clipContent: true,
    ...approvedImageProps(brand.thumbnailImageAssetId),
    dataBinding: binding("brands", "thumbnailImageAssetId", "string", brand.id),
  });
const utilityLabels = [
  "Agentic hub",
  "Usage",
  "Marketplace",
  "Access management",
  "Analytics",
  "Help",
];
const utilityIcons = [
  "sparks",
  "clock-list",
  "market",
  "people",
  "chart-line",
  "question-mark-circle",
];
const userAvatar = (id, size = 36) =>
  frame(
    id,
    [icon("person", "person-anonymous", size - 4, "color-surface-default")],
    {
      width: size,
      height: size,
      radius: 4,
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      bindings: { fills: "color-container-secondary-default" },
    },
  );
const rail = (page, height = 960) => {
  const context = page === "brands" ? "brands" : "brand",
    brand = page === "empty-libraries" ? demo.brands[1] : demo.brands[0],
    active =
      page === "empty-libraries"
        ? "Libraries"
        : page === "libraries"
          ? "Libraries"
          : page === "guidelines"
            ? "Guidelines"
            : "";
  return frame(
    "rail",
    [
      row(
        "brand-switcher",
        [
          context === "brand"
            ? avatar("brand-thumb", 36, brand)
            : icon("menu", "lines", 20),
          frame(
            "workspace-copy",
            [
              title("workspace", context === "brand" ? brand.name : "Brands"),
              ...(context === "brands"
                ? [body("caption", "Demo workspace", "x-small", "weak")]
                : []),
            ],
            { width: context === "brand" ? 158 : 140 },
          ),
          ...(context === "brand"
            ? [
                icon("brand-dropdown", "caret-down", 16, S.text, {
                  x: 178,
                  y: 22,
                  layoutPositioning: "ABSOLUTE",
                }),
              ]
            : []),
          icon("collapse", "sidebar-left-hide", 20, S.text, {
            opacity: context === "brands" ? 0 : 1,
          }),
        ],
        {
          height: 60,
          width: 256,
          paddingLeft: context === "brands" ? 20 : 12,
          paddingRight: 12,
          gap: context === "brands" ? 16 : 8,
        },
      ),
      ...(context === "brand"
        ? [
            row(
              "navigation-search",
              [
                icon("search-icon", "magnifier", 20, S.muted),
                body("search-label", "Search", "medium", "weak", "default", {
                  width: 158,
                }),
                body("shortcut", "⌘K", "small", "weak"),
              ],
              {
                width: 240,
                height: 32,
                paddingLeft: 12,
                paddingRight: 12,
                gap: 8,
                x: 8,
                y: 68,
                layoutPositioning: "ABSOLUTE",
                radius: 4,
                bindings: { fills: S.surface, strokes: "color-line-mid" },
              },
            ),
            frame(
              "brand-navigation",
              [
                "Essentials",
                "Guidelines",
                "Libraries",
                "Projects",
                "Newsletters",
              ].map((label) =>
                row(
                  "nav-" + label.toLowerCase(),
                  [
                    icon(
                      "nav-icon",
                      label === "Libraries"
                        ? "image-stack"
                        : label === "Guidelines"
                          ? "document-list"
                          : label === "Essentials"
                            ? "color-fan"
                            : label === "Projects"
                              ? "folder"
                              : "paperplane",
                      20,
                    ),
                    body("nav-label", label),
                  ],
                  {
                    width: 240,
                    height: 32,
                    paddingLeft: 12,
                    gap: 8,
                    radius: 4,
                    ...(label === active
                      ? { bindings: { fills: "color-surface-active" } }
                      : {}),
                  },
                ),
              ),
              { x: 8, y: 116, layoutPositioning: "ABSOLUTE", gap: 4 },
            ),
          ]
        : []),
      frame(
        "utility-navigation",
        utilityLabels.map((label, i) =>
          row(
            "utility-" + i,
            [
              icon("utility-icon", utilityIcons[i], 20, S.muted),
              body("utility-label", label, "medium", "weak"),
            ],
            { height: 36, gap: 8, paddingLeft: 12 },
          ),
        ),
        {
          x: 8,
          y: height - 274,
          width: 240,
          layoutPositioning: "ABSOLUTE",
          gap: 0,
        },
      ),
      row(
        "account",
        [
          userAvatar("account-avatar", 24),
          body("account-name", "Demo user", "small", "default", "default", {
            width: 160,
          }),
          icon("notifications", "bell", 16, S.muted),
        ],
        {
          x: 8,
          y: height - 52,
          width: 240,
          height: 44,
          paddingLeft: 8,
          paddingRight: 8,
          gap: 12,
          layoutPositioning: "ABSOLUTE",
        },
      ),
      {
        ...rect("utility-divider", 240, 1, S.line),
        x: 8,
        y: height - 282,
        layoutPositioning: "ABSOLUTE",
      },
      {
        ...rect("account-divider", 240, 1, S.line),
        x: 8,
        y: height - 52,
        layoutPositioning: "ABSOLUTE",
      },
      {
        ...rect("rail-divider", 1, height, S.line),
        x: 256,
        y: 0,
        layoutPositioning: "ABSOLUTE",
      },
    ],
    { width: 257, height, bindings: { fills: S.dim } },
  );
};
make(
  "NavigationRail",
  ["brands", "guidelines", "libraries", "empty-libraries"].map((page) => ({
    props: { page },
    root: rail(page),
  })),
  "Measured 257px desktop rail including its 1px separator. Brand context adds the observed navigation search and five primary rows.",
);
const bottom = (page) => {
  const global = page === "brands",
    brand = page === "empty-libraries" ? demo.brands[1] : demo.brands[0];
  return row(
    "bottom-brand-bar",
    [
      row(
        "workspace",
        [
          global ? icon("menu", "lines", 20) : avatar("brand-thumb", 28, brand),
          frame("workspace-copy", [
            title("workspace", global ? "Brands" : brand.name),
            ...(global
              ? [body("workspace-caption", "Demo workspace", "x-small", "weak")]
              : []),
          ]),
          ...(!global ? [icon("brand-dropdown", "caret-down", 12)] : []),
        ],
        { width: global ? 158 : 160, gap: global ? 16 : 8 },
      ),
      row(
        "utilities",
        [
          ...(!global ? [icon("search", "magnifier")] : []),
          icon("messages", "speech-bubble-dots"),
          icon("notifications", "bell"),
          row(
            "account-more",
            [
              userAvatar("account", 36),
              frame("more", [icon("more", "dots-vertical")], {
                width: 36,
                height: 36,
                primaryAlign: "CENTER",
                counterAlign: "CENTER",
                radius: 4,
                bindings: { fills: "color-container-secondary-default" },
              }),
            ],
            { gap: 4 },
          ),
        ],
        { gap: 12 },
      ),
    ],
    {
      width: 390,
      height: 68,
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: global ? 20 : 16,
      paddingRight: 20,
      primaryAlign: "SPACE_BETWEEN",
      bindings: { fills: S.dim, strokes: S.line },
    },
  );
};
make(
  "MobileBrandBar",
  ["brands", "guidelines", "libraries", "empty-libraries"].map((page) => ({
    props: { page },
    root: bottom(page),
  })),
  "Observed fixed 68px mobile brand bar, replacing the desktop left rail.",
);
const tabs = (profile) =>
  row(
    "library-tabs",
    [
      frame("selected-tab", [title("overview-label", "Overview")], {
        height: 28,
        paddingLeft: 8,
        paddingRight: 8,
        primaryAlign: "CENTER",
        radius: 4,
        bindings: { fills: "color-container-secondary-default" },
      }),
      title("remote-assets", "Remote assets"),
      title("shared-folders", profile === "tablet" ? "…" : "Shared folders"),
    ],
    { height: profiles[profile].mobile ? 28 : 36, gap: 16 },
  );
function header(page, profile) {
  const p = profiles[profile],
    label =
      page === "brands"
        ? "Overview"
        : page === "guidelines"
          ? "Guidelines"
          : "Libraries",
    action =
      page === "brands"
        ? "New brand"
        : page === "guidelines"
          ? "New guideline"
          : "New library";
  return frame(
    "page-header",
    [
      row(
        "title-action",
        [
          row(
            "title-tabs",
            [
              title("title", label),
              ...(page === "libraries" && !p.mobile
                ? [rect("separator", 1, 28, S.line), tabs(profile)]
                : []),
            ],
            { gap: 20 },
          ),
          row(
            "new-action-group",
            [
              icon("new-action-icon", "plus", 16, "color-primary-on-primary"),
              button("new-action", action, "strong", {
                bindings: { paddingLeft: "component-constant-spacing-0" },
              }),
            ],
            {
              height: 36,
              paddingLeft: 12,
              gap: 8,
              radius: 4,
              bindings: { fills: "color-primary-default" },
            },
          ),
        ],
        {
          width: p.main,
          height: p.mobile && page !== "libraries" ? 96 : 60,
          paddingLeft: 24,
          paddingRight: 24,
          primaryAlign: "SPACE_BETWEEN",
        },
      ),
      ...(page === "libraries" && p.mobile
        ? [
            row("tabs-row", [tabs(profile)], {
              width: p.main,
              height: 36,
              paddingLeft: 76,
              counterAlign: "MAX",
            }),
          ]
        : []),
    ],
    {
      width: p.main,
      height: p.mobile ? 96 : 60,
      bindings: { fills: S.surface, strokes: S.line },
    },
  );
}
make(
  "PageHeader",
  ["brands", "guidelines", "libraries"].flatMap((page) =>
    ["wide", "desktop", "tablet", "mobile"].map((viewport) => ({
      props: { page, viewport },
      root: header(page, viewport),
    })),
  ),
  "Measured page titles, primary actions, and Libraries navigation. Mobile Libraries tabs wrap to a second 36px row.",
  [
    "Primary actions compose a released plus-icon instance and native Button label; the label-side padding override preserves the observed 16px icon and 8px gap.",
  ],
);
const viewControls = () =>
  row(
    "view-controls",
    [
      frame("grid-selected", [icon("grid", "grid-regular")], {
        width: 36,
        height: 36,
        radius: 4,
        primaryAlign: "CENTER",
        counterAlign: "CENTER",
        bindings: { fills: S.surface, strokes: "color-line-strong" },
      }),
      frame("list", [icon("list", "list-bullet")], {
        width: 36,
        height: 36,
        primaryAlign: "CENTER",
        counterAlign: "CENTER",
        radius: 4,
        bindings: { fills: S.dim, strokes: "color-line-mid" },
      }),
    ],
    { gap: 0 },
  );
const sortControls = () =>
  row(
    "sort-view",
    [
      row(
        "sort",
        [
          icon("sort-icon", "caret-up-down", 12, S.muted),
          body("sort-label", "Date created", "small"),
          icon("sort-caret", "caret-down"),
        ],
        { gap: 8 },
      ),
      viewControls(),
    ],
    { gap: 16 },
  );
function search(page, profile) {
  const p = profiles[profile],
    isBrands = page === "brands",
    label = isBrands
      ? "Search"
      : page === "guidelines"
        ? "Search guidelines"
        : "Search libraries";
  const input = row(
    "unboxed-search",
    [
      icon("search-icon", "magnifier", 16, S.muted),
      body("search-label", label, "medium", "weak"),
    ],
    {
      gap: 8,
      height: 36,
      dataBinding: binding(
        page === "brands" ? "brands" : page,
        "query",
        "search",
      ),
    },
  );
  if (!p.mobile)
    return row(
      "search-toolbar",
      [input, ...(!isBrands ? [sortControls()] : [])],
      {
        width: p.main,
        height: 54,
        paddingLeft: 24,
        paddingRight: 24,
        primaryAlign: "SPACE_BETWEEN",
        bindings: { fills: S.surface, strokes: S.line },
      },
    );
  return frame(
    "search-toolbar",
    [
      {
        ...input,
        x: 24,
        y: isBrands ? 9 : 31,
        layoutPositioning: "ABSOLUTE",
        width: isBrands ? 342 : 180,
      },
      ...(!isBrands
        ? [
            {
              ...sortControls(),
              x: 24,
              y: 98,
              layoutPositioning: "ABSOLUTE",
              width: 342,
              primaryAlign: "MAX",
            },
          ]
        : []),
    ],
    {
      width: 390,
      height: isBrands ? 54 : 122,
      bindings: { fills: S.surface, strokes: S.line },
      clipContent: false,
    },
  );
}
make(
  "SearchToolbar",
  ["brands", "guidelines", "libraries"].flatMap((page) =>
    ["wide", "desktop", "tablet", "mobile"].map((viewport) => ({
      props: { page, viewport },
      root: search(page, viewport),
    })),
  ),
  "Unboxed full-width search region; sort and grid/list controls appear only on the two observed brand pages.",
  [
    "At 390px Guidelines/Libraries, the observed controls extend 12px below their layout region and overlap the start of content. This reproduction records that production limitation rather than inventing a polished breakpoint.",
  ],
);
function banner(id, width, brand) {
  return frame(id, [], {
    width,
    height: width / 2,
    clipContent: true,
    radius: 8,
    ...approvedImageProps(brand.imageAssetId),
    dataBinding: binding("brands", "imageAssetId", "string", brand.id),
  });
}
const brandCard = (brand, profile) => {
  const p = profiles[profile];
  return frame(
    "brand-card",
    [
      banner("banner", p.card, brand),
      row(
        "footer",
        [
          avatar("brand-thumbnail", 40, brand),
          row(
            "title-menu",
            [
              title("brand-name", brand.name),
              icon("more", "dots-vertical", 16, S.muted),
            ],
            { width: p.card - 81, primaryAlign: "SPACE_BETWEEN" },
          ),
        ],
        {
          width: p.card,
          height: 64,
          padding: 12,
          gap: 12,
          primaryAlign: "MIN",
        },
      ),
    ],
    {
      width: p.card,
      gap: 0,
      dataBinding: binding("brands", "name", "string", brand.id),
    },
  );
};
make(
  "BrandCard",
  demo.brands.slice(0, 2).flatMap((brand) =>
    ["wide", "desktop", "mobile"].map((viewport) => ({
      props: { brand: brand.id, viewport },
      root: brandCard(brand, viewport),
    })),
  ),
  "Observed 2:1 brand artwork with a 64px footer, 40px thumbnail, title and overflow control; real Fondue text/icon instances remain nested.",
);
const guide = demo.guidelines[0];
const guideCard = (profile) => {
  const p = profiles[profile];
  return frame(
    "guideline-card",
    [
      banner("banner", p.card, demo.brands[0]),
      row(
        "footer",
        [
          frame(
            "copy",
            [
              title("guideline-name", guide.name),
              body("page-count", guide.pageCount + " pages", "small", "weak"),
            ],
            { gap: 4 },
          ),
          icon("more", "dots-vertical", 16, S.muted),
        ],
        {
          width: p.card,
          height: 56,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          primaryAlign: "SPACE_BETWEEN",
        },
      ),
    ],
    {
      width: p.card,
      dataBinding: binding("guidelines", "name", "string", guide.id),
    },
  );
};
make(
  "GuidelineCard",
  ["wide", "desktop", "mobile"].map((viewport) => ({
    props: { viewport },
    root: guideCard(viewport),
  })),
  "One observed guideline tile: 2:1 artwork and 56px title/page-count footer. Synthetic guide name replaces private account content.",
);
const library = demo.libraries[0],
  assetCount = demo.assets.filter(
    (asset) => asset.libraryId === library.id,
  ).length;
const libraryCard = (profile) => {
  const p = profiles[profile];
  return frame(
    "library-card",
    [
      banner("banner", p.card, demo.brands[0]),
      row(
        "footer",
        [
          frame(
            "library-thumbnail",
            [icon("library-icon", "image-stack", 20, "color-line-strong")],
            {
              width: 40,
              height: 40,
              primaryAlign: "CENTER",
              counterAlign: "CENTER",
              radius: 4,
              bindings: { fills: S.dim },
            },
          ),
          frame(
            "copy",
            [
              title("library-name", library.name),
              body("asset-count", assetCount + " assets", "small", "weak"),
            ],
            { gap: 4 },
          ),
        ],
        { width: p.card, height: 64, padding: 12, gap: 12 },
      ),
    ],
    {
      width: p.card,
      dataBinding: binding("libraries", "name", "string", library.id),
    },
  );
};
make(
  "LibraryCard",
  ["wide", "desktop", "mobile"].map((viewport) => ({
    props: { viewport },
    root: libraryCard(viewport),
  })),
  "Observed populated Libraries overview has one tile with a 64px thumbnail/title/asset-count footer and no visible overflow action. Asset count comes from the owned synthetic fixture.",
);
function illustration(mobile) {
  const w = mobile ? 300 : 320;
  const card = (id, rotation, x, y, label, color) =>
    frame(
      id,
      [
        body("kind-label", label, "x-small", "weak"),
        frame("artwork", [], {
          width: 100,
          height: 72,
          radius: 4,
          ...approvedImageProps(
            id === "video-card"
              ? "frontify-stock-collaboration"
              : "frontify-laptop-campaign",
          ),
        }),
        rect("text-line-one", 90, 3, "color-line-subtle"),
        rect("text-line-two", 68, 3, "color-line-subtle"),
      ],
      {
        width: 124,
        height: 164,
        padding: 12,
        gap: 8,
        rotation,
        x,
        y,
        layoutPositioning: "ABSOLUTE",
        radius: 8,
        effectStyle: "shadow-default",
        bindings: { fills: S.surface },
      },
    );
  return frame(
    "original-library-illustration",
    [
      ...Array.from({ length: 4 }, (_, i) => ({
        ...rect(
          "pale-tile-" + i,
          148,
          90,
          "color-container-secondary-default",
          16,
        ),
        x: (i % 2) * 156,
        y: 23 + Math.floor(i / 2) * 98,
        layoutPositioning: "ABSOLUTE",
      })),
      card("video-card", 8, 24, 40, "VIDEOS", "color-charts-secondary-default"),
      card("logo-card", -14, 150, 23, "LOGOS", "color-charts-primary-default"),
    ],
    { width: w, height: 220 },
  );
}
const emptyDescription =
  "Upload your assets to get started. Once your library is ready, add it to your guidelines so your team can find and download what they need.";
function emptyState(profile) {
  const p = profiles[profile],
    width = p.mobile ? 342 : p.main - 48,
    height = p.mobile ? 534 : 798;
  return frame(
    "empty-library-panel",
    [
      illustration(p.mobile),
      {
        id: "display-title",
        name: "Libraries / source Cranny display",
        kind: "text",
        text: "Libraries",
        fontFamily: "Cranny",
        fontWeight: 300,
        fontSize: 46,
        lineHeight: 54,
        textStyle: "text-display-xx-large-light",
        bindings: { fills: S.text },
      },
      {
        id: "description",
        name: "Description",
        kind: "text",
        text: emptyDescription,
        textAlignHorizontal: "CENTER",
        width: p.mobile ? 330 : Math.min(470, width - 48),
        fontFamily: "Diatype",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: 18,
        bindings: { fills: S.muted },
      },
      button("create-library", "+ Create library"),
      {
        id: "get-started",
        name: "Get started with libraries / underlined help",
        kind: "text",
        text: "Get started with libraries",
        fontFamily: "Diatype",
        fontWeight: 400,
        fontSize: 12,
        lineHeight: 16,
        textDecoration: "UNDERLINE",
        bindings: { fills: S.text },
      },
    ],
    {
      width,
      height,
      gap: 16,
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      radius: 8,
      bindings: { fills: S.dim, cornerRadius: "border-radius-large" },
    },
  );
}
make(
  "LibrariesEmptyState",
  ["wide", "desktop", "tablet", "mobile"].map((viewport) => ({
    props: { viewport },
    root: emptyState(viewport),
  })),
  "Observed empty Libraries panel with actual source Cranny Light 46/54 display typography, exact generic UI copy and create/help actions.",
  [
    "The 2 tilted asset cards and4 pale tiles remain native editable geometry. Their image-content areas use approved real Frontify photography; this is an explicit media substitution, not exact application illustration imagery.",
  ],
);
// Only the observed edge separators are physical; no decorative bounding rectangles.
for (const pattern of patterns) {
  if (
    ![
      "ProductionPageHeader",
      "ProductionSearchToolbar",
      "ProductionMobileBrandBar",
    ].includes(pattern.name)
  )
    continue;
  for (const variant of pattern.variants) {
    const root = variant.root;
    delete root.bindings.strokes;
    root.children.push({
      ...rect("edge-separator", root.width, 1, S.line),
      x: 0,
      y: pattern.name === "ProductionMobileBrandBar" ? 0 : root.height - 1,
      layoutPositioning: "ABSOLUTE",
    });
    if (
      pattern.name === "ProductionSearchToolbar" &&
      variant.props.page !== "brands"
    )
      root.children.push({
        ...rect(
          "search-divider",
          1,
          variant.props.viewport === "mobile" ? 80 : 36,
          S.line,
        ),
        x: 200,
        y: variant.props.viewport === "mobile" ? 31 : 9,
        layoutPositioning: "ABSOLUTE",
      });
  }
}
for (const recipe of patterns) {
  if (
    !["ProductionGuidelineCard", "ProductionLibraryCard"].includes(recipe.name)
  )
    continue;
  for (const variant of recipe.variants) {
    const bannerNode = variant.root.children.find((n) => n.id === "banner");
    const entity =
      recipe.name === "ProductionGuidelineCard"
        ? demo.guidelines[0]
        : demo.libraries[0];
    Object.assign(bannerNode, approvedImageProps(entity.imageAssetId));
    bannerNode.dataBinding = binding(
      recipe.name === "ProductionGuidelineCard" ? "guidelines" : "libraries",
      "imageAssetId",
      "string",
      entity.id,
    );
  }
}
export { patterns };
const screen = (page, viewport, state = "populated") => {
  const p = profiles[viewport],
    mobile = p.mobile,
    id = "examples/production-" + page + "-" + state + "-" + viewport;
  const cards =
    page === "brands"
      ? demo.brands.slice(0, 2).map((brand) =>
          part("brand-" + brand.id, "patterns/ProductionBrandCard", {
            brand: brand.id,
            viewport,
          }),
        )
      : page === "guidelines"
        ? [part("guideline", "patterns/ProductionGuidelineCard", { viewport })]
        : [part("library", "patterns/ProductionLibraryCard", { viewport })];
  const content =
    state === "empty"
      ? [
          part("empty-state", "patterns/ProductionLibrariesEmptyState", {
            viewport,
          }),
        ]
      : [
          frame("card-grid", cards, {
            layout: mobile ? "VERTICAL" : "HORIZONTAL",
            gap: 16,
            width: mobile ? 342 : p.main - 48,
          }),
        ];
  const main = frame(
    "main",
    [
      part("header", "patterns/ProductionPageHeader", { page, viewport }),
      part("toolbar", "patterns/ProductionSearchToolbar", { page, viewport }),
      frame("content", content, {
        width: p.main,
        height:
          (mobile ? 776 : p.height) -
          (mobile ? 96 : 60) -
          (mobile ? (page === "brands" ? 54 : 122) : 54),
        paddingTop: mobile && page !== "brands" ? 0 : 24,
        paddingLeft: 24,
        paddingRight: 24,
        paddingBottom: 24,
        gap: 16,
      }),
    ],
    {
      width: p.main,
      height: mobile ? 776 : p.height,
      bindings: { fills: S.surface },
    },
  );
  return {
    id,
    name:
      "Production / " +
      (page === "brands"
        ? "Brands overview"
        : page === "guidelines"
          ? "Guidelines overview"
          : state === "empty"
            ? "Libraries empty state"
            : "Libraries overview") +
      " / " +
      p.width +
      "px",
    width: p.width,
    height: p.height,
    fixture: demo.datasetId,
    productionReference: {
      ...observation,
      profile: viewport,
      viewport: { width: p.width, height: p.height },
      cardGrid: mobile
        ? { columns: 1, cardWidth: 342, gap: 16 }
        : viewport === "wide"
          ? { columns: 5, cardWidth: 310.2, gap: 16 }
          : viewport === "desktop"
            ? { columns: 4, cardWidth: 271.75, gap: 16 }
            : { sidebarRetained: true },
      state,
    },
    limitations: [
      "Editable native component-instance composition; no live data, routing or executable actions.",
      "Fictional names and records use approved real Frontify media in editable native image fills; private viewport screenshots are never embedded.",
      ...(mobile && page !== "brands"
        ? [
            "Observed 390px toolbar/content overlap of 12px is preserved and labelled as a production narrow-layout limitation.",
          ]
        : []),
      ...(viewport === "tablet"
        ? [
            "768px sidebar retention/tab ellipsis are observed; 960px review height is a chosen viewport extent.",
          ]
        : []),
    ],
    documentation: docs(
      "Measured production " +
        page +
        " " +
        state +
        " at " +
        p.width +
        "px; synthetic data only.",
    ),
    root: frame(
      "screen",
      mobile
        ? [
            main,
            {
              ...part("mobile-bar", "patterns/ProductionMobileBrandBar", {
                page: state === "empty" ? "empty-libraries" : page,
              }),
              x: 0,
              y: 776,
              layoutPositioning: "ABSOLUTE",
            },
          ]
        : [
            part("rail", "patterns/ProductionNavigationRail", {
              page: state === "empty" ? "empty-libraries" : page,
            }),
            main,
          ],
      {
        layout: "HORIZONTAL",
        width: p.width,
        height: p.height,
        gap: 0,
        clipContent: true,
        bindings: { fills: S.surface },
      },
    ),
  };
};
export const screens = [
  ...["brands", "guidelines", "libraries"].flatMap((page) =>
    ["wide", "desktop", "mobile"].map((viewport) => screen(page, viewport)),
  ),
  ...["wide", "tablet", "mobile"].map((viewport) =>
    screen("libraries", viewport, "empty"),
  ),
];
export default patterns;

const additional = createAdditionalExamples({
  frame,
  row,
  inst,
  part,
  body,
  title,
  button,
  icon,
  rect,
  S,
  demo,
  sources,
  userAvatar,
  header,
  search,
  rail,
  bottom,
  brandCard,
});
export const additionalPatterns = additional.patterns;
export const additionalScreens = additional.screens;
export const additionalImageSlots = additional.imageSlots;
