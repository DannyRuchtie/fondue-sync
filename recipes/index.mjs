/** Reviewed native-layer recipes for released Fondue. No runtime DOM capture or legacy catalog. */
import fs from "node:fs";
import path from "node:path";
const base = new URL("../.cache/release/", import.meta.url);
const tok = {
  surface: "color-surface-default",
  text: "color-primary-default",
  muted: "color-secondary-default",
  line: "color-line-mid",
  primary: "color-primary-default",
};
const text = (id, value = "Label", size = 14, color = tok.text) => ({
  id,
  kind: "text",
  name: id,
  text: value,
  fontSize: size,
  textStyle: {
    12: "text-body-x-small-default",
    13: "text-body-small-default",
    14: "text-body-medium-default",
    16: "text-body-large-default",
    20: "text-heading-x-large-default",
    24: "text-heading-xx-large-default",
  }[size],
  bindings: {
    fills: color,
    ...({
      12: "typography-font-size-x-small",
      13: "typography-font-size-small",
      14: "typography-font-size-medium",
      16: "typography-font-size-large",
      20: "typography-font-size-x-large",
      24: "typography-font-size-xx-large",
    }[size]
      ? {
          fontSize: {
            12: "typography-font-size-x-small",
            13: "typography-font-size-small",
            14: "typography-font-size-medium",
            16: "typography-font-size-large",
            20: "typography-font-size-x-large",
            24: "typography-font-size-xx-large",
          }[size],
        }
      : {}),
  },
});
const rect = (id, w, h, color = tok.line, radius = 0) => ({
  id,
  kind: "rectangle",
  name: id,
  width: w,
  height: h,
  radius,
  bindings: { fills: color },
});
const dot = (id, size, color = tok.primary) => ({
  ...rect(id, size, size, color),
  kind: "ellipse",
});
const frame = (id, children = [], opts = {}) => ({
  id,
  kind: "frame",
  name: id,
  layout: "HORIZONTAL",
  gap: 8,
  padding: 0,
  children,
  ...opts,
});
const col = (id, children = [], opts = {}) =>
  frame(id, children, { layout: "VERTICAL", ...opts });
const surface = (id, children = [], opts = {}) =>
  col(id, children, {
    padding: 16,
    radius: 4,
    bindings: {
      fills: tok.surface,
      strokes: tok.line,
      cornerRadius: "border-radius-medium",
    },
    ...opts,
  });
const svg = (id, body, w = 16, h = 16) => ({
  id,
  kind: "svg",
  name: id,
  width: w,
  height: h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`,
});
const icon = (id, iconId) => ({
  id,
  kind: "instance",
  name: id,
  iconId,
  width: 16,
  height: 16,
});
const chevron = () => icon("chevron", "icon:caret-down");
const cross = () => icon("dismiss", "icon:cross");
const check = () => icon("check", "icon:check-mark");
const rule = (id) => rect(id, 280, 1, "color-line-subtle");
const label = (value) => text("label", value);
const input = (value = "Enter text", state = "default", multiline = false) =>
  surface(
    "field",
    [
      text(
        "value",
        value,
        14,
        state === "disabled" ? "color-disabled-default" : tok.text,
      ),
    ],
    {
      width: 280,
      height: multiline ? 96 : 36,
      padding: 8,
      bindings: {
        fills:
          state === "disabled"
            ? "color-container-disabled-default"
            : tok.surface,
        strokes: state === "error" ? "color-error-default" : tok.line,
        cornerRadius: "border-radius-medium",
      },
    },
  );
const button = (
  value = "Button",
  variant = "default",
  size = "medium",
  state = "default",
) => {
  const colors = {
    default: "primary",
    positive: "success",
    negative: "error",
    danger: "error",
    loud: "highlight",
  };
  const c = colors[variant];
  const disabled = state === "disabled";
  return frame(
    "button-" + value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    [
      {
        ...text(
          "label",
          value,
          { small: 13, medium: 14, large: 16 }[size],
          disabled
            ? "color-container-disabled-on-disabled-container"
            : `color-${c}-on-${c}`,
        ),
        fontWeight: 500,
        textStyle: `text-body-${size}-strong`,
      },
    ],
    {
      height: { small: 24, medium: 36, large: 48 }[size],
      padding: 0,
      paddingLeft: { small: 8, medium: 12, large: 16 }[size],
      paddingRight: { small: 8, medium: 12, large: 16 }[size],
      gap: size === "large" ? 8 : 6,
      radius: 4,
      bindings: {
        fills: disabled
          ? "color-container-disabled-default"
          : `color-${c}-${state === "hover" ? "hover" : state === "active" ? "active" : "default"}`,
        cornerRadius: "border-radius-medium",
      },
    },
  );
};
const toggle = (checked = false, size = "medium") => {
  const [w, h] = { small: [24, 12], medium: [32, 16], large: [36, 20] }[size];
  const spacer = frame("offset", [], { width: w - h, height: 1 });
  return frame(
    "track",
    checked
      ? [spacer, dot("thumb", h, tok.surface)]
      : [dot("thumb", h, tok.surface), spacer],
    {
      width: w,
      height: h,
      gap: 0,
      radius: h / 2,
      bindings: {
        fills: checked ? tok.primary : "color-container-secondary-default",
        strokes: tok.line,
      },
    },
  );
};
const checkbox = (checked) =>
  frame("checkbox", checked ? [check()] : [], {
    width: 16,
    height: 16,
    radius: 4,
    bindings: {
      fills: checked ? tok.primary : tok.surface,
      strokes: tok.line,
      cornerRadius: "border-radius-medium",
    },
  });
const menuItem = (id, value, selected = false) =>
  frame(id, [text("label", value)], {
    width: 240,
    padding: 8,
    height: 36,
    bindings: { fills: selected ? "color-surface-hover" : tok.surface },
  });
const variants = (axis, values, fn) =>
  values.map((value) => ({
    props: { [axis]: String(value) },
    root: fn(value),
  }));
const recipes = [];
function sourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? sourceFiles(path.join(dir, e.name))
        : /\.(tsx?|scss|css|json)$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    )
    .sort();
}
function add(
  name,
  vs,
  limitations = [],
  pkg = "components",
  sourceName = name,
) {
  const folder = `packages/${pkg}/src/components/${sourceName}`;
  const files = sourceFiles(new URL(folder + "/", base).pathname);
  recipes.push({
    id: `${pkg}/${name}`,
    name,
    package: `@frontify/fondue/${pkg}`,
    source: files.map((f) => path.relative(base.pathname, f)),
    status: "partial",
    limitations: [
      "Static editable design representation; runtime behavior and browser accessibility semantics remain in React.",
      "Not every public prop, compound export or story permutation is represented; see variant properties for exact supported states.",
      ...limitations,
    ],
    variants: vs.map((v, i) => ({
      id:
        Object.entries(v.props)
          .map(([k, val]) => `${k}=${val}`)
          .join(";") || "default",
      ...v,
    })),
  });
}
for (const intent of ["default", "positive", "negative", "danger", "loud"]) {
  add(
    "Button",
    ["small", "medium", "large"].flatMap((size) =>
      ["default", "hover", "active", "disabled"].map((state) => ({
        props: { size, state, emphasis: "strong" },
        root: button("Button", intent, size, state),
      })),
    ),
    [
      "Intent is " +
        intent +
        ". Default/weak emphasis, square aspect, full rounding, icon swapping and focus ring remain uncovered.",
    ],
  );
  recipes.at(-1).id += "/" + intent;
  recipes.at(-1).name = "Button/" + intent;
}

add(
  "TextInput",
  variants("state", ["default", "error", "disabled"], (v) =>
    input("Enter text", v),
  ),
  ["Prefix/suffix slot combinations and success state remain uncovered."],
);
add(
  "Textarea",
  variants("state", ["default", "error", "disabled"], (v) =>
    input("Enter a description", v, true),
  ),
  ["Browser resize handle and auto-sizing remain uncovered."],
);
add(
  "Switch",
  ["small", "medium", "large"].flatMap((size) =>
    [false, true].map((checked) => ({
      props: { size, checked: String(checked) },
      root: toggle(checked, size),
    })),
  ),
  ["Disabled and focus states remain uncovered."],
);
add(
  "Checkbox",
  variants("checked", [false, true], (v) => checkbox(v)),
  ["Indeterminate, disabled and highlight variants remain uncovered."],
);
add(
  "RadioList",
  variants("selected", ["first", "second"], (selected) =>
    col(
      "list",
      ["First option", "Second option"].map((v, i) =>
        frame(`option-${i}`, [
          frame(
            "radio",
            selected === (i ? "second" : "first") ? [dot("indicator", 6)] : [],
            {
              width: 16,
              height: 16,
              padding: 4,
              radius: 8,
              bindings: { strokes: tok.line },
            },
          ),
          text("label", v),
        ]),
      ),
    ),
  ),
  [
    "Native radio indicator uses 16px circle and 6px selected dot from the released stylesheet.",
  ],
);
add(
  "Badge",
  variants(
    "variant",
    ["default", "positive", "negative", "highlight", "warning"],
    (variant) => {
      const c = {
        default: "primary",
        positive: "success",
        negative: "error",
        highlight: "highlight",
        warning: "warning",
      }[variant];
      return frame(
        "badge",
        [text("label", "Status", 13, `color-${c}-on-${c}`)],
        {
          padding: 4,
          paddingLeft: 8,
          paddingRight: 8,
          radius: 9999,
          bindings: {
            fills: `color-${c}-default`,
            paddingLeft: "spacing-x-small",
            paddingRight: "spacing-x-small",
            paddingTop: "spacing-xx-small",
            paddingBottom: "spacing-xx-small",
            itemSpacing: "spacing-xx-small",
          },
        },
      );
    },
  ),
  ["Weak emphasis, status dot and dismiss combinations remain uncovered."],
);
add(
  "Tag",
  variants("variant", ["default", "highlight"], (v) =>
    frame("tag", [text("label", "Design", 13), cross()], {
      padding: 4,
      radius: 4,
      bindings: {
        fills:
          v === "highlight"
            ? "color-container-highlight-default"
            : "color-container-secondary-default",
        cornerRadius: "border-radius-medium",
      },
    }),
  ),
  ["Strong/weak emphasis, small size and selection states remain uncovered."],
);
for (const name of ["Text", "Heading"])
  add(
    name,
    variants(
      "size",
      name === "Heading"
        ? ["medium", "large", "x-large", "xx-large"]
        : ["x-small", "small", "medium", "large"],
      (size) =>
        col("typography", [
          {
            ...text(
              "content",
              name === "Heading" ? "A clear heading" : "Readable body text",
              {
                "x-small": 12,
                small: 13,
                medium: 14,
                large: 16,
                "x-large": 20,
                "xx-large": 24,
              }[size],
            ),
            textStyle: `text-${name === "Heading" ? "heading" : "body"}-${size}-default`,
            fontWeight: name === "Heading" ? 500 : 400,
          },
        ]),
    ),
    [
      "Color and weight axes remain uncovered; rendered typography requires source font installation.",
    ],
  );
add(
  "Label",
  variants("variant", ["default", "strong"], (v) =>
    frame("label", [
      {
        ...text("content", "Email address"),
        fontWeight: v === "strong" ? 500 : 400,
        textStyle: `text-body-medium-${v === "strong" ? "strong" : "default"}`,
      },
      text("required", "*", 14, "color-error-default"),
    ]),
  ),
);
add(
  "Link",
  variants("state", ["default", "hover"], (v) =>
    col("link", [
      text(
        "content",
        "Learn more",
        14,
        `color-primary-${v === "hover" ? "hover" : "default"}`,
      ),
      rect("underline", 75, 1),
    ]),
  ),
  [
    "Beta API. Underline is an editable native line; visited and focus remain uncovered.",
  ],
);
add(
  "EditableText",
  variants("editing", [false, true], (v) =>
    v ? input("Project name") : col("display", [text("value", "Project name")]),
  ),
);
add(
  "Divider",
  variants("direction", ["horizontal", "vertical"], (v) =>
    col("divider", [
      rect(
        "line",
        v === "horizontal" ? 240 : 1,
        v === "horizontal" ? 1 : 64,
        "color-line-mid",
      ),
    ]),
  ),
  ["Dashed/noline and padding variants remain uncovered."],
);
add(
  "LoadingBar",
  variants("size", ["small", "medium", "large", "x-large"], (s) =>
    frame(
      "track",
      [
        rect(
          "progress",
          120,
          { small: 4, medium: 8, large: 12, "x-large": 16 }[s],
          tok.primary,
          4,
        ),
      ],
      {
        width: 240,
        height: { small: 4, medium: 8, large: 12, "x-large": 16 }[s],
        radius: 4,
        bindings: { fills: "color-container-secondary-default" },
      },
    ),
  ),
  [
    "Determinate 50% specimen only; animation and value-driven resizing are runtime behavior.",
  ],
);
add(
  "LoadingCircle",
  variants("size", ["small", "medium", "large", "x-large", "xx-large"], (s) =>
    col(
      "spinner",
      [
        {
          ...svg(
            "arc",
            '<circle cx="16" cy="16" r="12" fill="none" stroke="#d5d6d6" stroke-width="3"/><path d="M16 4a12 12 0 0 1 12 12" fill="none" stroke="#202020" stroke-width="3"/>',
            32,
            32,
          ),
          width: {
            small: 12,
            medium: 16,
            large: 20,
            "x-large": 32,
            "xx-large": 64,
          }[s],
          height: {
            small: 12,
            medium: 16,
            large: 20,
            "x-large": 32,
            "xx-large": 64,
          }[s],
        },
      ],
      {
        width: {
          small: 12,
          medium: 16,
          large: 20,
          "x-large": 32,
          "xx-large": 64,
        }[s],
        height: {
          small: 12,
          medium: 16,
          large: 20,
          "x-large": 32,
          "xx-large": 64,
        }[s],
      },
    ),
  ),
  ["Static vector arc; spinner sizing and rotation need native visual QA."],
);
add(
  "Slider",
  variants("value", ["25", "50", "75"], (v) =>
    col("slider", [
      frame(
        "track",
        [
          rect("filled", Number(v) * 2, 4, tok.primary),
          dot("thumb", 16, tok.surface),
          rect(
            "remaining",
            200 - Number(v) * 2,
            4,
            "color-container-secondary-default",
          ),
        ],
        { gap: 0 },
      ),
      text("value", `${v}%`, 12),
    ]),
  ),
  ["Static single-thumb specimen; range, focus and disabled remain uncovered."],
);
add(
  "SegmentedControl",
  variants("value", ["list", "grid"], (v) =>
    frame(
      "control",
      ["list", "grid"].map((option) =>
        frame(option, [text("label", option === "list" ? "List" : "Grid")], {
          padding: 8,
          height: 34,
          bindings: {
            fills:
              option === v ? tok.surface : "color-container-secondary-default",
          },
        }),
      ),
      {
        height: 36,
        padding: 1,
        gap: 0,
        radius: 4,
        bindings: {
          strokes: tok.line,
          fills: "color-container-secondary-default",
        },
      },
    ),
  ),
);
add(
  "SplitButton",
  variants("disabled", [false, true], (v) =>
    frame(
      "split",
      [
        button("Create", "default", "medium", v ? "disabled" : "default"),
        frame("menu-trigger", [chevron()], {
          padding: 10,
          height: 36,
          bindings: {
            fills: v ? "color-container-disabled-default" : tok.primary,
          },
        }),
      ],
      { gap: 1 },
    ),
  ),
  ["Menu-open state and emphasis variants remain uncovered."],
);
add(
  "Notice",
  variants(
    "variant",
    ["default", "highlight", "positive", "danger", "warning"],
    (v) => {
      const c = {
        default: "secondary",
        highlight: "highlight",
        positive: "success",
        danger: "error",
        warning: "warning",
      }[v];
      return frame(
        "notice",
        [
          dot("status", 16, v === "default" ? tok.muted : `color-${c}-default`),
          text("message", "Changes saved"),
          cross(),
        ],
        {
          padding: 12,
          height: 36,
          radius: 4,
          bindings: {
            fills:
              v === "default"
                ? "color-surface-dim"
                : `color-container-${c}-default`,
          },
        },
      );
    },
  ),
  [
    "Default emphasis, medium size specimen; large/strong/weak combinations remain uncovered.",
  ],
);
add(
  "Accordion",
  variants("expanded", [false, true], (expanded) =>
    col("accordion", [
      frame("header", [text("title", "Brand information"), chevron()], {
        padding: 12,
        width: 320,
      }),
      ...(expanded
        ? [
            col(
              "content",
              [text("description", "Keep your brand consistent.")],
              { padding: 12 },
            ),
          ]
        : []),
      rule("separator"),
    ]),
  ),
);
add(
  "Card",
  variants("selected", [false, true], (selected) =>
    surface(
      "card",
      [
        rect("banner", 240, 112, "color-surface-dim"),
        col(
          "content",
          [
            {
              ...text("title", "Brand assets", 16),
              fontWeight: 500,
              textStyle: "text-heading-large-default",
            },
            text("description", "Explore approved resources", 12, tok.muted),
          ],
          { padding: 12 },
        ),
        frame(
          "footer",
          [checkbox(selected), text("selection", "Select collection", 12)],
          { padding: 12 },
        ),
      ],
      {
        padding: 0,
        width: 240,
        bindings: {
          fills: tok.surface,
          strokes: selected ? tok.primary : tok.line,
          cornerRadius: "border-radius-large",
        },
      },
    ),
  ),
  [
    "Released public Card reconciled explicitly even though SDK metadata omits it; banner is an empty asset slot, not a screenshot.",
  ],
);
add(
  "Dialog",
  variants("size", ["medium", "large"], (s) =>
    surface(
      "dialog",
      [
        frame("header", [text("title", "Publish changes", 20), cross()]),
        text("description", "Make the latest changes available."),
        rule("divider"),
        frame("actions", [button("Cancel"), button("Publish")]),
      ],
      { width: s === "large" ? 560 : 400, padding: 24, radius: 8 },
    ),
  ),
  [
    "Backdrop and focus trap remain runtime concerns; dialog content is editable.",
  ],
);
add(
  "Flyout",
  variants("open", [true], () =>
    surface(
      "flyout",
      [
        text("title", "Asset details", 16),
        rule("separator"),
        text("body", "Review metadata and permissions."),
        frame("footer", [button("Done")]),
      ],
      { width: 320 },
    ),
  ),
  [
    "Anchoring, arrow placement and collision handling remain runtime concerns.",
  ],
);
add(
  "Tooltip",
  variants("side", ["top", "bottom"], () =>
    surface(
      "tooltip",
      [text("content", "Copy link", 12, "color-primary-on-primary")],
      { padding: 8, bindings: { fills: tok.primary } },
    ),
  ),
  ["Side is cataloged, but arrow geometry and placement remain uncovered."],
);
add(
  "Dropdown",
  variants("open", [false, true], (open) =>
    col("dropdown", [
      frame("trigger", [button("Actions"), chevron()]),
      ...(open
        ? [
            surface(
              "menu",
              [
                menuItem("rename", "Rename"),
                menuItem("duplicate", "Duplicate"),
                rule("separator"),
                menuItem("delete", "Delete"),
              ],
              { padding: 4 },
            ),
          ]
        : []),
    ]),
  ),
  ["Menu keyboard behavior, nested groups and submenus remain uncovered."],
);
add(
  "Select",
  variants("open", [false, true], (open) =>
    col("select", [
      surface(
        "trigger",
        [frame("value", [text("selection", "Choose a category"), chevron()])],
        { height: 36, padding: 8, width: 280 },
      ),
      ...(open
        ? [
            surface(
              "options",
              [
                menuItem("all", "All assets", true),
                menuItem("images", "Images"),
                menuItem("documents", "Documents"),
              ],
              { padding: 4 },
            ),
          ]
        : []),
    ]),
  ),
  ["Multiselect chips, async loading and search states remain uncovered."],
);
add(
  "DatePicker",
  variants("open", [false, true], (open) =>
    col("date-picker", [
      input("Oct 30, 2026"),
      ...(open
        ? [
            surface(
              "calendar",
              [
                frame("month", [
                  text("previous", "‹"),
                  text("month", "October 2026"),
                  text("next", "›"),
                ]),
                frame(
                  "weekdays",
                  "MTWTFSS".split("").map((v, i) => text(`day-${i}`, v, 12)),
                ),
                ...Array.from({ length: 5 }, (_, week) =>
                  frame(
                    `week-${week}`,
                    Array.from({ length: 7 }, (_, day) =>
                      frame(
                        `cell-${day}`,
                        [
                          text(
                            "date",
                            String(
                              week * 7 + day + 1 > 31 ? "" : week * 7 + day + 1,
                            ),
                            12,
                          ),
                        ],
                        { width: 24, height: 24 },
                      ),
                    ),
                    { gap: 4 },
                  ),
                ),
              ],
              { padding: 12 },
            ),
          ]
        : []),
    ]),
  ),
  [
    "Calendar is a static illustrative month; date arithmetic, range selection, locale and timezone are runtime concerns.",
  ],
);
add(
  "ColorPicker",
  variants("format", ["hex", "rgb"], (format) =>
    surface(
      "color-picker",
      [
        svg(
          "saturation",
          '<defs><linearGradient id="s"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#ff0000"/></linearGradient></defs><rect width="224" height="140" fill="url(#s)"/>',
          224,
          140,
        ),
        rect("hue", 224, 12, "color-error-default", 6),
        frame("values", [
          text("format", format.toUpperCase(), 12),
          input(format === "hex" ? "#FF0000" : "255, 0, 0"),
        ]),
      ],
      { width: 256, padding: 16 },
    ),
  ),
  [
    "Editable SVG gradient is a static red specimen; hue/saturation/alpha interactions and swatch history remain uncovered.",
  ],
);
add(
  "AssetInput",
  variants("state", ["empty", "populated"], (state) =>
    surface(
      "asset-input",
      state === "empty"
        ? [
            svg(
              "upload",
              '<path d="M8 11V2m-3 3 3-3 3 3M2 11v3h12v-3" fill="none" stroke="#202020"/>',
            ),
            text("prompt", "Drop an asset or browse"),
            text("hint", "Images, videos and documents", 12, tok.muted),
          ]
        : [
            rect("thumbnail-slot", 80, 64, "color-surface-dim"),
            text("filename", "Brand guidelines.pdf"),
            button("Replace"),
          ],
      { width: 320, padding: 24 },
    ),
  ),
  [
    "Upload progress, dragover and validation states remain uncovered; thumbnail is a native slot.",
  ],
);
add(
  "Table",
  variants("density", ["default", "compact"], (d) =>
    surface(
      "table",
      [
        frame(
          "header",
          ["Name", "Type", "Modified"].map((s, i) =>
            frame(`head-${i}`, [text("label", s, 12, tok.muted)], {
              width: 120,
              padding: 8,
            }),
          ),
        ),
        rule("header-rule"),
        ...["Brand guidelines", "Logo collection", "Campaign assets"].map(
          (name, i) =>
            col(`row-${i}`, [
              frame(
                "cells",
                [name, i === 0 ? "Document" : "Collection", "Today"].map(
                  (s, j) =>
                    frame(`cell-${j}`, [text("value", s, 12)], {
                      width: 120,
                      padding: d === "compact" ? 4 : 8,
                    }),
                ),
              ),
              rule("row-rule"),
            ]),
        ),
      ],
      { padding: 0 },
    ),
  ),
  [
    "Density is a design specimen axis; sorting, sticky columns, virtualized rows, selection and full cell APIs remain uncovered.",
  ],
);
add(
  "Tabs",
  variants("value", ["overview", "assets"], (selected) =>
    col("tabs", [
      frame(
        "tab-list",
        ["overview", "assets"].map((value) =>
          col(
            value,
            [
              text("label", value === "overview" ? "Overview" : "Assets"),
              rect(
                "indicator",
                76,
                3,
                value === selected ? tok.primary : tok.surface,
              ),
            ],
            { padding: 8 },
          ),
        ),
      ),
      rule("separator"),
      text(
        "content",
        selected === "overview"
          ? "Collection overview"
          : "Approved brand assets",
      ),
    ]),
  ),
);
add(
  "OrderableList",
  variants("state", ["default", "dragging"], (state) =>
    col(
      "list",
      ["Brand identity", "Photography", "Typography"].map((value, i) =>
        surface(
          `item-${i}`,
          [frame("row", [text("drag-handle", "⠿"), text("label", value)])],
          {
            padding: 12,
            width: 300,
            bindings: {
              fills:
                state === "dragging" && i === 1
                  ? "color-surface-hover"
                  : tok.surface,
              strokes: tok.line,
            },
          },
        ),
      ),
    ),
  ),
  [
    "Dragging is a static specimen; reorder events, drop targets and keyboard sorting remain runtime.",
  ],
);
add(
  "Tree",
  variants("expanded", [false, true], (expanded) =>
    col("tree", [
      frame(
        "folder",
        [
          chevron(),
          svg(
            "folder",
            '<path d="M1 4h5l2 2h7v8H1z" fill="none" stroke="#202020"/>',
          ),
          text("label", "Brand assets"),
        ],
        { height: 32, padding: 8 },
      ),
      ...(expanded
        ? ["Logos", "Photography"].map((value, i) =>
            frame(`child-${i}`, [text("indent", "  "), text("label", value)], {
              height: 32,
              padding: 8,
            }),
          )
        : []),
    ]),
  ),
  [
    "Beta API. Multi-selection, actions, drag/drop and full compound component states remain uncovered.",
  ],
);
add(
  "ScrollArea",
  variants("orientation", ["vertical", "horizontal"], (orientation) =>
    frame(
      "scroll-area",
      [
        col(
          "viewport",
          [
            text("first", "Guidelines"),
            text("second", "Assets"),
            text("third", "Resources"),
          ],
          { width: 240, height: 120 },
        ),
        rect(
          "scrollbar",
          orientation === "vertical" ? 4 : 80,
          orientation === "vertical" ? 48 : 4,
          "color-secondary-default",
          2,
        ),
      ],
      { width: 256, height: 128 },
    ),
  ),
  [
    "Static scroll thumb; overflow clipping and horizontal geometry need native QA.",
  ],
);
add(
  "Section",
  variants("spacing", ["medium", "large"], (size) =>
    col(
      "section",
      [
        text("heading", "Brand resources", 20),
        text("content", "Keep approved materials organized."),
      ],
      { padding: size === "large" ? 24 : 16, gap: 16 },
    ),
  ),
  [
    "Only content section layout specimens; CSS responsive breakpoints remain runtime.",
  ],
);
add(
  "Box",
  variants("padding", ["small", "medium", "large"], (s) =>
    surface("box", [text("content", "Content")], {
      padding: { small: 12, medium: 16, large: 24 }[s],
      width: 240,
      bindings: {
        fills: tok.surface,
        paddingLeft: `spacing-${s}`,
        paddingRight: `spacing-${s}`,
        paddingTop: `spacing-${s}`,
        paddingBottom: `spacing-${s}`,
      },
    }),
  ),
  [
    "Representative padding values; full polymorphic Box prop surface remains uncovered.",
  ],
);
add(
  "Flex",
  variants("direction", ["row", "column"], (direction) =>
    frame(
      "flex",
      [
        surface("first", [text("content", "First")]),
        surface("second", [text("content", "Second")]),
      ],
      {
        layout: direction === "row" ? "HORIZONTAL" : "VERTICAL",
        gap: 16,
        bindings: { itemSpacing: "spacing-medium" },
      },
    ),
  ),
  ["Wrap, alignment and responsive overrides remain uncovered."],
);
add(
  "Grid",
  variants("columns", ["2", "3"], (columns) =>
    col(
      "grid",
      Array.from({ length: 2 }, (_, row) =>
        frame(
          `row-${row}`,
          Array.from({ length: Number(columns) }, (_, column) =>
            surface(
              `cell-${column}`,
              [text("content", `Item ${row * Number(columns) + column + 1}`)],
              { width: 120 },
            ),
          ),
          { gap: 16 },
        ),
      ),
      { gap: 16 },
    ),
  ),
  [
    "Grid is represented by nested native Auto Layout rows; CSS minmax/auto-fit behavior remains runtime.",
  ],
);
// Current charts: native editable geometry and documented fixed demo data, not bitmap screenshots.
const chartColor = [
  "color-charts-primary-default",
  "color-charts-secondary-default",
  "color-charts-tertiary-default",
];
const axes = () => [
  rect("x-axis", 280, 1, "color-line-subtle"),
  frame(
    "labels",
    ["Jan", "Feb", "Mar", "Apr"].map((v, i) =>
      frame(`tick-${i}`, [text("label", v, 10, tok.muted)], { width: 62 }),
    ),
  ),
];
add(
  "ChartHeading",
  variants("description", [false, true], (v) =>
    col("heading", [
      text("title", "Asset downloads", 20),
      ...(v
        ? [text("description", "Usage during the last quarter", 12, tok.muted)]
        : []),
    ]),
  ),
  [],
  "charts",
);
add(
  "BarChart",
  variants("orientation", ["vertical", "horizontal"], (o) =>
    col("bar-chart", [
      frame(
        "bars",
        [64, 112, 88, 144].map((h, i) =>
          rect(
            `bar-${i}`,
            o === "vertical" ? 40 : h,
            o === "vertical" ? h : 24,
            chartColor[i % 3],
          ),
        ),
        { layout: o === "vertical" ? "HORIZONTAL" : "VERTICAL", gap: 16 },
      ),
      ...axes(),
    ]),
  ),
  [
    "Fixed sample data; scales, axes, legends, tooltips and grouped/stacked variants remain uncovered.",
  ],
  "charts",
);
add(
  "LinearGauge",
  variants("value", ["25", "50", "75"], (v) =>
    col("gauge", [
      frame(
        "track",
        [
          rect("value", Number(v) * 2.4, 12, chartColor[0]),
          rect(
            "remaining",
            (100 - Number(v)) * 2.4,
            12,
            "color-container-secondary-default",
          ),
        ],
        { gap: 0 },
      ),
      text("value-label", `${v}%`, 12),
    ]),
  ),
  ["Fixed sample values; thresholds and marker APIs remain uncovered."],
  "charts",
);
add(
  "Treemap",
  variants("data", ["sample"], () =>
    col(
      "treemap",
      [
        frame(
          "top",
          [
            rect("category-a", 160, 100, chartColor[0]),
            rect("category-b", 112, 100, chartColor[1]),
          ],
          { gap: 4 },
        ),
        frame(
          "bottom",
          [
            rect("category-c", 100, 72, chartColor[2]),
            rect("category-d", 172, 72, chartColor[0]),
          ],
          { gap: 4 },
        ),
      ],
      { gap: 4 },
    ),
  ),
  [
    "Native rectangle sample only; algorithmic packing, hierarchy, labels and interaction remain uncovered.",
  ],
  "charts",
);
add(
  "PieChart",
  variants("data", ["sample"], () =>
    col("pie", [
      svg(
        "segments",
        '<path d="M90 90V10a80 80 0 1 1-80 80z" fill="#6acb75"/><path d="M90 90H10a80 80 0 0 1 80-80z" fill="#d59bff"/>',
        180,
        180,
      ),
      frame("legend", [
        dot("a", 8, chartColor[0]),
        text("a-label", "Primary 75%", 12),
        dot("b", 8, chartColor[1]),
        text("b-label", "Secondary 25%", 12),
      ]),
    ]),
  ),
  [
    "Editable SVG paths use released chart colors, but segment paint bindings, data layout, labels and tooltips remain uncovered.",
  ],
  "charts",
);
for (const [name, body] of [
  [
    "LineChart",
    '<path d="M0 140 56 100 112 120 168 40 224 60 280 10" fill="none" stroke="#6acb75" stroke-width="2"/>',
  ],
  [
    "AreaStackChart",
    '<path d="M0 160V100L56 80 112 100 168 40 224 50 280 10V160Z" fill="#6acb75"/><path d="M0 160V130L56 110 112 125 168 100 224 115 280 80V160Z" fill="#d59bff"/>',
  ],
])
  add(
    name,
    variants("data", ["sample"], () =>
      col("chart", [svg("plot", body, 280, 160), ...axes()]),
    ),
    [
      "Fixed sample data; vector coordinates, segment paint bindings, axes, stack interpolation and interactive tooltips remain uncovered.",
    ],
    "charts",
  );
add(
  "RichTextEditor",
  variants("state", ["editing", "read-only"], (state) =>
    surface(
      "editor",
      [
        ...(state === "editing"
          ? [
              frame(
                "toolbar",
                [
                  text("bold", "B"),
                  text("italic", "I"),
                  text("underline", "U"),
                  rule("divider"),
                  text("style", "Paragraph"),
                  chevron(),
                ],
                { padding: 8 },
              ),
              rule("toolbar-rule"),
            ]
          : []),
        col(
          "document",
          [
            { ...text("heading", "Brand principles", 20), fontWeight: 500 },
            text("paragraph", "Build a consistent brand experience."),
            text("list", "• Clear\n• Useful\n• Recognizable"),
          ],
          { padding: 16, gap: 12 },
        ),
      ],
      { width: 480, padding: 0 },
    ),
  ),
  [
    "Published /rte only. Static editor and toolbar specimens; Plate plugins, selection menus, serialization, embedded blocks and all exported editor primitives remain uncovered.",
    "Private version-zero rich-text-editor package and internal legacy UI catalogs are excluded.",
  ],
  "rte",
);

// Public editor chrome, surfaced independently for native composition.
add(
  "ToolbarButton",
  variants("pressed", [false, true], (pressed) =>
    frame(
      "toolbar-button",
      [
        {
          ...text("glyph", "B", 14),
          fontWeight: 700,
          textStyle: "text-body-medium-x-strong",
        },
      ],
      {
        width: 24,
        height: 24,
        radius: 4,
        bindings: {
          fills: pressed ? "color-container-highlight-default" : tok.surface,
          cornerRadius: "border-radius-medium",
        },
      },
    ),
  ),
  [
    "Current tokens substitute internal legacy utility names; dropdown, disabled and tooltip combinations remain uncovered.",
  ],
  "rte",
  "RichTextEditor/components/Toolbar",
);
add(
  "Toolbar",
  variants("position", ["top", "bottom", "floating"], (position) =>
    surface(
      "toolbar",
      [
        frame(
          "formatting",
          [text("bold", "B"), text("italic", "I"), text("underline", "U")],
          { padding: 4 },
        ),
        rect("separator", 1, 24),
        frame("blocks", [text("style", "Paragraph"), chevron()], {
          padding: 4,
        }),
      ],
      { layout: "HORIZONTAL", padding: 8, gap: 8 },
    ),
  ),
  [
    "Positions are a design property; adaptive grouping, editor selection and positioning are runtime behavior.",
  ],
  "rte",
  "RichTextEditor/components/Toolbar",
);
add(
  "FloatingModalWrapper",
  variants("padding", ["8", "16"], (padding) =>
    surface(
      "floating-modal",
      [
        text("heading", "Insert a link", 14),
        input("https://example.com"),
        button("Insert"),
      ],
      { padding: Number(padding), width: 320, fill: "#ffffff", bindings: {} },
    ),
  ),
  [
    "Source wrapper accepts arbitrary padding/minWidth; these are two sample configurations. Shadow, overflow and placement remain uncovered.",
  ],
  "rte",
  "RichTextEditor/components/FloatingModal",
);

for (const recipe of recipes) {
  const hasIcon = (layer) =>
    layer.kind === "instance" || (layer.children ?? []).some(hasIcon);
  if (recipe.variants.some((v) => hasIcon(v.root)))
    recipe.limitations.push(
      "Nested native icon instances support library swapping; state-dependent icon color inheritance still requires visual review and explicit child paint binding.",
    );
}
export default recipes;
export { recipes };
