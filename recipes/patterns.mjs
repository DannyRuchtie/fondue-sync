/** Native complex patterns audited against the pinned 13.11.1 source.
 * Open-ended children are sample content. `state` is explicitly a CSS/ARIA state,
 * not a generated React prop. Public prop names retain source spelling/casing.
 */
const C = "packages/components/src/components/";
const S = {
  surface: "color-surface-default",
  dim: "color-surface-dim",
  hover: "color-surface-hover",
  active: "color-surface-active",
  text: "color-primary-default",
  secondary: "color-secondary-default",
  disabled: "color-disabled-default",
  line: "color-line-mid",
  subtle: "color-line-subtle",
  strong: "color-line-strong",
};
const sizes = {
  12: "x-small",
  13: "small",
  14: "medium",
  16: "large",
  20: "x-large",
  24: "xx-large",
};
const t = (id, text, size = 14, color = S.text, strong = false) => ({
  id,
  kind: "text",
  name: id,
  text,
  fontSize: size,
  fontWeight: strong ? 500 : 400,
  textStyle: `text-body-${sizes[size] ?? "medium"}-${strong ? "strong" : "default"}`,
  bindings: {
    fills: color,
    fontSize: `typography-font-size-${sizes[size] ?? "medium"}`,
  },
});
const f = (id, children = [], opts = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "HORIZONTAL",
  primaryAlign: "MIN",
  counterAlign: "CENTER",
  gap: 0,
  padding: 0,
  children,
  ...opts,
});
const col = (id, children = [], opts = {}) =>
  f(id, children, { layout: "VERTICAL", counterAlign: "MIN", ...opts });
const icon = (id, name, size = 16, color = S.text) => ({
  id,
  kind: "instance",
  name: id,
  iconId: `icon:${name}`,
  width: size,
  height: size,
  iconColor: color,
});
const box = (id, w, h, color = S.dim, radius = 0) => ({
  id,
  kind: "rectangle",
  name: id,
  width: w,
  height: h,
  radius,
  bindings: { fills: color },
});
const line = (id, w = 280) => box(id, w, 1, S.subtle);
const padBindings = (horizontal, vertical = horizontal) => ({
  paddingLeft: `spacing-${horizontal}`,
  paddingRight: `spacing-${horizontal}`,
  paddingTop: `spacing-${vertical}`,
  paddingBottom: `spacing-${vertical}`,
});
const surface = (id, children = [], opts = {}) =>
  col(id, children, {
    radius: 4,
    bindings: {
      fills: S.surface,
      strokes: S.subtle,
      cornerRadius: "border-radius-medium",
    },
    ...opts,
  });
const shadow = (level) => [
  {
    type: "DROP_SHADOW",
    color: {
      r: 8 / 255,
      g: 8 / 255,
      b: 8 / 255,
      a: level === "medium" ? 0.15 : 0.2,
    },
    offset: { x: 0, y: level === "medium" ? 3 : 25 },
    radius: level === "medium" ? 10 : 80,
    spread: 0,
    visible: true,
    blendMode: "NORMAL",
  },
];
const action = (id, text, primary = false) =>
  f(
    id,
    [t("label", text, 14, primary ? "color-primary-on-primary" : S.text, true)],
    {
      height: 36,
      paddingLeft: 12,
      paddingRight: 12,
      radius: 4,
      primaryAlign: "CENTER",
      bindings: {
        fills: primary ? S.text : "color-container-secondary-default",
        cornerRadius: "border-radius-medium",
      },
    },
  );
const field = (id, text, disabled = false, width = 240) =>
  f(id, [t("value", text, 14, disabled ? S.disabled : S.text)], {
    width,
    height: 36,
    paddingLeft: 12,
    paddingRight: 12,
    radius: 4,
    bindings: {
      fills: disabled ? "color-container-disabled-default" : S.surface,
      strokes: disabled ? S.subtle : S.line,
      cornerRadius: "border-radius-medium",
    },
  });
const props = (axes, fn) => {
  let rows = [{}];
  for (const [name, values] of Object.entries(axes))
    rows = rows.flatMap((row) =>
      values.map((value) => ({ ...row, [name]: String(value) })),
    );
  return rows.map((p) => ({
    id: Object.entries(p)
      .map(([k, v]) => `${k}=${v}`)
      .join(";"),
    props: p,
    root: fn(p),
  }));
};
const recipes = [];
const evidence = [];
function add(
  name,
  variants,
  {
    family = name.split(".")[0],
    files = [
      `${family}.tsx`,
      `styles/${family[0].toLowerCase() + family.slice(1)}.module.scss`,
    ],
    covered = [],
    limitations = [],
    status = "partial",
  } = {},
) {
  const source = files.map((file) => C + family + "/" + file);
  const recipe = {
    id: `components/${name}`,
    name: name.replaceAll(".", "/"),
    package: "@frontify/fondue/components",
    source,
    status,
    limitations: [
      ...limitations,
      "Native static definitions do not implement browser event handlers, focus management or accessibility semantics.",
      "Source styling and finite states are encoded here; visual parity still requires Figma runtime review.",
    ],
    variants,
  };
  recipes.push(recipe);
  evidence.push({
    id: recipe.id,
    source,
    covered,
    variantCount: variants.length,
    limitations: recipe.limitations,
  });
  return recipe;
}

// Accordion: actual public padding and variant props, not the previous invented expanded prop.
const accordionPads = {
  none: [0, 0],
  small: [12, 16],
  medium: [16, 24],
  large: [24, 32],
};
function accordionItem(p) {
  const open = p.value === "details",
    disabled = p.disabled === "true",
    pill = p.variant === "pill";
  let [v, h] = accordionPads[p.padding];
  if (pill && p.padding === "none") [v, h] = [8, 12];
  const caret = icon(
    "caret",
    open ? "caret-up" : "caret-down",
    16,
    disabled ? S.disabled : open ? S.text : S.secondary,
  );
  return col(
    "item",
    [
      f(
        "header",
        [
          t(
            "title",
            "Brand information",
            14,
            disabled ? S.disabled : open ? S.text : S.secondary,
          ),
          caret,
        ],
        {
          width: 340,
          paddingTop: v,
          paddingBottom: v,
          paddingLeft: h,
          paddingRight: h,
          gap: 12,
          radius: pill ? 8 : 0,
          primaryAlign: "SPACE_BETWEEN",
          bindings: pill
            ? {
                fills: open ? S.active : S.dim,
                cornerRadius: "border-radius-large",
              }
            : {},
        },
      ),
      ...(open
        ? [
            col("content", [t("text", "Keep your brand consistent.")], {
              width: 340,
              paddingTop: pill ? v : 0,
              paddingBottom: v,
              paddingLeft: h,
              paddingRight: h,
            }),
          ]
        : []),
    ],
    { gap: 0 },
  );
}
for (const [variant, border] of [
  ["default", true],
  ["default", false],
  ["pill", false],
])
  add(
    variant === "pill"
      ? "Accordion.pill"
      : border
        ? "Accordion"
        : "Accordion.borderless",
    props(
      {
        variant: [variant],
        border: [border],
        padding: Object.keys(accordionPads),
        value: ["", "details"],
        disabled: [false, true],
      },
      (p) =>
        col(
          "accordion",
          [
            ...(border ? [line("top-border", 340)] : []),
            accordionItem(p),
            ...(border ? [line("bottom-border", 340)] : []),
          ],
          { gap: variant === "pill" ? 8 : 0 },
        ),
    ),
    {
      family: "Accordion",
      files: ["Accordion.tsx", "styles/accordion.module.scss"],
      covered: [
        "Root.variant default/pill",
        "Root.padding none/small/medium/large",
        "Root.value open/closed item",
        "Root.disabled",
        "Root.border true/false (pill ignores border per source)",
        "Header title + rotating caret",
        "Content native open/closed layout",
      ],
      limitations: [
        "Single-item composition; sticky positioning is provided as a separate source-context set. Header/Slot children are editable composition.",
      ],
    },
  );
add(
  "Accordion.Content",
  props(
    { padding: Object.keys(accordionPads), divider: [false, true] },
    (p) => {
      const [v, h] = accordionPads[p.padding];
      return col(
        "content",
        [
          ...(p.divider === "true" ? [line("divider", 300)] : []),
          t("content", "Details and metadata"),
        ],
        {
          width: 340,
          paddingLeft: h,
          paddingRight: h,
          paddingTop: p.divider === "true" ? v : 0,
          paddingBottom: v,
          gap: p.divider === "true" ? v : 0,
        },
      );
    },
  ),
  {
    family: "Accordion",
    files: ["Accordion.tsx", "styles/accordion.module.scss"],
    covered: ["Content.padding all four values", "Content.divider boolean"],
    limitations: ["Content children are an editable text sample."],
  },
);

add(
  "Accordion.sticky",
  props(
    {
      variant: ["default", "pill"],
      padding: Object.keys(accordionPads),
      value: ["", "details"],
      sticky: [true],
    },
    (p) => {
      const item = accordionItem({ ...p, disabled: "false" });
      if (p.variant === "default")
        item.children[0].bindings = { fills: S.surface };
      return col("accordion", [item], { width: 340 });
    },
  ),
  {
    family: "Accordion",
    files: ["Accordion.tsx", "styles/accordion.module.scss"],
    covered: [
      "Root.sticky true source header background",
      "Root.variant and padding inherited context",
      "Root.value empty/open",
    ],
    limitations: [
      "Native static header visual is represented; CSS position:sticky and data-stuck shadow depend on a scrolling viewport.",
    ],
  },
);

// Card: public banner sizes/tone and selectable selected card state.
function cardBanner(p, id = "banner") {
  const height = p.size === "small" ? 80 : 160;
  return f(
    id,
    [
      icon(
        "banner-icon",
        "document",
        40,
        p.tone === "inverted"
          ? "color-primary-on-primary"
          : "color-low-contrast-default",
      ),
    ],
    {
      width: 240,
      height,
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      radius: 8,
      bindings: {
        fills: p.tone === "inverted" ? S.text : S.dim,
        strokes: S.subtle,
        cornerRadius: "border-radius-large",
      },
    },
  );
}
add(
  "Card",
  props(
    { selected: [false, true], state: ["default", "hover", "active"] },
    (p) =>
      surface(
        "card",
        [
          cardBanner({ size: "small", tone: "dim" }),
          col(
            "content",
            [
              {
                ...t("title", "Brand assets", 14, S.text, true),
                lineHeight: 16,
              },
              {
                ...t("description", "Approved resources", 13, S.secondary),
                lineHeight: 16,
              },
            ],
            { padding: 12, gap: 4, width: 240 },
          ),
          ...(p.selected === "true"
            ? [
                f(
                  "selection",
                  [icon("check", "check-mark", 16, "color-primary-on-primary")],
                  {
                    x: 16,
                    y: 16,
                    layoutPositioning: "ABSOLUTE",
                    width: 20,
                    height: 20,
                    radius: 4,
                    primaryAlign: "CENTER",
                    bindings: {
                      fills: S.text,
                      cornerRadius: "border-radius-medium",
                    },
                  },
                ),
              ]
            : []),
        ],
        {
          width: 240,
          radius: 8,
          bindings: {
            fills:
              p.state === "hover"
                ? S.hover
                : p.state === "active"
                  ? S.active
                  : S.surface,
            strokes:
              p.selected === "true"
                ? S.strong
                : p.state === "default"
                  ? S.surface
                  : S.subtle,
            cornerRadius: "border-radius-large",
          },
        },
      ),
  ),
  {
    family: "Card",
    files: [
      "Card.ts",
      "CardRoot.tsx",
      "CardBanner.tsx",
      "CardContent.tsx",
      "styles/card.module.scss",
    ],
    covered: [
      "Root.selected boolean",
      "Interactive CSS default/hover/active states",
      "Banner small 3:1 ratio",
      "Title and Description source typography",
      "Selection indicator absolute inset 16 and 20px size",
    ],
    limitations: [
      "state is a CSS interaction state; public Root selection needs onSelect and href/onNavigate configuration.",
      "Image fit, BannerDescription hover overlay, badges and action compositions are supplied as separate parts or not fully enumerated.",
    ],
  },
);
add(
  "Card.Banner",
  props({ size: ["small", "large"], tone: ["dim", "inverted"] }, (p) =>
    cardBanner(p),
  ),
  {
    family: "Card",
    files: ["CardBanner.tsx", "styles/card.module.scss"],
    covered: [
      "Banner.size small/large source ratios 3:1 and 9:6",
      "Banner.tone dim/inverted",
      "BannerIcon source size 40",
    ],
    limitations: [
      "Native icon content specimen; arbitrary images and multi-image arrangements remain content slots.",
    ],
  },
);
add(
  "Card.BannerIcon",
  props({ variant: ["primary", "warning", "error", "success"] }, (p) =>
    f(
      "banner-icon",
      [icon("icon", "document", 40, `color-${p.variant}-default`)],
      {
        width: 240,
        height: 80,
        primaryAlign: "CENTER",
        bindings: { fills: S.dim },
      },
    ),
  ),
  {
    family: "Card",
    files: ["CardBanner.tsx", "styles/card.module.scss"],
    covered: ["BannerIcon semantic variants primary/warning/error/success"],
    limitations: [
      "Inverted parent tone overrides icon colors; use Banner.inverted for that composition.",
    ],
  },
);
add(
  "Card.ThumbnailIcon",
  props({ state: ["default"] }, () =>
    f(
      "thumbnail",
      [icon("icon", "document", 24, "color-low-contrast-default")],
      {
        width: 40,
        height: 40,
        radius: 4,
        primaryAlign: "CENTER",
        bindings: { fills: S.dim, cornerRadius: "border-radius-medium" },
      },
    ),
  ),
  {
    family: "Card",
    files: ["CardContent.tsx", "styles/card.module.scss"],
    covered: ["40px thumbnail geometry and current tokens"],
    limitations: ["Arbitrary image content is not synthesized."],
  },
);
for (const [name, size, strong, color] of [
  ["Title", 14, true, S.text],
  ["Description", 13, false, S.secondary],
])
  add(
    `Card.${name}`,
    props({ state: ["default"] }, () =>
      col(
        name.toLowerCase(),
        [
          {
            ...t(
              "text",
              name === "Title"
                ? "Brand assets"
                : "Explore approved brand resources",
              size,
              color,
              strong,
            ),
            lineHeight: 16,
          },
        ],
        {
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: name === "Title" ? 12 : 4,
          paddingBottom: 0,
        },
      ),
    ),
    {
      family: "Card",
      files: ["CardContent.tsx", "styles/card.module.scss"],
      covered: [`${name} typography, source padding and token fill`],
      limitations: ["Truncation requires a consumer-defined available width."],
    },
  );

add(
  "Card.ActionButton",
  props({ state: ["default", "hover", "open", "focus"] }, (p) =>
    f("action-button", [icon("icon", "dots-horizontal", 16)], {
      width: 24,
      height: 24,
      primaryAlign: "CENTER",
      radius: 4,
      ...(p.state === "focus"
        ? {
            focusRing: {
              inner: "color-surface-default",
              outer: "color-focus-default",
              innerSpread: 0,
              outerSpread: 4,
            },
          }
        : {}),
      bindings: {
        ...(p.state === "hover" || p.state === "open"
          ? { fills: "color-container-secondary-default" }
          : {}),
        cornerRadius: "border-radius-medium",
      },
    }),
  ),
  {
    family: "Card",
    files: ["CardAction.tsx", "styles/card.module.scss"],
    covered: [
      "ActionButton24px source geometry",
      "CSS hover/open semantic surface",
      "Focus4px source outline",
    ],
    limitations: [
      "state is a CSS/focus visual state; arbitrary action behavior remains in React.",
    ],
  },
);

// Dialog/Flyout layout primitives use their actual source spacing contract.
const panelPads = {
  none: [0, 0],
  tight: [8, 8],
  compact: [16, 8],
  comfortable: [24, 16],
  spacious: [40, 24],
};
const panelFiles = (family) => [
  `${family}.tsx`,
  `styles/${family.toLowerCase()}.module.scss`,
];
function panelHeader(family, p) {
  const h = panelPads[p.padding][0],
    width = family === "Dialog" ? 368 : 288;
  return col(
    "header",
    [
      f(
        "contents",
        [
          t("title", "Publish changes", 16, S.text, true),
          ...(p.showCloseButton === "true" ? [icon("close", "cross", 16)] : []),
        ],
        { width, height: 24, primaryAlign: "SPACE_BETWEEN" },
      ),
      ...(p.showBorder === "true"
        ? [
            {
              ...line("divider", width),
              layoutPositioning: "ABSOLUTE",
              x: h,
              y: 24 + 2 * h - 1,
            },
          ]
        : []),
    ],
    { padding: h, width: width + 2 * h, height: 24 + 2 * h },
  );
}
function panelBody(p, width = 368) {
  const [h, v] = panelPads[p.padding];
  return col(
    "body",
    [
      t("description", "Make the latest changes available."),
      field("name", "Release name", false, width),
    ],
    {
      paddingLeft: h,
      paddingRight: h,
      paddingTop: v,
      paddingBottom: v,
      gap: 16,
    },
  );
}
function panelFooter(p, width = 368) {
  const h = panelPads[p.padding][0];
  return col(
    "footer",
    [
      ...(p.showBorder === "true"
        ? [
            {
              ...line("divider", width),
              layoutPositioning: "ABSOLUTE",
              x: h,
              y: 0,
            },
          ]
        : []),
      f(
        "actions",
        [action("cancel", "Cancel"), action("publish", "Publish", true)],
        { width, height: 36, primaryAlign: "MAX", gap: 8 },
      ),
    ],
    { padding: h, width: width + 2 * h, height: 36 + 2 * h },
  );
}
add(
  "Dialog",
  props({ padding: Object.keys(panelPads), rounded: [false, true] }, (p) =>
    surface(
      "dialog",
      [
        panelHeader("Dialog", {
          ...p,
          showCloseButton: "true",
          showBorder: "true",
        }),
        panelBody(p),
        panelFooter({ ...p, showBorder: "true" }),
      ],
      {
        width: Math.max(400, 368 + 2 * panelPads[p.padding][0]),
        radius: p.rounded === "true" ? 12 : 0,
        effectStyle: "shadow-default",
        bindings: {
          fills: S.surface,
          ...(p.rounded === "true"
            ? { cornerRadius: "border-radius-x-large" }
            : {}),
        },
      },
    ),
  ),
  {
    family: "Dialog",
    files: panelFiles("Dialog"),
    covered: [
      "Content.padding all five values",
      "Content.rounded boolean",
      "Header, Body and Footer source relative spacing",
      "Default fit sizing minWidth 400 source",
      "Default shadow token",
    ],
    limitations: [
      "Fit content specimen; fullscreen and verticalAlign are viewport-relative and require a canvas/screen container.",
      "SideContent and underlay are not included in this content-only set.",
    ],
  },
);
for (const family of ["Dialog", "Flyout"]) {
  add(
    `${family}.Header`,
    props(
      {
        padding: Object.keys(panelPads),
        showCloseButton: [false, true],
        showBorder: family === "Dialog" ? [false, true] : [true],
      },
      (p) => panelHeader(family, p),
    ),
    {
      family,
      files: panelFiles(family),
      covered: [
        "Header padding all source spacing values",
        "Header close button boolean",
        "Header border boolean",
      ],
      limitations:
        family === "Flyout"
          ? [
              "showBorder is derived design visibility; Flyout source always paints the Header divider.",
            ]
          : [],
    },
  );
  add(
    `${family}.Body`,
    props({ padding: Object.keys(panelPads) }, (p) => panelBody(p)),
    {
      family,
      files: panelFiles(family),
      covered: [
        "Body horizontal and vertical source padding",
        "16px body child gap",
      ],
      limitations: [
        "Scrollable regions and arbitrary children are consumer content.",
      ],
    },
  );
  add(
    `${family}.Footer`,
    props(
      {
        padding: Object.keys(panelPads),
        showBorder: family === "Dialog" ? [false, true] : [true],
      },
      (p) => panelFooter(p),
    ),
    {
      family,
      files: panelFiles(family),
      covered: [
        "Footer padding all source spacing values",
        "Actions right alignment and 8px gap",
      ],
      limitations:
        family === "Flyout"
          ? [
              "showBorder is derived design visibility; Flyout source always paints the Footer divider.",
            ]
          : [],
    },
  );
}
add(
  "Flyout",
  props(
    { padding: Object.keys(panelPads), rounded: ["none", "medium", "large"] },
    (p) =>
      surface(
        "flyout",
        [
          panelHeader("Flyout", {
            ...p,
            showCloseButton: "true",
            showBorder: "true",
          }),
          panelBody(p, 288),
          panelFooter({ ...p, showBorder: "true" }, 288),
        ],
        {
          width: Math.max(320, 288 + 2 * panelPads[p.padding][0]),
          radius: { none: 0, medium: 4, large: 8 }[p.rounded],
          effects: shadow("medium"),
          bindings: {
            fills: S.surface,
            strokes: S.subtle,
            ...(p.rounded !== "none"
              ? { cornerRadius: `border-radius-${p.rounded}` }
              : {}),
          },
        },
      ),
  ),
  {
    family: "Flyout",
    files: panelFiles("Flyout"),
    covered: [
      "Content.padding all values",
      "Content.rounded none/medium/large",
      "Default source shadow medium literal",
      "Header/body/footer compound layout",
    ],
    limitations: [
      "Content-only specimen. side/align/triggerOffset, viewport collision and mobile modal adaptation need screen-context placement.",
      "shadow none/medium are supplied in separate Surface set.",
    ],
  },
);
add(
  "Flyout.Surface",
  props(
    {
      shadow: ["none", "medium", "large"],
      rounded: ["none", "medium", "large"],
    },
    (p) =>
      surface("flyout", [t("content", "Flyout content")], {
        width: 320,
        padding: 16,
        radius: { none: 0, medium: 4, large: 8 }[p.rounded],
        effects: p.shadow === "none" ? [] : shadow(p.shadow),
        bindings: {
          fills: S.surface,
          strokes: S.subtle,
          ...(p.rounded !== "none"
            ? { cornerRadius: `border-radius-${p.rounded}` }
            : {}),
        },
      }),
  ),
  {
    family: "Flyout",
    files: panelFiles("Flyout"),
    covered: [
      "Content.shadow none/medium/large literal SCSS values",
      "Content.rounded all values",
    ],
    limitations: [
      "The 16px child padding is arbitrary editable content, not a claimed Root padding value.",
    ],
  },
);

// Dropdown: preserve actual danger/disabled states, shortcut and native icon slots.
function menuItem(p, id = "item", value = "Rename") {
  const disabled = p.disabled === "true",
    danger = p.emphasis === "danger",
    state = p.state;
  const color = disabled
    ? S.disabled
    : danger && state !== "default"
      ? "color-primary-on-primary"
      : danger
        ? "color-error-default"
        : S.text;
  return f(
    id,
    [
      icon("left-icon", danger ? "trash-bin" : "pen", 16, color),
      t("label", value, 14, color),
      t(
        "shortcut",
        "⌘ R",
        13,
        disabled
          ? S.disabled
          : danger && state !== "default"
            ? "color-primary-on-primary"
            : S.secondary,
      ),
    ],
    {
      width: 234,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 8,
      radius: 4,
      primaryAlign: "SPACE_BETWEEN",
      bindings:
        state === "default" || disabled
          ? {}
          : {
              fills: danger
                ? `color-error-${state === "active" ? "active" : "hover"}`
                : state === "active"
                  ? S.active
                  : S.hover,
            },
    },
  );
}
add(
  "Dropdown",
  props({ open: [false, true] }, (p) =>
    col(
      "dropdown",
      [
        action("trigger", "Actions"),
        ...(p.open === "true"
          ? [
              surface(
                "content",
                [
                  col(
                    "group",
                    [
                      t("heading", "ACTIONS", 12, S.secondary, true),
                      menuItem({
                        disabled: "false",
                        emphasis: "default",
                        state: "default",
                      }),
                      menuItem(
                        {
                          disabled: "false",
                          emphasis: "default",
                          state: "hover",
                        },
                        "duplicate",
                        "Duplicate",
                      ),
                    ],
                    { gap: 4 },
                  ),
                  line("separator", 250),
                  menuItem(
                    { disabled: "false", emphasis: "danger", state: "default" },
                    "delete",
                    "Delete",
                  ),
                ],
                {
                  width: 250,
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 8,
                  paddingRight: 8,
                  gap: 4,
                  effects: shadow("large"),
                },
              ),
            ]
          : []),
      ],
      { gap: 12 },
    ),
  ),
  {
    family: "Dropdown",
    files: ["Dropdown.tsx", "styles/dropdown.module.scss"],
    covered: [
      "Root.open boolean",
      "Content 250px source minimum width",
      "Group heading and separators",
      "Item default/hover/danger source visuals",
    ],
    limitations: [
      "Trigger is sample composition; submenu placement/RTL/collision and all slot combinations remain screen-dependent.",
    ],
  },
);
add(
  "Dropdown.Item",
  props(
    {
      emphasis: ["default", "danger"],
      disabled: [false, true],
      state: ["default", "hover", "active"],
    },
    (p) => menuItem(p),
  ),
  {
    family: "Dropdown",
    files: ["Dropdown.tsx", "styles/dropdown.module.scss"],
    covered: [
      "Item.emphasis default/danger",
      "Item.disabled boolean",
      "CSS hover/active states",
      "Left Slot and Shortcut primitives",
      "Source 8px vertical, 12px horizontal padding",
    ],
    limitations: [
      "state is CSS interaction state; arbitrary Item children/asChild content remain editable composition.",
    ],
  },
);
add(
  "Dropdown.SubTrigger",
  props({ state: ["default", "hover", "open"] }, (p) =>
    f("sub-trigger", [t("label", "Move to"), icon("chevron", "caret-right")], {
      width: 234,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12,
      gap: 8,
      primaryAlign: "SPACE_BETWEEN",
      radius: 4,
      bindings:
        p.state === "default"
          ? {}
          : {
              fills:
                p.state === "open"
                  ? "color-container-secondary-default"
                  : S.hover,
            },
    }),
  ),
  {
    family: "Dropdown",
    files: ["Dropdown.tsx", "styles/dropdown.module.scss"],
    covered: ["SubTrigger caret, spacing and CSS open/hover states"],
    limitations: [
      "SubContent uses the shared content layout; portal and RTL placement are runtime behavior.",
    ],
  },
);

// Select/Combobox roots: source status, disabled and actual exported Multiple/Combobox modes.
function selectRoot(p, mode = "single") {
  const disabled = p.disabled === "true";
  const c = disabled ? S.disabled : p.value === "" ? S.secondary : S.text;
  let children =
    mode === "multiple"
      ? [
          f(
            "badges",
            [
              f(
                "badge",
                [t("label", "Images", 13), icon("remove", "cross", 12)],
                {
                  padding: 4,
                  radius: 4,
                  gap: 4,
                  bindings: {
                    fills: "color-container-secondary-default",
                    cornerRadius: "border-radius-medium",
                  },
                },
              ),
            ],
            { gap: 4 },
          ),
        ]
      : [
          t(
            "value",
            p.value === ""
              ? mode === "combobox"
                ? "Search categories"
                : "Select a category"
              : "Brand assets",
            14,
            c,
          ),
        ];
  if (p.status !== "default")
    children.push(
      icon(
        "status",
        p.status === "error" ? "exclamation-mark-circle" : "check-mark-circle",
        16,
        `color-${p.status}-default`,
      ),
    );
  children.push(
    icon(
      "caret",
      "caret-down",
      16,
      disabled ? "color-container-disabled-on-disabled-container" : S.text,
    ),
  );
  return f("select", children, {
    width: 280,
    height: 36,
    paddingLeft: mode === "multiple" ? 8 : 12,
    paddingRight: 8,
    gap: 8,
    primaryAlign: "SPACE_BETWEEN",
    radius: 4,
    bindings: {
      fills: disabled ? "color-container-disabled-default" : S.surface,
      strokes: disabled
        ? S.subtle
        : p.status === "default"
          ? S.line
          : `color-${p.status}-default`,
      cornerRadius: "border-radius-medium",
    },
  });
}
const selectFiles = [
  "SelectSingle.tsx",
  "SelectMultiple.tsx",
  "ComboboxSingle.tsx",
  "ComboboxMultiple.tsx",
  "components/SelectItem.tsx",
  "styles/select.module.scss",
];
for (const [name, mode] of [
  ["Select", "single"],
  ["Select.Multiple", "multiple"],
  ["Select.Combobox", "combobox"],
])
  add(
    name,
    props(
      {
        disabled: [false, true],
        status: ["default", "success", "error"],
        value: ["", "brand-assets"],
      },
      (p) => selectRoot(p, mode),
    ),
    {
      family: "Select",
      files: selectFiles,
      covered: [
        "disabled boolean",
        "status default/success/error",
        "value empty/brand-assets sample values",
        "36px source field height and padding",
        mode === "multiple"
          ? "Multiple native badge and removal slot"
          : mode === "combobox"
            ? "Combobox native editable query text"
            : "Single selected value",
      ],
      limitations: [
        "value values are representative single selections; Multiple uses corresponding string-array values in React.",
        "Open list, loading/filtering, all arbitrary child/slot combinations and overflow badges need further composition.",
      ],
    },
  );
add(
  "Select.Item",
  props(
    {
      state: ["default", "highlighted", "active", "selected", "indeterminate"],
    },
    (p) =>
      f(
        "item",
        [
          t("label", "Brand assets"),
          ...(["selected", "indeterminate"].includes(p.state)
            ? [
                icon(
                  "indicator",
                  p.state === "selected" ? "check-mark" : "minus",
                ),
              ]
            : []),
        ],
        {
          width: 264,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 8,
          primaryAlign: "SPACE_BETWEEN",
          radius: 4,
          bindings:
            p.state === "default"
              ? {}
              : { fills: p.state === "highlighted" ? S.hover : S.active },
        },
      ),
  ),
  {
    family: "Select",
    files: selectFiles,
    covered: [
      "CSS highlighted/active states",
      "ARIA selected and indeterminate indicators",
      "Shared native check/minus icon assets",
      "Actual 8px/12px padding",
    ],
    limitations: [
      "state is derived from list selection; public Item props are value/label/children.",
    ],
  },
);
add(
  "Select.Group",
  props({ heading: ["true", "false"] }, (p) =>
    col(
      "group",
      [
        ...(p.heading === "true"
          ? [
              f("heading", [t("text", "RESOURCES", 12, S.secondary, true)], {
                paddingLeft: 20,
                paddingRight: 20,
                paddingTop: 12,
              }),
            ]
          : []),
        col(
          "options",
          ["Brand assets", "Documents"].map((label, i) =>
            f(`option-${i}`, [t("label", label)], {
              width: 264,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
            }),
          ),
          { gap: 4 },
        ),
      ],
      { gap: 8 },
    ),
  ),
  {
    family: "Select",
    files: selectFiles,
    covered: ["Group optional heading typography and source padding"],
    limitations: [
      "Item text is editable composition; groupId and callback semantics remain runtime.",
    ],
  },
);

// Table: replace invented density with real fontSize and selected row props.
const align = (p) => ({ left: "MIN", center: "CENTER", right: "MAX" })[p];
function cell(id, value, p = {}) {
  return f(
    id,
    [
      t(
        "value",
        value,
        p.fontSize === "small" ? 12 : 13,
        p.header ? S.secondary : S.text,
      ),
    ],
    {
      width: p.width ?? 160,
      paddingTop: p.header ? 12 : 8,
      paddingBottom: p.header ? 12 : 8,
      paddingLeft: 8,
      paddingRight: 8,
      primaryAlign: align(p.align ?? "left"),
    },
  );
}
function tableRow(
  p,
  id = "row",
  values = ["Brand guidelines", "Document", "Today"],
) {
  return col(
    id,
    [
      f(
        "cells",
        values.map((value, i) => cell(`cell-${i}`, value, p)),
        {
          opacity: p.disabled === "true" ? 0.6 : 1,
          bindings:
            p.selected === "true"
              ? { fills: "color-container-highlight-default" }
              : {},
        },
      ),
      line("bottom-border", 480),
    ],
    { gap: 0 },
  );
}
add(
  "Table",
  props({ fontSize: ["small", "medium"], noBorder: [false, true] }, (p) =>
    col("table", [
      ...(p.noBorder === "false" ? [line("top-border", 480)] : []),
      f(
        "header",
        ["Name", "Type", "Modified"].map((value, i) =>
          cell(`head-${i}`, value, { ...p, header: true }),
        ),
      ),
      line("header-border", 480),
      ...["Brand guidelines", "Logo collection", "Campaign assets"].map(
        (name, i) =>
          tableRow({ ...p, selected: "false", disabled: "false" }, `row-${i}`, [
            name,
            i === 0 ? "Document" : "Collection",
            "Today",
          ]),
      ),
    ]),
  ),
  {
    family: "Table",
    files: ["Table.tsx", "styles/table.module.scss"],
    covered: [
      "Root.fontSize small/medium",
      "Root.noBorder boolean outer border suppression",
      "Header source 13px text / 12px vertical padding",
      "Row source 8px base padding and 16px line height",
    ],
    limitations: [
      "layout auto/fixed use fixed sample column widths. gutter, colSpan, sticky positions and responsive truncation require consumer width constraints.",
    ],
  },
);
add(
  "Table.Row",
  props(
    {
      selected: [false, true],
      disabled: [false, true],
      fontSize: ["small", "medium"],
    },
    (p) => tableRow(p),
  ),
  {
    family: "Table",
    files: ["Table.tsx", "styles/table.module.scss"],
    covered: [
      "Row.selected highlight surface",
      "Row.disabled source opacity .6",
      "Root inherited fontSize small/medium",
    ],
    limitations: [
      "fontSize belongs to Root and is included here as inherited context. onClick/keyboard selection remain runtime.",
    ],
  },
);
add(
  "Table.HeaderCell",
  props(
    {
      sortDirection: ["none", "ascending", "descending"],
      state: ["idle", "loading"],
      align: ["left", "center", "right"],
    },
    (p) =>
      col("header-cell", [
        line("top-border", 160),
        f(
          "contents",
          [
            t(
              "label",
              "Name",
              13,
              p.sortDirection === "none" ? S.secondary : S.text,
            ),
            icon(
              "indicator",
              p.state === "loading"
                ? "arrow-spin-right"
                : p.sortDirection === "ascending"
                  ? "arrow-up"
                  : p.sortDirection === "descending"
                    ? "arrow-down"
                    : "arrow-bidirectional",
              12,
              S.secondary,
            ),
          ],
          {
            width: 160,
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 8,
            paddingRight: 8,
            gap: 4,
            primaryAlign: align(p.align),
          },
        ),
        line("bottom-border", 160),
      ]),
  ),
  {
    family: "Table",
    files: ["Table.tsx", "styles/table.module.scss"],
    covered: [
      "HeaderCell.sortDirection ascending/descending and undefined",
      "HeaderCell.state idle/loading",
      "HeaderCell.align all three values",
      "12px sort icon source",
      "13px source header typography",
    ],
    limitations: [
      "none represents undefined sortDirection. Loading uses a static native circular-arrow specimen; actual LoadingCircle animation is runtime.",
      "Sortable trigger semantics need onSortChange in React.",
    ],
  },
);
add(
  "Table.RowCell",
  props(
    { align: ["left", "center", "right"], fontSize: ["small", "medium"] },
    (p) =>
      col("cell", [
        cell("content", "Cell content", p),
        line("bottom-border", 160),
      ]),
  ),
  {
    family: "Table",
    files: ["Table.tsx", "styles/table.module.scss"],
    covered: [
      "Cell align left/center/right",
      "Root inherited fontSize",
      "Source row cell padding and bottom line",
    ],
    limitations: [
      "colSpan, widths, truncation and gutter are contextual layout constraints.",
    ],
  },
);

// Tabs default and pill have different typography and spacing in the source.
function tabTrigger(p, id = "trigger", label = "Overview") {
  const active = p.activeTab === "overview",
    disabled = p.disabled === "true",
    pill = p.variant === "pill";
  return col(
    id,
    [
      f(
        "label",
        [
          t(
            "text",
            label,
            pill ? 13 : 16,
            disabled ? S.disabled : active ? S.text : S.secondary,
            pill || active,
          ),
        ],
        {
          height: pill ? 24 : (p.size === "large" ? 56 : 48) - 3,
          paddingLeft: pill ? 8 : 8,
          paddingRight: pill ? 8 : 8,
          radius: pill ? 4 : 0,
          bindings:
            pill && active
              ? {
                  fills: "color-container-secondary-default",
                  cornerRadius: "border-radius-medium",
                }
              : {},
        },
      ),
      ...(!pill
        ? [box("active-indicator", 100, 3, active ? S.text : S.surface, 0)]
        : []),
    ],
    { gap: 0 },
  );
}
add(
  "Tabs",
  props(
    {
      variant: ["default", "pill"],
      size: ["medium", "large"],
      activeTab: ["overview", "assets"],
      padding: ["none", "comfortable"],
    },
    (p) =>
      col(
        "tabs",
        [
          f(
            "tab-list",
            [
              tabTrigger({ ...p, disabled: "false" }),
              tabTrigger(
                {
                  ...p,
                  activeTab: p.activeTab === "assets" ? "overview" : "assets",
                  disabled: "false",
                },
                "assets",
                "Assets",
              ),
            ],
            {
              padding: p.variant === "pill" ? 12 : 4,
              gap: p.variant === "pill" ? 4 : 8,
            },
          ),
          line("divider", 340),
          col(
            "content",
            [
              t(
                "content",
                p.activeTab === "overview"
                  ? "Collection overview"
                  : "Approved assets",
              ),
            ],
            { padding: p.padding === "none" ? 0 : 16 },
          ),
        ],
        { width: 340 },
      ),
  ),
  {
    family: "Tabs",
    files: ["Tabs.tsx", "styles/tabs.module.scss"],
    covered: [
      "Root.variant default/pill",
      "Root.size medium/large",
      "Root.activeTab sample strings",
      "Root.padding none/comfortable",
      "Default 48/56px trigger list and 3px indicator",
      "Pill source 13px typography, 4/8 padding",
    ],
    limitations: [
      "withDivider variants and tight/compact/spacious padding are supplied as separate Content parts or remain consumer composition.",
      "Overflow trigger list scrolling and cross-fade transition are runtime behavior.",
    ],
  },
);
add(
  "Tabs.Trigger",
  props(
    {
      variant: ["default", "pill"],
      size: ["medium", "large"],
      activeTab: ["overview", ""],
      disabled: [false, true],
    },
    (p) => tabTrigger(p),
  ),
  {
    family: "Tabs",
    files: ["Tabs.tsx", "styles/tabs.module.scss"],
    covered: [
      "Root variant/size inherited context",
      "Tab.disabled boolean",
      "Active/inactive source styling",
    ],
    limitations: [
      "variant/size/activeTab belong to Root; this reusable set exposes inherited context for composition.",
    ],
  },
);
add(
  "Tabs.Content",
  props(
    { padding: ["none", "tight", "compact", "comfortable", "spacious"] },
    (p) =>
      col("content", [t("body", "Tab content")], {
        width: 320,
        padding: {
          none: 0,
          tight: 8,
          compact: 12,
          comfortable: 16,
          spacious: 24,
        }[p.padding],
      }),
  ),
  {
    family: "Tabs",
    files: ["Tabs.tsx", "styles/tabs.module.scss"],
    covered: ["Root padding all five source values"],
    limitations: [
      "padding is inherited from Root; arbitrary content and withDivider flex overflow are contextual.",
    ],
  },
);

// Tree rows: actual isSelected/isExpanded/isDisabled and Root multiSelect/reorderable.
function checkbox(id, value) {
  return f(
    id,
    value === "false"
      ? []
      : [
          icon(
            "indicator",
            value === "indeterminate" ? "minus" : "check-mark",
            12,
            "color-primary-on-primary",
          ),
        ],
    {
      width: 16,
      height: 16,
      primaryAlign: "CENTER",
      radius: 4,
      bindings: {
        fills: value === "false" ? S.surface : S.text,
        strokes: value === "false" ? S.line : S.text,
        cornerRadius: "border-radius-medium",
      },
    },
  );
}
function treeRow(
  p,
  id = "row",
  name = "Brand assets",
  folder = true,
  level = 0,
) {
  const disabled = p.isDisabled === "true",
    selected = p.isSelected === "true",
    color = disabled ? S.disabled : S.text;
  return f(
    id,
    [
      ...(p.reorderable === "true"
        ? [
            icon(
              "drag-handle",
              "grab-handle",
              16,
              disabled ? S.disabled : S.secondary,
            ),
          ]
        : []),
      f("indent", [], { width: level * 16 + 4, height: 1 }),
      ...(p.multiSelect === "true" ? [checkbox("checkbox", p.isSelected)] : []),
      ...(folder
        ? [
            icon(
              "caret",
              p.isExpanded === "true" ? "caret-down" : "caret-right",
              16,
              color,
            ),
          ]
        : [f("caret-space", [], { width: 16, height: 16 })]),
      icon("icon", folder ? "folder" : "document", 18, color),
      p.isRenaming === "true"
        ? {
            ...field("rename-input", name, disabled, 160),
            height: 24,
            paddingLeft: 4,
            paddingRight: 4,
          }
        : t("label", name, 13, color),
      icon("actions", "dots-horizontal", 16, color),
    ],
    {
      width: 360,
      height: 32,
      gap: 4,
      paddingLeft: 8,
      paddingRight: 8,
      radius: 4,
      strokeWeight: 2,
      bindings: {
        fills: selected ? S.active : S.surface,
        cornerRadius: "border-radius-medium",
      },
    },
  );
}
const treeFiles = [
  "Tree.ts",
  "types.ts",
  "constants.ts",
  "components/TreeRoot.tsx",
  "components/TreeRow.tsx",
  "styles/tree.module.scss",
];
add(
  "Tree",
  props(
    {
      multiSelect: [false, true],
      reorderable: [false, true],
      isExpanded: [false, true],
    },
    (p) =>
      col(
        "tree",
        [
          treeRow({
            ...p,
            isSelected: p.multiSelect === "true" ? "indeterminate" : "false",
            isDisabled: "false",
            isRenaming: "false",
          }),
          ...(p.isExpanded === "true"
            ? [
                treeRow(
                  {
                    ...p,
                    isSelected: "true",
                    isDisabled: "false",
                    isRenaming: "false",
                  },
                  "first-child",
                  "Logos",
                  false,
                  1,
                ),
                treeRow(
                  {
                    ...p,
                    isSelected: "false",
                    isDisabled: "false",
                    isRenaming: "false",
                  },
                  "second-child",
                  "Photography",
                  false,
                  1,
                ),
              ]
            : []),
        ],
        { gap: 2, width: 360 },
      ),
  ),
  {
    family: "Tree",
    files: treeFiles,
    covered: [
      "Root.multiSelect and reorderable booleans",
      "Folder.isExpanded boolean",
      "Native folder/item rows and selection checkboxes",
      "32px item height,16px depth indent+4px base",
      "Source selected surface-active and 13px label typography",
    ],
    limitations: [
      "isExpanded belongs to Folder; root sample preserves hierarchy.",
      "Headless-tree event/state controller, dragline placement and async expansion are runtime behavior.",
    ],
  },
);
add(
  "Tree.Item",
  props(
    {
      isSelected: ["false", "true", "indeterminate"],
      isDisabled: [false, true],
      isRenaming: [false, true],
    },
    (p) =>
      treeRow(
        { ...p, multiSelect: "true", reorderable: "false" },
        "item",
        "Brand guidelines",
        false,
      ),
  ),
  {
    family: "Tree",
    files: treeFiles,
    covered: [
      "Item.isSelected false/true/indeterminate",
      "Item.isDisabled boolean",
      "Item.isRenaming boolean",
      "Native checkbox and source 24px rename input scale",
    ],
    limitations: [
      "Rename sample uses editable text; confirmation and automatic focus remain runtime.",
    ],
  },
);
add(
  "Tree.Folder",
  props(
    {
      isExpanded: [false, true],
      isSelected: ["false", "true", "indeterminate"],
      isDisabled: [false, true],
    },
    (p) =>
      treeRow({
        ...p,
        multiSelect: "true",
        reorderable: "false",
        isRenaming: "false",
      }),
  ),
  {
    family: "Tree",
    files: treeFiles,
    covered: [
      "Folder.isExpanded",
      "Folder.isSelected all states",
      "Folder.isDisabled",
      "Caret and folder slots",
    ],
    limitations: [
      "Selection cascade is represented visually; actual descendants derive state in React.",
    ],
  },
);

// OrderableList: expose actual Root direction/spacing, Item padding/selected/disabled.
function orderItem(p, id = "item", name = "Brand identity") {
  const disabled = p.disabled === "true";
  return surface(
    id,
    [
      f(
        "content",
        [
          icon("decorator", "document", 24),
          col(
            "labels",
            [
              t("title", name, 13, S.text, true),
              t("description", "Keep approved resources organized", 13),
            ],
            { gap: 0 },
          ),
        ],
        {
          paddingLeft: p.padding === "small" ? 12 : 0,
          paddingRight: p.padding === "small" ? 12 : 0,
          paddingTop: p.padding === "small" ? 8 : 0,
          paddingBottom: p.padding === "small" ? 8 : 0,
          gap: 12,
          opacity: disabled ? 0.5 : 1,
        },
      ),
      f("drag-handle", [icon("handle", "grab-handle")], {
        width: 20,
        height: 24,
        primaryAlign: "CENTER",
        opacity: disabled ? 0.5 : 1,
      }),
    ],
    {
      layout: "HORIZONTAL",
      width: 340,
      radius: 4,
      bindings: {
        fills: p.selected === "true" ? S.dim : S.surface,
        strokes: p.selected === "true" ? S.strong : S.subtle,
        cornerRadius: "border-radius-medium",
      },
    },
  );
}
const orderFiles = [
  "OrderableList.tsx",
  "OrderableListItem.tsx",
  "OrderableListItemDragHandle.tsx",
  "styles/orderable-list.module.scss",
];
add(
  "OrderableList",
  props(
    {
      spacing: ["tight", "compact", "comfortable"],
      direction: ["vertical", "horizontal"],
    },
    (p) =>
      f(
        "list",
        ["Brand identity", "Photography", "Typography"].map((v, i) =>
          orderItem(
            { padding: "small", selected: "false", disabled: "false" },
            `item-${i}`,
            v,
          ),
        ),
        {
          layout: p.direction === "vertical" ? "VERTICAL" : "HORIZONTAL",
          gap: { tight: 8, compact: 12, comfortable: 16 }[p.spacing],
          bindings: {
            itemSpacing: `spacing-${{ tight: "x-small", compact: "small", comfortable: "medium" }[p.spacing]}`,
          },
        },
      ),
  ),
  {
    family: "OrderableList",
    files: orderFiles,
    covered: [
      "Root.spacing tight/compact/comfortable",
      "Root.direction vertical/horizontal",
      "Item native decorator,title,description,drag handle composition",
    ],
    limitations: [
      "Order array is a sample; drag/drop events and keyboard announcements remain React behavior.",
    ],
  },
);
add(
  "OrderableList.Item",
  props(
    {
      padding: ["none", "small"],
      selected: [false, true],
      disabled: [false, true],
    },
    (p) => orderItem(p),
  ),
  {
    family: "OrderableList",
    files: orderFiles,
    covered: [
      "Item.padding none/small",
      "Item.selected boolean",
      "Item.disabled source .5 content opacity",
      "Native reusable drag handle slot",
    ],
    limitations: [
      "Hover, dropping, dragging shadows and arbitrary ItemAction combinations are not all enumerated.",
    ],
  },
);

// AssetInput is an asset-selector control, not the previous invented generic dropzone.
const assetFiles = [
  "AssetInput.tsx",
  "AssetInputRoot.tsx",
  "AssetInputPlaceholder.tsx",
  "AssetInputPreview.tsx",
  "AssetInputMetadataItem.tsx",
  "styles/asset-input.module.scss",
];
function assetRoot(p) {
  const vertical = p.orientation === "vertical";
  const preview = f(
    "preview",
    [icon("asset-icon", "document", vertical ? 32 : 24, S.secondary)],
    {
      width: vertical ? 280 : 56,
      height: vertical ? 128 : 56,
      primaryAlign: "CENTER",
      bindings: { fills: S.dim, strokes: S.line },
    },
  );
  const meta = f(
    "metadata",
    [
      t("type", "PDF", 12, S.secondary),
      box("dot", 4, 4, "color-container-secondary-default", 2),
      t("size", "1.2 MB", 12, S.secondary),
    ],
    { gap: 4 },
  );
  const content = f(
    "content",
    [
      col("labels", [t("title", "Brand guidelines.pdf"), meta], { gap: 0 }),
      icon(
        "caret",
        p.isOpen === "true" ? "caret-up" : "caret-down",
        16,
        S.secondary,
      ),
    ],
    {
      width: vertical ? 280 : 304,
      paddingLeft: 16,
      paddingRight: 16,
      height: 56,
      gap: 16,
      primaryAlign: "SPACE_BETWEEN",
    },
  );
  return surface("asset-input", [preview, content], {
    layout: vertical ? "VERTICAL" : "HORIZONTAL",
    width: vertical ? 280 : 360,
    radius: 4,
    bindings: {
      fills: S.surface,
      strokes: p.isOpen === "true" ? S.strong : S.line,
      cornerRadius: "border-radius-medium",
    },
  });
}
add(
  "AssetInput",
  props(
    { orientation: ["horizontal", "vertical"], isOpen: [false, true] },
    (p) => assetRoot(p),
  ),
  {
    family: "AssetInput",
    files: assetFiles,
    covered: [
      "Root.orientation horizontal/vertical",
      "Root.isOpen boolean caret/border state",
      "Source single preview 56px horizontal,128px vertical",
      "Title+metadata source slots and separator dots",
    ],
    limitations: [
      "Preview uses native document icon slot; arbitrary image URLs, multiple-preview grids and PreviewLoading still need content-specific recipes.",
    ],
  },
);
add(
  "AssetInput.Placeholder",
  props({ children: ["upload", "browse", "upload+browse"] }, (p) =>
    surface(
      "placeholder",
      [
        f(
          "actions",
          [
            ...(p.children.includes("upload")
              ? [
                  f(
                    "upload",
                    [icon("icon", "cloud-arrow-up"), t("label", "Upload")],
                    { padding: 12, gap: 8 },
                  ),
                ]
              : []),
            ...(p.children === "upload+browse"
              ? [box("separator", 1, 36, S.subtle)]
              : []),
            ...(p.children.includes("browse")
              ? [
                  f("browse", [icon("icon", "folder"), t("label", "Browse")], {
                    padding: 12,
                    gap: 8,
                  }),
                ]
              : []),
          ],
          { gap: 4 },
        ),
      ],
      { width: 280 },
    ),
  ),
  {
    family: "AssetInput",
    files: assetFiles,
    covered: [
      "Placeholder one/two child action composition",
      "Upload precedes Browse per source order",
      "Native action icons and separator",
    ],
    limitations: [
      "children labels are native composition choices, not React string values. Dashed border is approximated with solid native stroke until per-dash schema support exists.",
    ],
  },
);

// DatePicker Root is the calendar; Input is independently exported.
const dateFiles = [
  "DatePicker.ts",
  "SingleDatePicker.tsx",
  "RangeDatePicker.tsx",
  "DatePickerCalendar.tsx",
  "DatePickerInput.tsx",
  "styles/datePickerCalendar.module.scss",
  "styles/datePickerInput.module.scss",
];
function dayCell(
  day,
  {
    selected = false,
    range = false,
    today = false,
    disabled = false,
    outside = false,
  } = {},
) {
  return f(
    `day-${day}`,
    [
      f(
        "content",
        [
          t(
            "number",
            String(day),
            14,
            disabled
              ? "color-container-disabled-on-disabled-container"
              : selected
                ? "color-container-highlight-on-highlight-container"
                : outside
                  ? S.secondary
                  : S.text,
            today,
          ),
        ],
        {
          width: 32,
          height: 32,
          primaryAlign: "CENTER",
          radius: 8,
          bindings: {
            ...(selected
              ? {
                  fills: range
                    ? "color-container-highlight-default"
                    : "color-container-highlight-active",
                }
              : disabled
                ? { fills: "color-container-disabled-default" }
                : {}),
            cornerRadius: "border-radius-large",
          },
        },
      ),
      ...(today
        ? [
            {
              ...box(
                "today-mark",
                8,
                2,
                selected
                  ? "color-container-highlight-on-highlight-container"
                  : S.text,
                2,
              ),
              layoutPositioning: "ABSOLUTE",
              x: 14,
              y: 28,
            },
          ]
        : []),
    ],
    { width: 36, height: 36, primaryAlign: "CENTER", counterAlign: "CENTER" },
  );
}
function calendar(selected, range = false) {
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 3,
      outside = day < 1 || day > 31;
    const actual = day < 1 ? 30 + day : day > 31 ? day - 31 : day;
    return dayCell(actual, {
      selected: range ? day >= 20 && day <= 24 : day === 30 && !!selected,
      range,
      today: day === 30,
      outside,
    });
  });
  return col(
    "calendar",
    [
      f(
        "caption",
        [
          icon("previous", "caret-left"),
          t("month", "October 2026", 16, S.text, true),
          icon("next", "caret-right"),
        ],
        { width: 252, height: 24, primaryAlign: "SPACE_BETWEEN" },
      ),
      f(
        "weekdays",
        ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((v, i) =>
          f(`weekday-${i}`, [t("label", v, 13, S.secondary)], {
            width: 36,
            height: 24,
            primaryAlign: "CENTER",
          }),
        ),
        { height: 36, paddingTop: 8, paddingBottom: 4 },
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        f(`week-${i}`, cells.slice(i * 7, (i + 1) * 7)),
      ),
    ],
    { width: 252, paddingTop: 8 },
  );
}
add(
  "DatePicker",
  props({ selected: ["", "2026-10-30"] }, (p) => calendar(p.selected)),
  {
    family: "DatePicker",
    files: dateFiles,
    covered: [
      "Root.selected empty/ISO date sample",
      "Correct October 2026 weekday offset",
      "Source 36px day and 32px content,8px radius",
      "Source caption/month nav and weekday typography",
      "Today marker and native selected semantic fill",
    ],
    limitations: [
      "Source calendar locale is ThemeProvider-dependent; this specimen uses English Sunday-first month.",
      "Date arithmetic, minMonth/maxMonth navigation constraints, disabledDates and locale/RTL remain runtime or contextual variants.",
    ],
  },
);
add(
  "DatePicker.Range",
  props({ selected: ["", "2026-10-20..2026-10-24"] }, (p) =>
    calendar(p.selected, Boolean(p.selected)),
  ),
  {
    family: "DatePicker",
    files: dateFiles,
    covered: [
      "Range selection sample with source highlight tokens",
      "Separate native day parts enable editable date compositions",
    ],
    limitations: [
      "selected is serialized sample range notation for design only; runtime API takes a DatePickerDateRange.",
      "Source joined middle/start/end per-corner radii are not fully reproduced by the current symmetric radius schema.",
    ],
  },
);
add(
  "DatePicker.Input",
  props(
    {
      disabled: [false, true],
      isOpen: [false, true],
      selected: ["", "2026-10-30"],
    },
    (p) =>
      f(
        "date-input",
        [
          icon(
            "calendar",
            "calendar",
            16,
            p.disabled === "true"
              ? "color-container-disabled-on-disabled-container"
              : S.text,
          ),
          t(
            "date",
            p.selected ? "Oct 30, 2026" : "Select a date",
            14,
            p.disabled === "true"
              ? "color-container-disabled-on-disabled-container"
              : S.text,
          ),
          ...(p.selected ? [icon("clear", "cross", 16, S.secondary)] : []),
          icon("caret", p.isOpen === "true" ? "caret-up" : "caret-down"),
        ],
        {
          width: 280,
          height: 36,
          paddingLeft: 12,
          paddingRight: 12,
          gap: 8,
          radius: 4,
          primaryAlign: "SPACE_BETWEEN",
          bindings: {
            fills:
              p.disabled === "true"
                ? "color-container-disabled-default"
                : S.surface,
            strokes:
              p.disabled === "true"
                ? S.subtle
                : p.isOpen === "true"
                  ? S.strong
                  : S.line,
            cornerRadius: "border-radius-medium",
          },
        },
      ),
  ),
  {
    family: "DatePicker",
    files: dateFiles,
    covered: [
      "Input.disabled boolean",
      "Input.isOpen boolean",
      "Input.selected empty/ISO sample",
      "36px source field height,12px inline padding and8px gap",
      "Native calendar/clear/caret slots",
    ],
    limitations: [
      "Formatting is English sample; clear/change callbacks remain runtime.",
    ],
  },
);
add(
  "DatePicker.Day",
  props(
    { state: ["default", "selected", "disabled", "outside", "today"] },
    (p) =>
      dayCell(30, {
        selected: p.state === "selected",
        disabled: p.state === "disabled",
        outside: p.state === "outside",
        today: p.state === "today",
      }),
  ),
  {
    family: "DatePicker",
    files: dateFiles,
    covered: [
      "Source native day default/selected/disabled/outside/today visual states",
    ],
    limitations: [
      "Reusable design primitive corresponds to internal calendar day renderer, not a separate public export.",
    ],
  },
);

// ColorPicker uses its actual HEX/RGBA formats and independent Input/Values/Gradient parts.
const colorFiles = [
  "ColorPicker.tsx",
  "ColorPickerInput.tsx",
  "ColorValueInput.tsx",
  "ColorGradientInput.tsx",
  "types.ts",
  "styles/customColorPicker.module.scss",
  "styles/colorInput.module.scss",
];
function colorValues(p) {
  const format = f(
    "format",
    [t("value", p.currentFormat, 14), icon("caret", "caret-down")],
    {
      width: 100,
      height: 36,
      paddingLeft: 12,
      paddingRight: 8,
      gap: 8,
      radius: 4,
      primaryAlign: "SPACE_BETWEEN",
      bindings: {
        strokes: S.line,
        fills: S.surface,
        cornerRadius: "border-radius-medium",
      },
    },
  );
  const channels =
    p.currentFormat === "HEX"
      ? [field("hex", "# FF0000", false, 180)]
      : [
          field("red", "R 255", false, 68),
          field("green", "G 0", false, 68),
          field("blue", "B 0", false, 68),
        ];
  return f(
    "values",
    [format, ...channels, field("alpha", "A 100 %", false, 100)],
    { gap: 8 },
  );
}
function gradient() {
  return col(
    "gradient",
    [
      {
        id: "saturation",
        kind: "svg",
        name: "Saturation and value",
        width: 280,
        height: 140,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="140" viewBox="0 0 280 140"><defs><linearGradient id="s"><stop stop-color="#fff"/><stop offset="1" stop-color="#f00"/></linearGradient><linearGradient id="v" x2="0" y2="1"><stop stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="280" height="140" fill="url(#s)"/><rect width="280" height="140" fill="url(#v)"/><circle cx="265" cy="15" r="8" stroke="#fff" stroke-width="3" fill="#f00"/></svg>',
      },
      {
        id: "hue",
        kind: "svg",
        name: "Hue slider",
        width: 280,
        height: 16,
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="16"><defs><linearGradient id="h"><stop stop-color="red"/><stop offset=".1667" stop-color="#ff0"/><stop offset=".3333" stop-color="#0f0"/><stop offset=".5" stop-color="#0ff"/><stop offset=".6667" stop-color="#00f"/><stop offset=".8333" stop-color="#f0f"/><stop offset="1" stop-color="red"/></linearGradient></defs><rect width="280" height="16" fill="url(#h)"/></svg>',
      },
      f("alpha", [box("track", 280, 16, "color-error-default", 8)], {
        width: 280,
        height: 16,
      }),
    ],
    { gap: 8 },
  );
}
add(
  "ColorPicker",
  props({ currentFormat: ["HEX", "RGBA"] }, (p) =>
    col("color-picker", [gradient(), colorValues(p)], { gap: 16 }),
  ),
  {
    family: "ColorPicker",
    files: colorFiles,
    covered: [
      "Root.currentFormat exact HEX/RGBA union",
      "Gradient plus Values compound composition",
      "Source 16px root gap and8px input gaps",
      "Native HEX/channel/alpha/format controls",
    ],
    limitations: [
      "react-colorful dependency default geometry is represented as a red-color specimen; dynamic color-coordinate conversion and checkerboard alpha remain partial.",
      "Responsive value-input wrap below312px is not represented by these desktop compositions.",
    ],
  },
);
add(
  "ColorPicker.Values",
  props({ currentFormat: ["HEX", "RGBA"] }, (p) => colorValues(p)),
  {
    family: "ColorPicker",
    files: colorFiles,
    covered: [
      "Values.currentFormat exact source formats",
      "HEX field and RGBA channel fields",
      "100px format/alpha source desktop columns",
      "Alpha percent decorators",
    ],
    limitations: [
      "Input validation, number limits and responsive wrapping remain runtime behavior.",
    ],
  },
);
add(
  "ColorPicker.Input",
  props(
    {
      disabled: [false, true],
      isOpen: [false, true],
      currentColor: ["empty", "red"],
    },
    (p) =>
      f(
        "color-input",
        [
          box(
            "swatch",
            16,
            16,
            p.currentColor === "red" ? "color-error-default" : S.surface,
            4,
          ),
          t(
            "color-name",
            p.currentColor === "red" ? "RGBA(255, 0, 0, 1)" : "Select a color",
            14,
            p.disabled === "true" ? S.disabled : S.text,
          ),
          ...(p.currentColor === "red"
            ? [icon("clear", "cross", 16, S.secondary)]
            : []),
          icon("caret", p.isOpen === "true" ? "caret-up" : "caret-down"),
        ],
        {
          width: 320,
          height: 36,
          paddingLeft: 12,
          paddingRight: 12,
          gap: 8,
          radius: 4,
          primaryAlign: "SPACE_BETWEEN",
          bindings: {
            fills:
              p.disabled === "true"
                ? "color-container-disabled-default"
                : S.surface,
            strokes:
              p.disabled === "true"
                ? S.subtle
                : p.isOpen === "true"
                  ? S.strong
                  : S.line,
            cornerRadius: "border-radius-medium",
          },
        },
      ),
  ),
  {
    family: "ColorPicker",
    files: colorFiles,
    covered: [
      "Input.disabled and isOpen booleans",
      "Input empty/populated visual state",
      "16px source color indicator and36px field height",
      "Clear/caret native slots",
    ],
    limitations: [
      "currentColor strings are design specimens of RgbaColor object values; arbitrary color value binding needs exporter mapping.",
    ],
  },
);

// Tooltip: both source padding values and correct side-specific native arrow.
function tooltip(p) {
  const compact = p.padding === "compact",
    w = 112,
    v = compact ? 4 : 8,
    h = compact ? 8 : 12;
  const body = surface(
    "content",
    [
      {
        ...t("content", "Copy link", 14, "color-primary-on-primary"),
        lineHeight: 20,
      },
    ],
    {
      width: w,
      paddingTop: v,
      paddingBottom: v,
      paddingLeft: h,
      paddingRight: h,
      radius: 4,
      bindings: {
        fills: S.text,
        strokes: S.strong,
        cornerRadius: "border-radius-medium",
      },
    },
  );
  const triangles = {
    top: "0,0 10,0 5,5",
    bottom: "0,5 10,5 5,0",
    left: "0,0 0,10 5,5",
    right: "5,0 5,10 0,5",
  };
  const vertical = ["top", "bottom"].includes(p.side);
  const arrow = {
    id: "arrow",
    kind: "svg",
    name: "Tooltip arrow",
    width: vertical ? 10 : 5,
    height: vertical ? 5 : 10,
    iconColor: S.text,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${vertical ? 10 : 5}" height="${vertical ? 5 : 10}"><polygon points="${triangles[p.side]}" fill="#202020"/></svg>`,
  };
  return f(
    "tooltip",
    ["bottom", "right"].includes(p.side) ? [arrow, body] : [body, arrow],
    {
      layout: vertical ? "VERTICAL" : "HORIZONTAL",
      gap: 0,
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
    },
  );
}
add(
  "Tooltip",
  props(
    {
      padding: ["compact", "spacious"],
      side: ["top", "right", "bottom", "left"],
    },
    (p) => tooltip(p),
  ),
  {
    family: "Tooltip",
    files: ["Tooltip.tsx", "styles/tooltip.module.scss"],
    covered: [
      "Content.padding compact/spacious actual vertical4/8 horizontal8/12",
      "Content.side all four values with native triangle arrow",
      "Source14px/20px tooltip utility typography",
      "Semantic fill/text/border bindings",
    ],
    limitations: [
      "Content-only set; Root delay/open state and viewport collision do not affect intrinsic appearance.",
      "Arrow drop-shadow outline and maxWidth/custom children wrapping need native visual QA.",
    ],
  },
);

// Charts: actual public property names and source-native legends. Data is a
// named deterministic fixture; we do not claim native layers implement d3 scales.
const chartColors = [
  "color-charts-primary-default",
  "color-charts-secondary-default",
  "color-charts-tertiary-default",
];
const chartHover = [
  "color-charts-primary-hover",
  "color-charts-secondary-hover",
  "color-charts-tertiary-hover",
];
const chartBase = "packages/charts/src/";
function addChart(
  name,
  variants,
  {
    family = name.split(".")[0],
    covered = [],
    limitations = [],
    files = [
      `components/${family}/${family}.tsx`,
      `components/${family}/${family}.module.scss`,
    ],
  } = {},
) {
  const source = [
    ...files,
    "index.scss",
    "theme/consts.ts",
    "components/common/helpers/accessors.ts",
    "utilities/text.module.scss",
  ].map((p) => chartBase + p);
  const r = {
    id: `charts/${name}`,
    name: name.replaceAll(".", "/"),
    package: "@frontify/fondue/charts",
    source,
    status: "partial",
    limitations: [
      ...limitations,
      "Static native chart fixtures preserve editable geometry; arbitrary data, d3/visx scale calculation, label measurement, viewport resizing and pointer tooltips remain runtime behavior.",
      "Source styling and finite states require native Figma visual acceptance.",
    ],
    variants,
  };
  recipes.push(r);
  evidence.push({
    id: r.id,
    source,
    covered,
    variantCount: variants.length,
    limitations: r.limitations,
  });
}
function chartLegend(
  style = "rectangle",
  names = ["Images", "Documents", "Video"],
) {
  const dims = {
    line: [48, 2, 0],
    rectangle: [48, 12, 0],
    circle: [12, 12, 9999],
    square: [12, 12, 1],
  }[style];
  return f(
    "legend",
    names.map((name, i) =>
      f(
        `item-${i}`,
        [
          box("color", ...dims.slice(0, 2), chartColors[i % 3], dims[2]),
          t("name", name, 13),
        ],
        { gap: 8 },
      ),
    ),
    { gap: 24, bindings: { itemSpacing: "spacing-large" } },
  );
}
addChart(
  "Legend",
  props({ style: ["line", "rectangle", "circle", "square"] }, (p) =>
    chartLegend(p.style),
  ),
  {
    family: "common",
    files: [
      "components/common/components/Legend.tsx",
      "components/common/components/Legend.module.scss",
    ],
    covered: [
      "Internal reusable Legend.style line/rectangle/circle/square",
      "Exact48px line/rectangle and12px circle/square source metrics",
      "24px legend gap/8px color-label gap",
      "Current chart-token aliases from index.scss",
    ],
    limitations: [
      "Legend is a shared internal design primitive; it is not an independent public /charts export.",
      "Native single-row sample does not implement flex wrapping for arbitrary label strings.",
    ],
  },
);
addChart(
  "ChartHeading",
  props(
    {
      description: ["", "Usage during the last quarter"],
      icon: ["none", "information"],
    },
    (p) =>
      col(
        "heading",
        [
          f(
            "title-row",
            [
              {
                ...t("title", "Asset downloads", 16, S.text, true),
                textStyle: "text-heading-large-default",
              },
              ...(p.icon === "information"
                ? [icon("icon", "info", 16, S.secondary)]
                : []),
            ],
            { gap: 6 },
          ),
          ...(p.description
            ? [
                col(
                  "description-wrapper",
                  [t("description", p.description, 13, S.secondary)],
                  { paddingTop: 14 },
                ),
              ]
            : []),
        ],
        { paddingTop: 8, paddingBottom: 20 },
      ),
  ),
  {
    covered: [
      "Public title/description/icon composition",
      "Source heading-large16px medium typography",
      "Source margin-block8/20,icon gap6,description margin-top14",
    ],
    limitations: [
      "title/icon accept arbitrary ReactNode content; native specimen provides editable text and one icon-swap slot.",
    ],
  },
);
addChart(
  "LinearGauge",
  props(
    {
      totalLabel: ["", "Total"],
      state: ["default", "hover-primary", "hover-secondary", "hover-tertiary"],
    },
    (p) =>
      col(
        "gauge",
        [
          chartLegend("square"),
          f(
            "bar",
            [50, 30, 20].map((value, i) =>
              box(
                `section-${i}`,
                value * 3.6,
                12,
                p.state === `hover-${["primary", "secondary", "tertiary"][i]}`
                  ? chartHover[i]
                  : chartColors[i],
              ),
            ),
            {
              width: 360,
              height: 12,
              radius: 6,
              clipContent: true,
              bindings: { fills: "color-container-secondary-hover" },
            },
          ),
        ],
        { width: 360, gap: 24, bindings: { itemSpacing: "spacing-large" } },
      ),
  ),
  {
    files: [
      "components/LinearGauge/LinearGauge.tsx",
      "components/LinearGauge/LinearGauge.module.scss",
      "components/LinearGauge/types.ts",
      "components/LinearGauge/components/Section.tsx",
      "components/common/components/Legend.tsx",
      "components/common/components/Legend.module.scss",
    ],
    covered: [
      "Actual sections fixture50/30/20 percentages",
      "Source12px bar height/6px clip radius",
      "Source square legend and24px stack gap",
      "Per-section source hover color",
      "Public optional totalLabel affects tooltip, not intrinsic bar appearance",
    ],
    limitations: [
      "totalLabel value controls runtime tooltip only; totalValue companion is represented in the tooltip primitive rather than drawn beside the gauge.",
      "The fixture sections use native editable rectangles; arbitrary percentages need regeneration.",
    ],
  },
);
addChart(
  "Tooltip",
  props(
    {
      title: ["", "Usage"],
      description: ["", "Downloads in the selected period"],
    },
    (p) =>
      surface(
        "tooltip",
        [
          ...(p.title
            ? [t("title", p.title, 13, "color-primary-on-primary", true)]
            : []),
          ...(p.description
            ? [t("description", p.description, 12, "color-primary-on-primary")]
            : []),
          ...["Images", "Documents", "Video"].map((name, i) =>
            f(
              `row-${i}`,
              [
                box("dot", 8, 8, chartColors[i], 9999),
                t("name", name, 13, "color-primary-on-primary"),
                t(
                  "value",
                  `${[50, 30, 20][i]}%`,
                  13,
                  "color-primary-on-primary",
                  true,
                ),
              ],
              { gap: 4, primaryAlign: "SPACE_BETWEEN", width: 220 },
            ),
          ),
        ],
        {
          width: 244,
          padding: 12,
          gap: 8,
          bindings: {
            fills: S.text,
            strokes: S.text,
            cornerRadius: "border-radius-medium",
          },
        },
      ),
  ),
  {
    family: "common",
    files: ["components/common/components/Tooltip/TooltipContent.module.scss"],
    covered: [
      "Shared internal tooltip token fill/border12px padding",
      "8px colored dots/13px item labels and bold values",
      "Optional title/description blocks",
    ],
    limitations: [
      "Tooltip shared visual primitive is not a public chart export.",
      "Image tooltip layout and valueFormatter callbacks are not enumerated.",
    ],
  },
);
function chartLayout(p, plot, style = "rectangle") {
  const legend = chartLegend(style),
    axis = col(
      "axes",
      [
        line("baseline", 360),
        f(
          "x-labels",
          ["Jan", "Feb", "Mar", "Apr"].map((name, i) =>
            f(`tick-${i}`, [t("label", name, 12, S.secondary)], {
              width: 90,
              primaryAlign: "CENTER",
            }),
          ),
        ),
      ],
      { gap: 8 },
    );
  return col(
    "chart",
    [
      ...(p.hideLegend === "false" && p.legendPosition === "top"
        ? [legend]
        : []),
      plot,
      axis,
      ...(p.hideLegend === "false" && p.legendPosition === "bottom"
        ? [legend]
        : []),
    ],
    { gap: 24 },
  );
}
addChart(
  "BarChart",
  props(
    {
      horizontal: [false, true],
      displayStyle: ["default", "overlapped"],
      hideLegend: [false, true],
      legendPosition: ["top", "bottom"],
    },
    (p) => {
      const horizontal = p.horizontal === "true",
        groups = [
          [64, 45, 30],
          [112, 72, 56],
          [88, 64, 45],
          [144, 90, 64],
        ];
      const plot = f(
        "plot",
        groups.map((values, i) =>
          f(
            `group-${i}`,
            values.map((value, j) => ({
              ...box(
                `bar-${j}`,
                horizontal ? value : p.displayStyle === "overlapped" ? 40 : 16,
                horizontal
                  ? p.displayStyle === "overlapped"
                    ? 40
                    : 16
                  : value,
                chartColors[j],
              ),
              ...(p.displayStyle === "overlapped"
                ? {
                    layoutPositioning: "ABSOLUTE",
                    x: horizontal ? 0 : j * 4,
                    y: horizontal ? j * 4 : 144 - value,
                  }
                : {}),
            })),
            {
              layout: horizontal ? "VERTICAL" : "HORIZONTAL",
              height: horizontal ? 52 : 144,
              width: horizontal ? 160 : 66,
              gap: 2,
              counterAlign: horizontal ? "MIN" : "MAX",
            },
          ),
        ),
        {
          layout: horizontal ? "VERTICAL" : "HORIZONTAL",
          gap: 24,
          width: 360,
          height: horizontal ? 280 : 144,
          counterAlign: "MAX",
        },
      );
      return chartLayout(p, plot);
    },
  ),
  {
    files: [
      "components/BarChart/BarChart.tsx",
      "components/BarChart/BarChart.module.scss",
      "components/BarChart/types.ts",
      "components/BarChart/components/Bars.tsx",
      "components/common/components/Legend.tsx",
      "components/common/components/Legend.module.scss",
    ],
    covered: [
      "Public horizontal boolean (replaces invented orientation)",
      "displayStyle default/overlapped",
      "hideLegend boolean and legendPosition top/bottom",
      "Source rectangle legend/current chart color aliases",
    ],
    limitations: [
      "Grouped/overlapped geometries are fixed sample categories; exact BarGroup scale band padding, axes/ticks and responsive margins require d3/visx runtime.",
      "Horizontal-axis label placement is a design fixture and requires visual parity review.",
    ],
  },
);

export const patternCoverage = {
  release: "13.11.1",
  scope: "Complex source-derived native patterns and reusable compound parts",
  counts: {
    sets: recipes.length,
    variants: recipes.reduce((n, r) => n + r.variants.length, 0),
  },
  entries: evidence,
};
export default recipes;
export { recipes };
