/** Native foundations read against the exact 13.11.1 TSX/SCSS snapshot. */
import fs from "node:fs";
import path from "node:path";
const base = new URL("../.cache/release/", import.meta.url).pathname;
const out = [];
export const evidence = [];
const frame = (id, children = [], o = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "HORIZONTAL",
  gap: 0,
  padding: 0,
  children,
  ...o,
});
const rect = (id, w, h, fill, o = {}) => ({
  id,
  kind: "rectangle",
  name: id,
  width: w,
  height: h,
  bindings: fill ? { fills: fill } : {},
  ...o,
});
const text = (
  id,
  value,
  size = 14,
  weight = 400,
  color = "color-primary-default",
  lineHeight = 18,
) => ({
  id,
  kind: "text",
  name: id,
  text: value,
  fontSize: size,
  fontWeight: weight,
  fontFamily: "Diatype",
  lineHeight,
  bindings: color ? { fills: color } : {},
});
const source = (name) => {
  const dir = path.join(base, "packages/components/src/components", name);
  const walk = (p) =>
    fs
      .readdirSync(p, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory() && !/tests/.test(e.name)
          ? walk(path.join(p, e.name))
          : /\.(tsx?|scss)$/.test(e.name) && !e.name.includes("stories")
            ? [path.relative(base, path.join(p, e.name))]
            : [],
      );
  return walk(dir).sort();
};
const variant = (props, root) => ({
  id: Object.entries(props)
    .map(([k, v]) => `${k}=${v}`)
    .join(";"),
  props: Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, String(v)]),
  ),
  root,
});
function add(
  family,
  suffix,
  variants,
  status = "supported",
  limitations = [],
  axes = {},
  runtime = [],
) {
  const name = family + (suffix ? "/" + suffix : "");
  out.push({
    id: "components/" + name,
    name,
    package: "@frontify/fondue/components",
    source: source(family),
    status,
    limitations,
    variants,
  });
  evidence.push({
    family,
    set: name,
    status,
    axes,
    variants: variants.length,
    source: source(family),
    runtimeExcluded: runtime,
    limitations,
  });
}
const body = {
  "x-small": [12, 16],
  small: [13, 16],
  medium: [14, 18],
  large: [16, 20],
};
const weights = { default: 400, strong: 500, "x-strong": 700 };
const colors = {
  default: "color-primary-default",
  weak: "color-secondary-default",
  disabled: "color-disabled-default",
  negative: "color-error-default",
  positive: "color-success-default",
  warning: "color-warning-default",
  interactive: "color-highlight-default",
};
const boxColors = {
  neutral: "color-container-secondary-on-secondary-container",
  selected: "color-container-highlight-on-highlight-container",
  disabled: "color-container-disabled-on-disabled-container",
  positive: "color-container-success-on-success-container",
  negative: "color-container-error-on-error-container",
  warning: "color-container-warning-on-warning-container",
};
for (const [context, map] of [
  ["color", colors],
  ["boxColor", boxColors],
])
  for (const [color, token] of Object.entries(map))
    add(
      "Text",
      context + "-" + color,
      Object.entries(body).flatMap(([size, [px, lh]]) =>
        Object.entries(weights).map(([weight, w]) =>
          variant(
            { size, weight, [context]: color },
            frame("root", [
              {
                ...text("content", "Text", px, w, token, lh),
                textStyle: `text-body-${size}-${weight}`,
                bindings: {
                  fills: token,
                  fontSize: `typography-font-size-${size}`,
                  lineHeight: `typography-line-height-${lh === 16 ? "tight" : lh === 18 ? "medium" : "wide"}`,
                  fontWeight: `typography-font-weight-${w === 400 ? "regular" : w === 500 ? "medium" : "bold"}`,
                },
              },
            ]),
          ),
        ),
      ),
      "supported",
      [],
      {
        size: Object.keys(body),
        weight: Object.keys(weights),
        [context]: [color],
      },
      [
        "as/HTML semantics, aria attributes and arbitrary children content; native text remains editable.",
      ],
    );
for (const [color, token] of Object.entries({ ...colors, "x-weak": null }))
  add(
    "Heading",
    "color-" + color,
    Object.entries({
      medium: [14, 16],
      large: [16, 20],
      "x-large": [20, 24],
      "xx-large": [24, 28],
    }).flatMap(([size, [px, lh]]) =>
      ["default", "strong"].map((weight) =>
        variant(
          { size, weight, color },
          frame("root", [
            {
              ...text(
                "content",
                "Heading",
                px,
                weight === "strong" ? 700 : 500,
                token,
                lh,
              ),
              textStyle: `text-heading-${size}-${weight}`,
              bindings: {
                ...(token ? { fills: token } : {}),
                fontSize: `typography-font-size-${size}`,
                lineHeight: `typography-line-height-${{ 16: "tight", 20: "wide", 24: "loose", 28: "extra-loose" }[lh]}`,
                fontWeight: `typography-font-weight-${weight === "strong" ? "bold" : "medium"}`,
              },
            },
          ]),
        ),
      ),
    ),
    color === "x-weak" ? "partial" : "supported",
    color === "x-weak"
      ? [
          "Public x-weak prop has no matching SCSS rule in this release; inherited parent color is context-dependent.",
        ]
      : [],
    {
      size: ["medium", "large", "x-large", "xx-large"],
      weight: ["default", "strong"],
      color: [color],
    },
    ["HTML heading level and aria semantics; arbitrary children text."],
  );
// Divider is 1px; 4px dash / 3px gap; margins are source literals 16/28/48px, not spacing-medium.
for (const direction of ["horizontal", "vertical"])
  for (const style of ["solid", "dashed", "noline"])
    add(
      "Divider",
      direction + "-" + style,
      Object.entries({ none: 0, small: 16, medium: 28, large: 48 }).flatMap(
        ([padding, margin]) =>
          Object.entries({
            weak: "color-line-subtle",
            default: "color-line-mid",
            strong: "color-line-strong",
          }).map(([color, token]) => {
            const horizontal = direction === "horizontal";
            const line =
              style === "noline"
                ? []
                : style === "solid"
                  ? [
                      rect(
                        "line",
                        horizontal ? 280 : 1,
                        horizontal ? 1 : 280,
                        token,
                      ),
                    ]
                  : Array.from({ length: 40 }, (_, i) =>
                      rect(
                        "dash-" + i,
                        horizontal ? 4 : 1,
                        horizontal ? 1 : 4,
                        token,
                      ),
                    );
            return variant(
              { direction, variant: style, padding, color },
              frame(
                "root",
                style === "dashed"
                  ? [
                      frame("line", line, {
                        layout: horizontal ? "HORIZONTAL" : "VERTICAL",
                        gap: 3,
                      }),
                    ]
                  : line,
                {
                  layout: horizontal ? "VERTICAL" : "HORIZONTAL",
                  paddingTop: horizontal ? margin : 0,
                  paddingBottom: horizontal ? margin : 0,
                  paddingLeft: horizontal ? 0 : margin,
                  paddingRight: horizontal ? 0 : margin,
                },
              ),
            );
          }),
      ),
      "supported",
      [],
      {
        direction: [direction],
        variant: [style],
        padding: ["none", "small", "medium", "large"],
        color: ["weak", "default", "strong"],
      },
      [
        "Length is container-driven; 280px is editable sample extent. as/decorative only affect DOM semantics.",
      ],
    );
for (const variantName of ["progress", "success", "danger"])
  add(
    "LoadingCircle",
    variantName,
    Object.entries({
      "xx-small": 12,
      "x-small": 16,
      small: 20,
      medium: 32,
      large: 64,
    }).map(([size, px]) =>
      variant(
        { variant: variantName, size },
        frame("root", [
          {
            id: "ring",
            kind: "ellipse",
            name: "ring",
            width: px,
            height: px,
            arcData: {
              startingAngle: -Math.PI / 4,
              endingAngle: (5 * Math.PI) / 4,
              innerRadius: (px - 4) / px,
            },
            bindings: {
              fills:
                variantName === "success"
                  ? "color-success-default"
                  : variantName === "danger"
                    ? "color-error-default"
                    : "color-highlight-default",
            },
          },
        ]),
      ),
    ),
    "supported",
    [],
    {
      variant: [variantName],
      size: ["xx-small", "x-small", "small", "medium", "large"],
    },
    [
      "Continuous 1s rotation is represented by a static native ring pose; no animation execution in library component.",
    ],
  );
for (const intent of ["default", "positive", "negative"])
  for (const rounded of [false, true])
    add(
      "LoadingBar",
      intent + "-" + (rounded ? "rounded" : "square"),
      Object.entries({ small: 4, medium: 8, large: 12, "x-large": 16 }).flatMap(
        ([size, h]) =>
          [0, 25, 50, 75, 100, null].map((value) => {
            const color = {
              default: "highlight",
              positive: "success",
              negative: "error",
            }[intent];
            const width = 280;
            return variant(
              {
                variant: intent,
                rounded,
                size,
                value: value === null ? "indeterminate" : value,
              },
              frame(
                "root",
                [
                  rect(
                    "indicator",
                    Math.max(
                      0.01,
                      width * (value === null ? 0.4 : value / 100),
                    ),
                    h,
                    `color-${color}-default`,
                    { visible: value !== 0 },
                  ),
                ],
                {
                  width,
                  height: h,
                  clipContent: true,
                  radius: rounded ? 4 : 0,
                  bindings: {
                    fills: `color-container-${color}-default`,
                    ...(rounded
                      ? { cornerRadius: "border-radius-medium" }
                      : {}),
                  },
                },
              ),
            );
          }),
      ),
      "partial",
      [
        "All finite size/intent/rounding axes covered. Numeric value/max are continuous; native component offers 0/25/50/75/100 sample proportions and an indeterminate 40% animation pose. Resize indicator for other values.",
      ],
      {
        variant: [intent],
        rounded: [String(rounded)],
        size: ["small", "medium", "large", "x-large"],
        value: ["0", "25", "50", "75", "100", "indeterminate"],
      },
      [
        "1s indeterminate animation, 150ms transition, getValueLabel and aria are runtime-only.",
      ],
    );
// Label CSS has context-sensitive peer states; these are exposed as explicit native variants.
for (const labelVariant of ["default", "strong"])
  add(
    "Label",
    labelVariant,
    ["default", "hover", "checked", "indeterminate", "disabled"].flatMap(
      (state) =>
        [false, true].map((required) => {
          const w = ["checked", "indeterminate"].includes(state)
            ? 500
            : labelVariant === "strong"
              ? 700
              : 400;
          const color =
            state === "disabled"
              ? "color-disabled-default"
              : state === "hover"
                ? "color-primary-default"
                : "color-secondary-default";
          const children = [
            text(
              "content",
              "Label",
              14,
              w,
              color,
              labelVariant === "strong" ? 16 : 18,
            ),
          ];
          if (required)
            children.push(
              text(
                "required",
                "*",
                13,
                500,
                state === "hover" ? "color-error-hover" : "color-error-default",
                16,
              ),
            );
          return variant(
            { variant: labelVariant, state, required },
            frame("root", children, { gap: 0 }),
          );
        }),
    ),
    "partial",
    [
      "All finite prop and peer states are exposed; source invisible-medium label width reservation and -1px required-asterisk baseline offset still need native geometry support.",
    ],
    {
      variant: [labelVariant],
      state: ["default", "hover", "checked", "indeterminate", "disabled"],
      required: ["false", "true"],
    },
    [
      "htmlFor/click target handling and hidden duplicate text are browser semantics.",
    ],
  );
// EditableText has source-defined 6px block padding, 12px inline padding and 1px transparent/strong border.
add(
  "EditableText",
  "",
  ["default", "hover", "editing", "keyboard-focus"].flatMap((state) =>
    [false, true].map((hugWidth) =>
      variant(
        { state, hugWidth },
        frame("root", [text("content", "Editable text", 14, 400)], {
          ...(hugWidth ? {} : { width: 280 }),
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 12,
          paddingRight: 12,
          radius: 4,
          strokeWeight: 1,
          bindings: {
            cornerRadius: "border-radius-medium",
            ...(state === "default" ? {} : { strokes: "color-line-strong" }),
          },
        }),
      ),
    ),
  ),
  "partial",
  [
    "Source box metrics and visible hover/editing borders covered. Keyboard focus requires two source rings (2px surface, 6px focus) and clipping/ellipsis remain unsupported. Inherited arbitrary asChild typography is not forced to a token.",
  ],
  {
    state: ["default", "hover", "editing", "keyboard-focus"],
    hugWidth: ["false", "true"],
  },
  ["Plaintext selection, Enter/blur commit, callbacks and browser caret."],
);
for (const family of ["Box", "Section"])
  add(
    family,
    "",
    ["none", "block", "inline-block", "inline"].map((display) =>
      variant(
        { display },
        frame("root", [text("content", "Content")], {
          visible: display !== "none",
          width: display === "block" ? 280 : undefined,
        }),
      ),
    ),
    "partial",
    [
      "No invented surface, border, radius or padding; source is unstyled layout wrapper. Shared LayoutComponentProps accept arbitrary responsive dimensions, positioning, overflow, margins and CSS strings; native layout controls expose a subset. Inline formatting contexts are approximate.",
    ],
    { display: ["none", "block", "inline-block", "inline"] },
    ["Polymorphic HTML tag and aria attributes."],
  );
for (const direction of ["row", "row-reverse", "column", "column-reverse"])
  add(
    "Flex",
    direction,
    ["flex-start", "center", "flex-end", "stretch", "baseline"].flatMap(
      (align) =>
        [
          "flex-start",
          "center",
          "flex-end",
          "space-between",
          "space-around",
          "space-evenly",
        ].map((justify) => {
          const children = [text("first", "First"), text("second", "Second")];
          if (direction.endsWith("reverse")) children.reverse();
          return variant(
            { direction, align, justify },
            frame("root", children, {
              layout: direction.startsWith("row") ? "HORIZONTAL" : "VERTICAL",
              width: 280,
              height: 100,
              counterAxisAlignItems:
                { center: "CENTER", "flex-end": "MAX", baseline: "BASELINE" }[
                  align
                ] ?? "MIN",
              primaryAxisAlignItems:
                {
                  "flex-start": "MIN",
                  center: "CENTER",
                  "flex-end": "MAX",
                  "space-between": "SPACE_BETWEEN",
                }[justify] ?? "MIN",
            }),
          );
        }),
    ),
    "partial",
    [
      "Direction and explicit alignment/justification permutations exposed. CSS stretch, space-around/space-evenly and wrapping/reverse-wrap require native layout parity; arbitrary responsive gap/dimensions are edited with native controls, not finite variants.",
    ],
    {
      direction: [direction],
      align: ["flex-start", "center", "flex-end", "stretch", "baseline"],
      justify: [
        "flex-start",
        "center",
        "flex-end",
        "space-between",
        "space-around",
        "space-evenly",
      ],
    },
    ["Responsive CSS media-query evaluation and arbitrary children."],
  );
const gridVariants = [];
for (const flow of ["row", "column", "dense", "row-dense", "column-dense"])
  for (const columns of [1, 2, 3, 4]) {
    const rows = Array.from({ length: 2 }, (_, row) =>
      frame(
        "row-" + row,
        Array.from({ length: columns }, (_, col) =>
          frame(
            "cell-" + col,
            [text("content", `Item ${row * columns + col + 1}`)],
            { width: 100 },
          ),
        ),
      ),
    );
    gridVariants.push(
      variant({ flow, columns }, frame("root", rows, { layout: "VERTICAL" })),
    );
  }
add(
  "Grid",
  "",
  gridVariants,
  "partial",
  [
    "Native Auto Layout specimen covers 1–4 columns; source accepts arbitrary CSS track strings, rows, auto flow/dense packing, alignment and responsive gaps. CSS grid algorithm cannot be represented by fixed nested rows.",
  ],
  {
    flow: ["row", "column", "dense", "row-dense", "column-dense"],
    columns: ["1", "2", "3", "4"],
  },
  ["CSS grid runtime track computation and responsive media queries."],
);
for (const gutter of ["auto", "stable", "stable-horizontal", "stable-vertical"])
  add(
    "ScrollArea",
    gutter,
    ["none", "tight", "compact", "comfortable", "spacious"].flatMap((padding) =>
      [false, true].map((showShadow) => {
        const [py, px] = {
          none: [0, 0],
          tight: [8, 8],
          compact: [8, 16],
          comfortable: [16, 24],
          spacious: [24, 40],
        }[padding];
        return variant(
          { scrollbarGutter: gutter, padding, showShadow },
          frame(
            "root",
            [
              frame("viewport", [text("content", "Scrollable content")], {
                width: 280,
                height: 120,
                paddingTop: py,
                paddingBottom:
                  gutter === "stable" || gutter === "stable-horizontal"
                    ? 10
                    : py,
                paddingLeft: px,
                paddingRight:
                  gutter === "stable" || gutter === "stable-vertical" ? 10 : px,
              }),
              frame(
                "vertical-scrollbar",
                [
                  rect(
                    "thumb",
                    6,
                    40,
                    "color-container-secondary-on-secondary-container",
                    { radius: 10 },
                  ),
                ],
                {
                  width: 10,
                  height: 120,
                  padding: 2,
                  bindings: { fills: "color-container-secondary-default" },
                },
              ),
            ],
            { width: 290, height: 120, clipContent: true },
          ),
        );
      }),
    ),
    "partial",
    [
      "Source padding/gutter and 10px scrollbar/2px inset/6px thumb metrics represented. showShadow inner-shadow, horizontal scrollbar/corner, hover/scroll/type visibility and browser overflow behavior remain uncovered.",
    ],
    {
      scrollbarGutter: [gutter],
      padding: ["none", "tight", "compact", "comfortable", "spacious"],
      showShadow: ["false", "true"],
    },
    ["Scroll offset, drag thumb, overflow sizing and theme direction."],
  );
export default out;
