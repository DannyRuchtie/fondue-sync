/** Finite native control recipes. Values come from the pinned release's TSX/SCSS. */
import fs from "node:fs";
import path from "node:path";
const source = new URL("../.cache/release/", import.meta.url);
const t = {
  surface: "color-surface-default",
  text: "color-primary-default",
  line: "color-line-mid",
  muted: "color-secondary-default",
};
const sizePx = {
  "xx-small": 11,
  "x-small": 12,
  small: 13,
  medium: 14,
  large: 16,
  "x-large": 20,
  "xx-large": 24,
};
const text = (
  id,
  value,
  size = "medium",
  color = t.text,
  weight = "regular",
) => ({
  id,
  kind: "text",
  name: id,
  text: value,
  fontSize: sizePx[size],
  fontWeight: { regular: 400, medium: 500, bold: 700 }[weight],
  ...(Object.hasOwn({ small: 1, medium: 1, large: 1, "x-small": 1 }, size)
    ? {
        textStyle: `text-body-${size}-${{ regular: "default", medium: "strong", bold: "x-strong" }[weight]}`,
      }
    : { textStyle: `text-heading-${size}-default` }),
  bindings: {
    fills: color,
    fontSize: `typography-font-size-${size}`,
    fontWeight: `typography-font-weight-${weight}`,
    lineHeight: `typography-line-height-${["xx-small", "x-small", "small"].includes(size) ? "tight" : { medium: "medium", large: "wide", "x-large": "loose", "xx-large": "extra-loose" }[size]}`,
  },
});
const frame = (id, children = [], props = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "HORIZONTAL",
  gap: 0,
  padding: 0,
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  children,
  ...props,
});
const rect = (id, w, h, color, radius = 0) => ({
  id,
  kind: "rectangle",
  name: id,
  width: w,
  height: h,
  radius,
  bindings: color ? { fills: color } : {},
});
const dot = (id, size, color) => ({
  ...rect(id, size, size, color, size / 2),
  kind: "ellipse",
});
const icon = (id, iconId = "icon:check-mark", color = t.text, size = 16) => ({
  id,
  kind: "instance",
  name: id,
  iconId,
  width: size,
  height: size,
  iconColor: color,
});
const bool = [false, true];
const states = ["default", "hover", "active", "focus", "disabled"];
const product = (axes) =>
  Object.entries(axes).reduce(
    (acc, [key, values]) =>
      acc.flatMap((a) => values.map((value) => ({ ...a, [key]: value }))),
    [{}],
  );
const recipes = [],
  coverage = [];
const walkFiles = (p) =>
  fs
    .readdirSync(p, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walkFiles(path.join(p, e.name))
        : /\.(tsx?|scss|json)$/.test(e.name)
          ? [path.join(p, e.name)]
          : [],
    );
function add(name, axes, render, omissions = [], status = "supported") {
  const sourceFiles = walkFiles(
    new URL(`packages/components/src/components/${name}/`, source).pathname,
  )
    .filter((p) => !/(\.stories\.|\/tests\/|\/__tests__\/)/.test(p))
    .map((p) => path.relative(source.pathname, p));
  sourceFiles.push("packages/components/src/utilities/focusStyle.module.scss");
  const all = product(axes);
  for (let i = 0; i < all.length; i += 30) {
    const chunk = all.slice(i, i + 30);
    const segment = String(i / 30 + 1).padStart(3, "0");
    recipes.push({
      id: `components/${name}/controls-${segment}`,
      name: `${name}/Controls ${segment}`,
      package: "@frontify/fondue/components",
      source: sourceFiles,
      status,
      limitations: omissions,
      variants: chunk.map((props) => ({
        id: Object.entries(props)
          .map(([k, v]) => `${k}=${v}`)
          .join(";"),
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, String(v)]),
        ),
        root: render(props),
      })),
    });
  }
  coverage.push({
    name,
    status,
    axes,
    variants: all.length,
    nativeSets: Math.ceil(all.length / 30),
    source: sourceFiles,
    contentProperties: [
      "All text layers expose editable TEXT properties.",
      "All native icon instances expose INSTANCE_SWAP and BOOLEAN visibility properties.",
    ],
    omissions,
  });
}
const paint = (layer, bg, fg) => ({
  ...layer,
  bindings: { ...(layer.bindings ?? {}), ...(bg ? { fills: bg } : {}) },
  children: (layer.children ?? []).map((n) =>
    n.kind === "text" ? { ...n, bindings: { ...n.bindings, fills: fg } } : n,
  ),
});
const focus = (node, state) =>
  state === "focus"
    ? {
        ...node,
        focusRing: {
          inner: "color-surface-default",
          outer: "color-focus-default",
          innerSpread: 2,
          outerSpread: 6,
        },
      }
    : node;
const colorName = {
  default: "primary",
  positive: "success",
  negative: "error",
  danger: "error",
  loud: "highlight",
  highlight: "highlight",
  warning: "warning",
};
function buttonColors(variant, emphasis, state) {
  const c = colorName[variant],
    s = ["hover", "active"].includes(state) ? state : "default";
  if (state === "disabled")
    return [
      emphasis === "weak" ? null : "color-container-disabled-default",
      "color-container-disabled-on-disabled-container",
    ];
  if (variant === "danger") return [`color-error-${s}`, "color-error-on-error"];
  if (emphasis === "strong") return [`color-${c}-${s}`, `color-${c}-on-${c}`];
  const container =
    variant === "default"
      ? "secondary"
      : { positive: "success", negative: "error", loud: "highlight" }[variant];
  let fg =
    variant === "default"
      ? `color-primary-${state === "hover" ? "hover" : state === "active" ? "pressed" : "default"}`
      : `color-container-${container}-on-${container}-container`;
  if (emphasis === "weak" && state !== "hover" && state !== "active")
    fg = `color-${c}-default`;
  if (variant === "positive" && emphasis === "default" && state === "active")
    fg = "color-container-success-on-success-container-pressed";
  return [
    emphasis === "weak" && s === "default"
      ? null
      : `color-container-${container}-${s}`,
    fg,
  ];
}
function button(p, id = "button", content = "Button") {
  const [bg, fg] = buttonColors(p.variant ?? "default", p.emphasis, p.state);
  const h = { small: 24, medium: 36, large: 48 }[p.size];
  return focus(
    frame(
      id,
      p.aspect === "square"
        ? [icon("icon", "icon:check-mark", fg, p.size === "large" ? 24 : 16)]
        : [
            {
              ...icon(
                "left-icon",
                "icon:plus",
                fg,
                p.size === "large" ? 24 : 16,
              ),
              visible: false,
            },
            text("label", content, p.size, fg, "medium"),
            {
              ...icon(
                "right-icon",
                "icon:caret-down",
                fg,
                p.size === "large" ? 24 : 16,
              ),
              visible: false,
            },
          ],
      {
        height: h,
        ...(p.aspect === "square"
          ? { width: h }
          : {
              paddingLeft: { small: 8, medium: 12, large: 16 }[p.size],
              paddingRight: { small: 8, medium: 12, large: 16 }[p.size],
            }),
        gap: p.size === "large" ? 8 : 6,
        radius: p.rounding === "full" ? 9999 : 4,
        bindings: {
          ...(bg ? { fills: bg } : {}),
          ...(p.rounding === "full"
            ? {}
            : { cornerRadius: "border-radius-medium" }),
        },
      },
    ),
    p.state,
  );
}
add(
  "Button",
  {
    variant: ["default", "positive", "negative", "danger", "loud"],
    emphasis: ["default", "weak", "strong"],
    rounding: ["medium", "full"],
    aspect: ["default", "square"],
    size: ["small", "medium", "large"],
    state: states,
  },
  (p) => button(p),
  [
    "Full-width behavior is native frame resizing; square aspect swaps text content for a native icon. CSS forced-colors media mode is represented by the browser, not this light/dark library.",
  ],
);
add(
  "Badge",
  {
    variant: ["default", "positive", "highlight", "warning", "negative"],
    emphasis: ["strong", "weak"],
    size: ["default", "small"],
    state: ["default", "hover", "disabled"],
  },
  (p) => {
    const c = colorName[p.variant],
      container = p.variant === "default" ? "secondary" : c;
    const disabled = p.state === "disabled";
    const bg = disabled
      ? "color-container-disabled-default"
      : p.emphasis === "weak"
        ? `color-container-${container}-${p.state === "hover" ? "hover" : "default"}`
        : `color-${c}-${p.state === "hover" ? "hover" : "default"}`;
    const fg = disabled
      ? "color-container-disabled-on-disabled-container"
      : p.emphasis === "weak"
        ? `color-container-${container}-on-${container}-container`
        : `color-${c}-on-${c}`;
    return frame(
      "badge",
      [
        dot("status", 8, `color-${c}-default`),
        text("label", "Status", "small", fg),
        icon("dismiss", "icon:cross", fg, 12),
      ],
      {
        paddingTop: p.size === "small" ? 2 : 4,
        paddingBottom: p.size === "small" ? 2 : 4,
        paddingLeft: 8,
        paddingRight: 8,
        gap: 4,
        radius: 9999,
        bindings: { fills: bg },
      },
    );
  },
  [
    "Status dot and dismiss are independently hideable native properties. Arbitrary custom status colors remain editable fill overrides. Forced-colors media rendering remains in CSS.",
  ],
);
add(
  "Checkbox",
  {
    size: ["default", "large"],
    emphasis: ["default", "weak"],
    value: ["unchecked", "checked", "indeterminate"],
    status: ["default", "error"],
    state: states,
  },
  (p) => {
    const on = p.value !== "unchecked",
      disabled = p.state === "disabled",
      c = p.emphasis === "default" ? "highlight" : "primary";
    const fill = on
      ? disabled
        ? "color-disabled-default"
        : `color-${c}-${["hover", "active"].includes(p.state) ? p.state : "default"}`
      : t.surface;
    return focus(
      frame(
        "checkbox",
        on
          ? [
              p.value === "checked"
                ? icon("indicator", "icon:check-mark", "color-neutral-00")
                : icon("indicator", "icon:minus", "color-neutral-00"),
            ]
          : [],
        {
          width: p.size === "large" ? 20 : 16,
          height: p.size === "large" ? 20 : 16,
          radius: 4,
          bindings: {
            fills: fill,
            ...(p.status === "error"
              ? { strokes: "color-error-default" }
              : !on
                ? {
                    strokes: disabled
                      ? "color-disabled-default"
                      : p.state === "hover"
                        ? "color-line-strong"
                        : t.line,
                  }
                : {}),
            cornerRadius: "border-radius-medium",
          },
        },
      ),
      p.state,
    );
  },
  [
    "Read-only shares default appearance and blocks interaction in code; error state keeps the source red border.",
  ],
);
add(
  "RadioList",
  {
    emphasis: ["default", "highlight"],
    orientation: ["vertical", "horizontal"],
    selected: ["first", "second"],
    state: ["default", "hover", "focus", "disabled"],
  },
  (p) =>
    frame(
      "radio-list",
      ["First option", "Second option"].map((name, i) => {
        const on = p.selected === (i === 0 ? "first" : "second"),
          c = p.emphasis === "highlight" ? "highlight" : "primary";
        const color =
          p.state === "disabled"
            ? "color-container-secondary-default"
            : `color-${c}-${p.state === "hover" ? "hover" : "default"}`;
        return frame(
          `option-${i}`,
          [
            focus(
              frame(
                "radio",
                on
                  ? [
                      {
                        ...dot("indicator-ring", 18, color),
                        layoutPositioning: "ABSOLUTE",
                        x: -1,
                        y: -1,
                      },
                      {
                        ...dot("indicator-center", 6, t.surface),
                        layoutPositioning: "ABSOLUTE",
                        x: 5,
                        y: 5,
                      },
                    ]
                  : [],
                {
                  width: 16,
                  height: 16,
                  radius: 8,
                  bindings: {
                    strokes:
                      p.state === "disabled"
                        ? "color-line-subtle"
                        : p.state === "hover"
                          ? "color-line-strong"
                          : t.line,
                  },
                },
              ),
              p.state,
            ),
            text("label", name),
          ],
          { gap: 8 },
        );
      }),
      {
        layout: p.orientation === "vertical" ? "VERTICAL" : "HORIZONTAL",
        gap: 8,
        primaryAlign: "MIN",
        counterAlign: "MIN",
      },
    ),
  [
    "List item labels are editable; additional options are created by duplicating native option structure. Source 6px indicator with 6px outline is represented by concentric native ellipses.",
  ],
);
add(
  "Switch",
  {
    size: ["small", "medium", "large"],
    value: bool,
    state: ["default", "hover", "focus", "disabled"],
  },
  (p) => {
    const [w, h] = { small: [24, 12], medium: [32, 16], large: [36, 20] }[
      p.size
    ];
    const color =
      p.state === "disabled"
        ? "color-container-disabled-default"
        : p.value
          ? `color-primary-${p.state === "hover" ? "hover" : "default"}`
          : `color-container-secondary-${p.state === "hover" ? "hover" : "default"}`;
    return focus(
      frame(
        "switch",
        [
          {
            ...dot("thumb", h, t.surface),
            layoutPositioning: "ABSOLUTE",
            x: p.value ? w - h : 0,
            y: 0,
            bindings: {
              fills: t.surface,
              strokes: p.state === "disabled" ? t.line : "color-line-strong",
            },
          },
        ],
        {
          width: w,
          height: h,
          radius: h / 2,
          bindings: {
            fills: color,
            strokes:
              p.state === "disabled"
                ? "color-line-subtle"
                : p.value
                  ? "color-line-strong"
                  : t.line,
          },
        },
      ),
      p.state,
    );
  },
);
const statusIcon = (status) =>
  status === "success"
    ? icon("status", "icon:check-mark-circle", "color-success-default")
    : status === "error"
      ? icon("status", "icon:cross-circle", "color-error-default")
      : null;
function field(p, multiline = false) {
  const disabled = p.mode === "disabled",
    readOnly = p.mode === "read-only";
  const fg = disabled
    ? "color-disabled-default"
    : readOnly || p.content === "placeholder"
      ? t.muted
      : t.text;
  const border =
    p.status === "success"
      ? "color-success-default"
      : p.status === "error"
        ? "color-error-default"
        : disabled
          ? "color-line-subtle"
          : ["hover", "focus"].includes(p.mode)
            ? "color-line-strong"
            : t.line;
  const children = [
    text(
      "value",
      p.content === "placeholder"
        ? "Enter text"
        : multiline
          ? "A longer description\nwith editable content."
          : "Text value",
      "medium",
      fg,
    ),
  ];
  if (p.slots === "left" || p.slots === "both")
    children.unshift(icon("left-slot", "icon:magnifier", fg));
  const status = statusIcon(p.status);
  if (status) children.push(status);
  if (p.slots === "right" || p.slots === "both")
    children.push(icon("right-slot", "icon:cross", fg));
  if (multiline && p.clearable) children.push(icon("clear", "icon:cross", fg));
  if (p.status === "loading")
    children.push({
      ...frame(
        "loading",
        [
          {
            id: "arc",
            kind: "ellipse",
            name: "loading arc",
            width: 16,
            height: 16,
            arcData: {
              startingAngle: -Math.PI / 4,
              endingAngle: (5 * Math.PI) / 4,
              innerRadius: 0.75,
            },
            bindings: { fills: "color-highlight-default" },
          },
        ],
        {
          width: 24,
          height: 24,
          radius: 9999,
          bindings: { fills: t.surface, strokes: t.line },
        },
      ),
      x: 268,
      y: -12,
      layoutPositioning: "ABSOLUTE",
    });
  if (multiline && p.mode !== "disabled")
    children.push({
      id: "resize-handle",
      kind: "svg",
      name: "resize handle",
      width: 12,
      height: 12,
      layoutPositioning: "ABSOLUTE",
      x: 266,
      y: 82,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="m11 3-8 8m8-4-4 4" stroke="#808080"/></svg>',
    });
  return focus(
    frame("field", children, {
      width: 280,
      height: multiline ? 96 : 36,
      paddingLeft: readOnly ? 0 : 12,
      paddingRight: readOnly ? 0 : 12,
      paddingTop: multiline ? 8 : 0,
      paddingBottom: multiline ? 8 : 0,
      gap: 6,
      primaryAlign: "MIN",
      counterAlign: multiline ? "MIN" : "CENTER",
      radius: 4,
      bindings: {
        ...(!readOnly
          ? {
              fills: disabled ? "color-container-disabled-default" : t.surface,
              strokes: border,
            }
          : {}),
        cornerRadius: "border-radius-medium",
      },
    }),
    p.mode,
  );
}
add(
  "TextInput",
  {
    status: ["neutral", "success", "error", "loading"],
    mode: ["default", "hover", "focus", "disabled", "read-only"],
    content: ["value", "placeholder"],
    slots: ["none", "left", "right", "both"],
  },
  (p) => field(p),
  [
    "Hidden input types have no canvas asset. Email/number/password/search/tel/time/url differ in browser semantics and text content; edit the text property. Loading is a native icon snapshot rather than animation.",
  ],
);
add(
  "Textarea",
  {
    status: ["default", "success", "error", "loading"],
    mode: ["default", "hover", "focus", "disabled", "read-only"],
    content: ["value", "placeholder"],
    clearable: bool,
    slots: ["none", "left", "right", "both"],
  },
  (p) => field(p, true),
  [
    "Native height can be resized to match minRows/maxRows; autosize is runtime text measurement. Extra actions/decorators are exposed native icon slots. Loading is a native icon snapshot rather than animation.",
  ],
);
add(
  "Tag",
  {
    variant: ["default", "highlight"],
    emphasis: ["strong", "weak"],
    size: ["default", "small"],
    state: ["default", "hover", "disabled"],
    content: ["main", "hover"],
  },
  (p) => {
    const c = colorName[p.variant],
      container = p.variant === "default" ? "secondary" : c,
      disabled = p.state === "disabled";
    const bg = disabled
      ? "color-container-disabled-default"
      : p.emphasis === "weak"
        ? `color-container-${container}-${p.state === "hover" ? "hover" : "default"}`
        : `color-${c}-${p.state === "hover" ? "hover" : "default"}`;
    const fg = disabled
      ? "color-container-disabled-on-disabled"
      : p.emphasis === "weak"
        ? `color-container-${container}-on-${container}-container`
        : `color-${c}-on-${c}`;
    return frame(
      "tag",
      [
        frame(
          "main-content",
          [
            text(
              "label",
              p.content === "hover" ? "Remove from list" : "Design",
              "small",
              fg,
            ),
            text(
              "secondary",
              "12",
              "small",
              p.emphasis === "weak" ? t.muted : fg,
            ),
          ],
          {
            paddingTop: p.size === "small" ? 2 : 4,
            paddingBottom: p.size === "small" ? 2 : 4,
            paddingLeft: 8,
            paddingRight: 8,
            gap: 6,
          },
        ),
        frame("add-action", [icon("add", "icon:plus", fg, 12)], { width: 24 }),
        frame("dismiss-action", [icon("dismiss", "icon:cross", fg, 12)], {
          width: 24,
        }),
      ],
      {
        radius: 4,
        bindings: { fills: bg, cornerRadius: "border-radius-medium" },
      },
    );
  },
  [
    "Main/secondary content text and add/dismiss visibility are native properties; mixed per-action hover is an editable fill override. Forced-colors media rendering remains in CSS.",
  ],
);
add(
  "Link",
  {
    color: ["primary", "secondary", "error", "success", "warning", "highlight"],
    size: [
      "xx-small",
      "x-small",
      "small",
      "medium",
      "large",
      "x-large",
      "xx-large",
    ],
    weight: ["regular", "medium", "bold"],
    underline: ["auto", "always", "hover", "none"],
    state: ["default", "hover", "disabled"],
  },
  (p) => {
    const node = text(
      "label",
      "Learn more",
      p.size,
      p.state === "disabled"
        ? "color-disabled-default"
        : `color-${p.color}-default`,
      p.weight,
    );
    if (p.size === "xx-small") delete node.textStyle;
    node.textDecoration =
      p.underline === "always" ||
      (p.underline === "hover" && p.state === "hover")
        ? "UNDERLINE"
        : "NONE";
    return frame("link", [node]);
  },
  [
    "Native text wrapping/truncation is controlled by frame and text resizing. onContainer alternate semantic colors are supplied in independent Link/On container sets.",
  ],
);
const containerLinks = [
  "secondary",
  "disabled",
  "error",
  "success",
  "warning",
  "highlight",
];
// Reuse source recipe construction while distinct names remain in the Link inventory family.
const before = recipes.length;
add(
  "Link",
  {
    onContainer: containerLinks,
    size: [
      "xx-small",
      "x-small",
      "small",
      "medium",
      "large",
      "x-large",
      "xx-large",
    ],
    weight: ["regular", "medium", "bold"],
    underline: ["auto", "always", "hover", "none"],
    state: ["default", "hover", "disabled"],
  },
  (p) =>
    frame("link", [
      {
        ...text(
          "label",
          "Learn more",
          p.size,
          p.state === "disabled"
            ? "color-disabled-default"
            : `color-container-${p.onContainer}-on-${p.onContainer}${p.onContainer === "disabled" ? "" : "-container"}`,
          p.weight,
        ),
        textStyle:
          p.size === "xx-small"
            ? undefined
            : ["x-small", "small", "medium", "large"].includes(p.size)
              ? `text-body-${p.size}-${{ regular: "default", medium: "strong", bold: "x-strong" }[p.weight]}`
              : `text-heading-${p.size}-default`,
        textDecoration:
          p.underline === "always" ||
          (p.underline === "hover" && p.state === "hover")
            ? "UNDERLINE"
            : "NONE",
      },
    ]),
  ["Native text wrapping/truncation is controlled by frame and text resizing."],
);
for (const recipe of recipes.slice(before)) {
  recipe.id = recipe.id.replace("/controls-", "/on-container-");
  recipe.name = recipe.name.replace("/Controls", "/On container");
}
add(
  "Slider",
  {
    value: ["0", "25", "50", "75", "100"],
    range: ["single", "range"],
    state: ["default", "hover", "active", "focus", "disabled"],
  },
  (p) => {
    const value = Number(p.value),
      disabled = p.state === "disabled";
    const children = [
      {
        ...rect("track", 240, 4, "color-container-secondary-default", 4),
        x: 0,
        y: 8,
        layoutPositioning: "ABSOLUTE",
      },
      {
        ...rect(
          "range",
          p.range === "single" ? value * 2.4 : 120,
          4,
          disabled ? "color-disabled-default" : t.text,
          4,
        ),
        x: p.range === "single" ? 0 : 60,
        y: 8,
        layoutPositioning: "ABSOLUTE",
      },
    ];
    for (const [i, x] of (p.range === "single"
      ? [value * 2.4 - 10]
      : [50, 170]
    ).entries())
      children.push(
        focus(
          {
            ...dot(
              `thumb-${i}`,
              20,
              disabled ? "color-disabled-default" : t.surface,
            ),
            layoutPositioning: "ABSOLUTE",
            x,
            y: 0,
            bindings: {
              fills: disabled ? "color-disabled-default" : t.surface,
              strokes: t.line,
            },
            ...(p.state === "hover" ? { effectStyle: "shadow-default" } : {}),
          },
          p.state,
        ),
      );
    return frame("slider", children, { width: 240, height: 20 });
  },
  [
    "Values are sample stops within the source continuous range. Drag thumb positions and resize filled track for arbitrary values; min/max/step remain runtime constraints. Active pointer thumb shadow outline requires native visual QA.",
  ],
);
add(
  "SegmentedControl",
  {
    selected: ["first", "second"],
    disabled: bool,
    iconOnly: bool,
    hugWidth: bool,
    state: ["default", "hover", "focus"],
  },
  (p) =>
    frame(
      "segmented-control",
      ["First", "Second"].map((name, i) => {
        const selected = p.selected === (i === 0 ? "first" : "second");
        const fg = p.disabled
          ? "color-container-disabled-on-disabled-container"
          : selected
            ? t.text
            : "color-container-secondary-on-secondary-container";
        return focus(
          frame(
            `item-${i}`,
            p.iconOnly
              ? [
                  icon(
                    "icon",
                    i === 0 ? "icon:list-bullet" : "icon:grid-regular",
                    fg,
                  ),
                ]
              : [
                  text(
                    "label",
                    name,
                    "medium",
                    fg,
                    selected ? "medium" : "regular",
                  ),
                ],
            {
              width: p.iconOnly ? 34 : 100,
              height: 34,
              paddingLeft: p.iconOnly ? 0 : 16,
              paddingRight: p.iconOnly ? 0 : 16,
              radius: 3,
              bindings: {
                ...(selected
                  ? {
                      fills: p.disabled
                        ? "color-container-disabled-default"
                        : t.surface,
                      strokes: p.disabled ? t.line : "color-line-strong",
                    }
                  : p.state === "hover" && !p.disabled
                    ? { fills: "color-surface-hover" }
                    : {}),
              },
            },
          ),
          p.state,
        );
      }),
      {
        height: 36,
        padding: 1,
        gap: 0,
        radius: 4,
        bindings: {
          fills: p.disabled ? t.surface : "color-surface-dim",
          strokes: p.disabled ? "color-line-subtle" : t.line,
          cornerRadius: "border-radius-medium",
        },
      },
    ),
  [
    "Fixed two-item specimen. Use the additive SegmentedControl/Root and /Item components for variable item count through native slots. Responsive label clamp is represented at the 16px maximum.",
  ],
);
add(
  "SplitButton",
  {
    emphasis: ["default", "weak", "strong"],
    size: ["small", "medium", "large"],
    state: states,
    rotateIcon: bool,
  },
  (p) => {
    const props = {
      ...p,
      variant: "default",
      rounding: "medium",
      aspect: "default",
    };
    const phase = ["hover", "active"].includes(p.state) ? p.state : "default";
    const bg =
      p.state === "disabled"
        ? "color-container-disabled-default"
        : p.emphasis === "strong"
          ? `color-primary-${phase}`
          : p.emphasis === "weak" && phase === "default"
            ? null
            : `color-container-secondary-${phase}`;
    const fg =
      p.state === "disabled"
        ? "color-container-disabled-on-disabled-container"
        : p.emphasis === "strong"
          ? "color-primary-on-primary"
          : "color-primary-default";
    const h = { small: 24, medium: 36, large: 48 }[p.size];
    const content = button(props, "content", "Create");
    // SplitButton.Content rounds only the outside (left) edge.
    delete content.bindings.cornerRadius;
    Object.assign(content.bindings, {
      topLeftRadius: "border-radius-medium",
      bottomLeftRadius: "border-radius-medium",
      topRightRadius: "component-constant-radius-0",
      bottomRightRadius: "component-constant-radius-0",
    });
    if (bg) content.bindings.fills = bg;
    else delete content.bindings.fills;
    content.children.forEach((child) => {
      if (child.kind === "text") child.bindings.fills = fg;
      if (child.kind === "instance") child.iconColor = fg;
    });
    return frame(
      "split-button",
      [
        content,
        frame("separator", [
          rect(
            "line",
            1,
            h,
            p.state === "disabled" ? "color-line-subtle" : "color-line-mid",
          ),
        ]),
        focus(
          frame(
            "action",
            [
              {
                ...icon("menu", "icon:caret-down", fg),
                rotation: p.rotateIcon ? 180 : 0,
              },
            ],
            {
              width: h,
              height: h,
              radius: 4,
              bindings: {
                ...(bg ? { fills: bg } : {}),
                topLeftRadius: "component-constant-radius-0",
                bottomLeftRadius: "component-constant-radius-0",
                topRightRadius: "border-radius-medium",
                bottomRightRadius: "border-radius-medium",
              },
            },
          ),
          p.state,
        ),
      ],
      { gap: 0, radius: 4 },
    );
  },
  [
    "Content and menu trigger are separate native controls; dropdown menu composition is provided by Dropdown assets.",
  ],
);
add(
  "Notice",
  {
    variant: ["default", "highlight", "positive", "danger", "warning"],
    emphasis: ["default", "strong", "weak"],
    size: ["medium", "large"],
    alignContent: ["center", "top"],
  },
  (p) => {
    const c = p.variant === "default" ? "secondary" : colorName[p.variant];
    let bg, fg;
    if (p.emphasis === "weak") {
      bg = "color-surface-dim";
      fg = t.muted;
    } else if (p.emphasis === "strong") {
      const strong = p.variant === "default" ? "primary" : c;
      bg = `color-${strong}-default`;
      fg = `color-${strong}-on-${strong}`;
    } else {
      bg = `color-container-${c}-default`;
      fg = `color-container-${c}-on-${c}-container${p.variant === "default" ? "-variant" : ""}`;
    }
    const iconColor =
        p.emphasis === "weak" && p.variant !== "default"
          ? `color-${c}-default`
          : fg,
      large = p.size === "large";
    return frame(
      "notice",
      [
        icon("leading-icon", "icon:info", iconColor, large ? 20 : 16),
        text("message", "Changes saved", large ? "medium" : "x-small", fg),
        frame("action", [
          text("action-label", "Undo", large ? "medium" : "x-small", fg),
        ]),
        icon("dismiss", "icon:cross", fg, large ? 20 : 16),
      ],
      {
        paddingTop: large ? 24 : 8,
        paddingBottom: large ? 24 : 8,
        paddingLeft: large ? 24 : 12,
        paddingRight: large ? 24 : 12,
        gap: large ? 12 : 8,
        counterAlign: p.alignContent === "top" ? "MIN" : "CENTER",
        radius: 4,
        bindings: { fills: bg, cornerRadius: "border-radius-medium" },
      },
    );
  },
  [
    "Message/action text and leading/dismiss icon visibility are native properties. Arbitrary custom React action content is composed with the other native control assets. Forced-colors media rendering remains in CSS.",
  ],
);
// Reviewed profile contract: cover every enum value with coupled visual states,
// while avoiding thousands of unlikely cross-product variants. The exposed TEXT,
// BOOLEAN and INSTANCE_SWAP properties handle arbitrary labels and icons.
export const profilePolicy = {
  Button:
    "Every intent/emphasis/state at medium size and medium rounding; all size/rounding/aspect/state combinations for default intent and strong emphasis.",
  Link: "Every color or on-container color × underline × state at medium/regular; every size × weight at primary/auto/default (and secondary container for on-container profile).",
  Badge:
    "Every variant/emphasis/state at default size; every variant/emphasis at small/default state.",
  TextInput:
    "Every status/mode at baseline text/no slots; every slot/content combination at neutral/default.",
  Textarea:
    "Every status/mode at baseline text/no slots/clearable=false; every slot/content/clearable combination at default/default.",
};
const reviewedProfile = (family, p) => {
  if (family === "Button")
    return (
      (p.size === "medium" &&
        p.rounding === "medium" &&
        p.aspect === "default") ||
      (p.variant === "default" && p.emphasis === "strong")
    );
  if (family === "Link")
    return (
      (p.size === "medium" && p.weight === "regular") ||
      ((p.color === "primary" || p.onContainer === "secondary") &&
        p.underline === "auto" &&
        p.state === "default")
    );
  if (family === "Badge") return p.size === "default" || p.state === "default";
  if (family === "TextInput")
    return (
      (p.content === "value" && p.slots === "none") ||
      (p.status === "neutral" && p.mode === "default")
    );
  if (family === "Textarea")
    return (
      (p.content === "value" &&
        p.slots === "none" &&
        p.clearable === "false") ||
      (p.status === "default" && p.mode === "default")
    );
  return true;
};
for (const recipe of recipes) {
  const family = recipe.name.split("/")[0],
    before = recipe.variants.length;
  recipe.variants = recipe.variants.filter((v) =>
    reviewedProfile(family, v.props),
  );
  if (recipe.variants.length !== before || profilePolicy[family]) {
    recipe.status = "partial";
    recipe.limitations.push(
      "Reviewed profile contract: all enum values have native examples, but the full cross-product is not imported. " +
        profilePolicy[family],
    );
  }
}

// Source-data gaps: these declared custom properties do not exist in released CSS.
// Browser measurement proves their color becomes inherited from arbitrary consumer context.
// There is no source-owned fixed Figma color to substitute; omit these exact states explicitly.
export const sourceTokenDefects = [
  {
    token: "color-primary-pressed",
    family: "Button",
    source:
      "packages/components/src/components/Button/styles/button.module.scss",
    lines: [168, 178],
    state: "variant=default, emphasis=default|weak, state=active",
  },
  {
    token: "color-container-success-on-success-container-pressed",
    family: "Button",
    source:
      "packages/components/src/components/Button/styles/button.module.scss",
    lines: [202],
    state: "variant=positive, emphasis=default, state=active",
  },
  {
    token: "color-container-disabled-on-disabled",
    family: "Tag",
    source: "packages/components/src/components/Tag/styles/tag.module.scss",
    lines: [74, 79],
    state: "state=disabled",
  },
  {
    token: "color-container-disabled-on-disabled",
    family: "Link",
    source: "packages/components/src/components/Link/styles/link.module.scss",
    lines: [101],
    state: "onContainer=disabled, state=default|hover",
  },
];
const unresolved = new Set(sourceTokenDefects.map((d) => d.token));
export const omittedSourceStates = [];
for (const recipe of recipes) {
  const kept = [];
  for (const variant of recipe.variants) {
    const missing = new Set();
    const visit = (n) => {
      for (const id of [...Object.values(n.bindings ?? {}), n.iconColor].filter(
        Boolean,
      ))
        if (unresolved.has(id)) missing.add(id);
      for (const child of n.children ?? []) visit(child);
    };
    visit(variant.root);
    if (!missing.size) {
      kept.push(variant);
      continue;
    }
    omittedSourceStates.push({
      recipeId: recipe.id,
      variantId: variant.id,
      props: variant.props,
      tokens: [...missing],
      reason:
        "Released CSS computes inherited color from arbitrary consumer ancestor; no fixed repository-owned value exists. State is omitted rather than assigned a substitute color.",
    });
  }
  if (kept.length !== recipe.variants.length) {
    recipe.status = "partial";
    recipe.limitations = [
      ...recipe.limitations,
      "Source-data gap: states referring to absent released color tokens are omitted. Browser verification proves their computed color inherits arbitrary consumer context. See docs/source-token-defects.md and control-coverage.json.",
    ];
  }
  recipe.variants = kept;
}
for (let i = recipes.length - 1; i >= 0; i--)
  if (!recipes[i].variants.length) recipes.splice(i, 1);
for (const entry of coverage) {
  entry.sourceMatrixVariants = entry.variants;
  const chosen = recipes
    .filter((r) => r.name.split("/")[0] === entry.name)
    .flatMap((r) => r.variants)
    .filter((v) =>
      entry.axes.onContainer
        ? Object.hasOwn(v.props, "onContainer")
        : !Object.hasOwn(v.props, "onContainer"),
    );
  entry.variants = chosen.length;
  entry.nativeSets = recipes.filter(
    (r) => r.name.split("/")[0] === entry.name,
  ).length;
  entry.reviewedProfiles =
    profilePolicy[entry.name] ?? "All listed finite source combinations";
  entry.supportsAllCombinations =
    !profilePolicy[entry.name] &&
    !omittedSourceStates.some((s) => s.recipeId.split("/")[1] === entry.name);
  entry.status = entry.supportsAllCombinations ? "supported" : "partial";
}
// Figma asset names expose the source partition rather than an opaque ordinal.
const usedNames = new Set();
for (const recipe of recipes) {
  const family = recipe.name.split("/")[0],
    first = recipe.variants[0].props;
  const common = Object.entries(first).filter(([key, value]) =>
    recipe.variants.every((v) => v.props[key] === value),
  );
  const stem =
    family +
    "/" +
    (common.length
      ? common.map(([k, v]) => `${k}=${v}`).join(", ")
      : "Source states");
  let name = stem;
  if (usedNames.has(name)) name += ` / ${recipe.id.split("-").at(-1)}`;
  usedNames.add(name);
  recipe.name = name;
}
export default recipes;
export const controlCoverage = coverage;
