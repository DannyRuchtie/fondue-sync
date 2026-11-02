/** Additional observed product surfaces. Private viewport PNGs are reference only. */
import fs from "node:fs";
export function approvedImageProps(assetId) {
  const url = new URL("../fixtures/media/manifest.json", import.meta.url);
  const assets = fs.existsSync(url)
    ? (JSON.parse(fs.readFileSync(url, "utf8")).assets ?? [])
    : [];
  return assets.some((a) => a.id === assetId)
    ? { imageAssetId: assetId, imageScaleMode: "FILL" }
    : { imageSlotRole: assetId, pendingSourceImage: true };
}
export function createAdditionalExamples(c) {
  const {
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
    shared,
  } = c;
  const patterns = [],
    screens = [],
    imageSlots = [];
  const mediaURL = new URL("../fixtures/media/manifest.json", import.meta.url);
  const media = fs.existsSync(mediaURL)
    ? (JSON.parse(fs.readFileSync(mediaURL, "utf8")).assets ?? [])
    : [];
  const profiles = {
    desktop: { width: 1728, height: 997, mobile: false, main: 1471 },
    tablet: { width: 1024, height: 768, mobile: false, main: 767 },
    mobile: { width: 390, height: 844, mobile: true, main: 390 },
  };
  const sourceReference = {
    method:
      "Read-only signed-in production UI inspection; native reconstruction with synthetic records and approved source image assets.",
    observedDate: "2026-10-30",
    reference: "docs/additional-production-layout-reference.md",
    viewports: [1728, 1024, 390],
    mode: "static-fixture",
    marketplaceExcluded: true,
  };
  const docs = (purpose) => ({
    purpose,
    usage:
      "Edit the linked native instances and shared styles. This composition does not execute account, notification, search or settings actions.",
    properties:
      "Only the documented observed viewport/state profiles are represented; source image slots use the committed approved-media registry.",
    description: purpose,
    origin:
      "Authored production-grounded composition; released Fondue controls, shared tokens and source typography.",
    metadataSource: "fixtures/demo.json",
    links: [],
  });
  const text = (id, value, width, size = 14, weight = 400, o = {}) => ({
    id,
    name: id,
    kind: "text",
    text: value,
    width,
    fontFamily: "Diatype",
    fontSize: size,
    fontWeight: weight,
    lineHeight: size === 12 ? 16 : 18,
    bindings: { fills: S.text },
    ...o,
  });
  const display = (
    id,
    value,
    width,
    size = 46,
    lineHeight = 54,
    weight = 300,
  ) =>
    text(id, value, width, size, weight, { fontFamily: "Cranny", lineHeight });
  const abs = (node, x, y) => ({
    ...node,
    x,
    y,
    layoutPositioning: "ABSOLUTE",
  });
  const line = (id, w) => rect(id, w, 1, S.line);
  const mediaRoles = {
    "workspace-favicon": "frontify-digital-touch",
    "library-cover-primary": "frontify-laptop-campaign",
    "search-result-1": "frontify-creative-materials",
    "search-result-2": "frontify-tablet-campaign",
    "search-result-3": "frontify-laptop-campaign",
    "agentic-photo-1": "frontify-creative-materials",
    "agentic-photo-2": "frontify-digital-touch",
    "agentic-photo-3": "frontify-laptop-campaign",
    "agentic-photo-4": "frontify-tablet-campaign",
    "agentic-learn-1": "frontify-stock-collaboration",
    "agentic-learn-2": "frontify-notebook-work",
    "empty-guidelines-main": "frontify-tablet-campaign",
    "empty-guidelines-small-1": "frontify-stock-collaboration",
    "empty-guidelines-small-2": "frontify-digital-touch",
  };
  const slot = (id, role, width, height, o = {}) => {
    const asset = media.find(
      (a) =>
        a.id === (mediaRoles[role] ?? role) ||
        a.role === role ||
        a.source?.role === role,
    );
    imageSlots.push({
      layerId: id,
      role,
      width,
      height,
      assetId: asset?.id ?? null,
      status: asset ? "available" : "awaiting-approved-source-asset",
    });
    return frame(id, [], {
      width,
      height,
      clipContent: true,
      ...o,
      imageSlotRole: role,
      ...(asset
        ? { imageAssetId: asset.id, imageScaleMode: "FILL" }
        : { pendingSourceImage: true }),
    });
  };
  const add = (name, variants, purpose, limitations = []) => {
    const r = {
      id: "patterns/Production" + name,
      name: "Production" + name,
      package: "fondue-sync/patterns",
      source: sources,
      status: "partial",
      productionReference: sourceReference,
      documentation: docs(purpose),
      limitations: [
        "Static editable composition; no live account records or executable controls.",
        "Only observed states/viewports are represented; intermediate responsive behavior is not established.",
        ...limitations,
      ],
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
    patterns.push(r);
    return r;
  };
  const use = (id, name, props, o = {}) =>
    part(id, "patterns/Production" + name, props, o);
  const nativeSwitch = (id, value = true) =>
    inst(id, "Switch", undefined, {
      size: "medium",
      value: String(value),
      state: "default",
    });
  const action = (id, label, { weak = false, size = "small" } = {}) => {
    if (weak && size === "small")
      return row(
        id,
        [
          ...(label.startsWith("↗ ")
            ? [icon("external", "arrow-out-external", 14)]
            : []),
          body("label", label.replace(/^↗ /, ""), "small", "default", "strong"),
        ],
        {
          height: 24,
          paddingLeft: 8,
          paddingRight: 8,
          gap: 4,
          radius: 4,
          bindings: { fills: "color-container-secondary-default" },
        },
      );
    return inst(id, "Button", label, {
      variant: "default",
      emphasis: weak ? "default" : "strong",
      size,
      rounding: "medium",
      aspect: "default",
      state: "default",
    });
  };
  const plusAction = (id, label) =>
    row(
      id,
      [
        icon(id + "-plus", "plus", 16, "color-primary-on-primary"),
        inst(
          id + "-label",
          "Button",
          label,
          {
            variant: "default",
            emphasis: "strong",
            size: "medium",
            rounding: "medium",
            aspect: "default",
            state: "default",
          },
          { bindings: { paddingLeft: "component-constant-spacing-0" } },
        ),
      ],
      {
        height: 36,
        paddingLeft: 12,
        gap: 8,
        radius: 4,
        bindings: { fills: S.text },
      },
    );
  const insetHeading = (id, label, w = 377) =>
    row(id, [title("label", label), icon("close", "cross", 20)], {
      width: w,
      height: 60,
      paddingLeft: 24,
      paddingRight: 24,
      primaryAlign: "SPACE_BETWEEN",
    });
  const ruleRoot = (node, edge = "bottom") => {
    if (node.bindings) delete node.bindings.strokes;
    node.children.push(
      abs(
        line("edge-separator", node.width),
        0,
        edge === "bottom" ? node.height - 1 : 0,
      ),
    );
    return node;
  };
  const baseHeader = (page, p) => {
    if (["libraries", "guidelines", "brands"].includes(page))
      return ruleRoot({
        ...c.header(page, p.mobile ? "mobile" : "wide"),
        width: p.main,
        children: c
          .header(page, p.mobile ? "mobile" : "wide")
          .children.map((n) =>
            n.id === "title-action" ? { ...n, width: p.main } : n,
          ),
      });
    return ruleRoot(
      frame(
        "page-header",
        [
          row(
            "title-action",
            [
              title("page-title", "Essentials"),
              plusAction(
                "add",
                page === "colors" ? "Add palette" : "Add fonts",
              ),
            ],
            {
              width: p.main,
              height: 60,
              paddingLeft: 24,
              paddingRight: 24,
              primaryAlign: "SPACE_BETWEEN",
            },
          ),
          ...(!p.mobile
            ? [abs(rect("tabs-divider", 1, 28, S.line), 108, 16)]
            : []),
          row(
            "tabs",
            ["colors", "fonts"].map((tab) =>
              frame(
                "tab-" + tab,
                [body("label", tab === "colors" ? "Colors" : "Fonts")],
                {
                  height: 28,
                  paddingLeft: 8,
                  paddingRight: 8,
                  primaryAlign: "CENTER",
                  radius: 4,
                  ...(page === tab
                    ? {
                        bindings: {
                          fills: "color-container-secondary-default",
                        },
                      }
                    : {}),
                },
              ),
            ),
            {
              width: p.main,
              height: 36,
              paddingLeft: p.mobile ? 254 : 128,
              gap: 8,
              ...(!p.mobile
                ? { x: 0, y: 12, layoutPositioning: "ABSOLUTE" }
                : {}),
            },
          ),
        ],
        {
          width: p.main,
          height: p.mobile ? 96 : 60,
          bindings: { fills: S.surface },
        },
      ),
    );
  };
  const baseToolbar = (page, p) => {
    if (["libraries", "guidelines", "brands"].includes(page)) {
      const root = c.search(page, p.mobile ? "mobile" : "wide");
      root.width = p.main;
      return ruleRoot(root);
    }
    return ruleRoot(
      row(
        "essentials-toolbar",
        [
          row(
            "search",
            [
              icon("search-icon", "magnifier", 16),
              body("label", "Search", "small", "weak"),
            ],
            { gap: 8 },
          ),
          row(
            "sort",
            [
              body(
                "label",
                "Sort by " +
                  (page === "colors" ? "Palette name A–Z" : "Font family A–Z"),
                "small",
              ),
              icon("caret", "caret-down", 12),
              ...(!p.mobile
                ? [
                    icon("settings", "cog", 16),
                    icon("tile", "grid-regular", 16),
                    icon("list", "list-bullet", 16),
                  ]
                : []),
            ],
            { gap: 12 },
          ),
        ],
        {
          width: p.main,
          height: p.mobile ? 48 : 54,
          paddingLeft: 24,
          paddingRight: 24,
          primaryAlign: "SPACE_BETWEEN",
          bindings: { fills: S.surface },
        },
      ),
    );
  };
  function baseContent(page, p) {
    if (page === "guidelines")
      return use(
        "content",
        "GuidelinesEmpty",
        { viewport: p.mobile ? "mobile" : "desktop" },
        { width: p.main - 48 },
      );
    if (page === "fonts")
      return use(
        "content",
        "FontsEmpty",
        { viewport: p.mobile ? "mobile" : "desktop" },
        { width: p.main - 48 },
      );
    if (page === "libraries")
      return use("library", "ObservedLibraryCard", {
        viewport: p.mobile ? "mobile" : "desktop",
      });
    return frame(
      "brand-grid",
      demo.brands.slice(0, 2).map((b, i) => {
        const r = c.brandCard(b, p.mobile ? "mobile" : "desktop");
        return shared(
          "brand-" + i,
          "BrandCard",
          {
            brand: b.id,
            viewport: "observed-" + (p.mobile ? "mobile" : "desktop"),
          },
          { ...r, width: p.mobile ? 342 : 271.8 },
        );
      }),
      { layout: p.mobile ? "VERTICAL" : "HORIZONTAL", gap: 16 },
    );
  }
  function shell(page, p, content, opts = {}) {
    const root = frame("screen", [], {
        width: p.width,
        height: p.height,
        layout: "HORIZONTAL",
        clipContent: true,
        bindings: { fills: S.surface },
      }),
      mainHeight = p.mobile ? p.height - 68 : p.height;
    if (!p.mobile) {
      const railPage =
        page === "brands"
          ? "brands"
          : page === "libraries"
            ? "libraries"
            : ["colors", "fonts"].includes(page)
              ? "essentials"
              : "guidelines";
      root.children.push(
        shared(
          "rail",
          "NavigationRail",
          { page: railPage, height: String(p.height) },
          c.rail(railPage, p.height),
        ),
      );
    }
    const viewport = "observed-" + (p.mobile ? "mobile" : "desktop");
    const headerRoot = baseHeader(page, p),
      toolbarRoot = baseToolbar(page, p);
    const header = shared(
        headerRoot.id,
        "PageHeader",
        { page, viewport },
        headerRoot,
      ),
      toolbar = shared(
        toolbarRoot.id,
        "SearchToolbar",
        { page, viewport },
        toolbarRoot,
      ),
      top = headerRoot.height + toolbarRoot.height;
    root.children.push(
      frame(
        "main",
        [
          header,
          toolbar,
          frame("content", content ? [content] : [baseContent(page, p)], {
            width: p.main,
            height: mainHeight - top,
            padding: 24,
            gap: 16,
            ...(p.mobile && ["libraries", "guidelines"].includes(page)
              ? { paddingTop: 0 }
              : {}),
          }),
        ],
        { width: p.main, height: mainHeight },
      ),
    );
    if (p.mobile)
      root.children.push(
        abs(
          shared(
            "mobile-bar",
            "MobileBrandBar",
            {
              page: page === "brands" ? "brands" : "libraries",
              viewport: "observed",
            },
            c.bottom(page === "brands" ? "brands" : "libraries"),
          ),
          0,
          p.height - 68,
        ),
      );
    return root;
  }
  function screen(
    id,
    label,
    profile,
    root,
    { state = "observed", limitations = [] } = {},
  ) {
    const p = profiles[profile];
    screens.push({
      id: "examples/production-" + id + "-" + profile,
      name: "Production / " + label + " / " + p.width + "px",
      width: p.width,
      height: p.height,
      fixture: demo.datasetId,
      productionReference: {
        ...sourceReference,
        profile,
        viewport: { width: p.width, height: p.height },
        state,
      },
      documentation: docs(
        "Observed " +
          label +
          " at " +
          p.width +
          "px; synthetic editable content.",
      ),
      limitations: [
        "Static native composition; controls do not connect to account services.",
        "Approved source image assets replace private viewport images; fixture names and actors are fictional.",
        ...limitations,
      ],
      root,
    });
  }
  const overlay = (
    base,
    p,
    node,
    { x, y, backdrop = true, overRail = false } = {},
  ) => {
    if (backdrop)
      base.children.push(
        abs(
          rect(
            "backdrop",
            p.width - (overRail || p.mobile ? 0 : 257),
            overRail ? p.height : p.mobile ? p.height - 68 : p.height,
            "color-overlay-default",
          ),
          overRail || p.mobile ? 0 : 257,
          0,
        ),
      );
    base.children.push(abs(node, x ?? (p.mobile ? 0 : 257), y ?? 0));
    return base;
  };

  // Unread and unavailable rows are explicit fixture states; no read/action command executes.
  function notifications(p) {
    const w = 401,
      h = p.mobile ? 775 : p.height;
    const records = demo.notifications;
    const header = row(
      "notification-header",
      [
        row(
          "tabs",
          [
            row(
              "unread",
              [
                body("unread-label", "Unread", "small"),
                frame(
                  "count",
                  [
                    text(
                      "value",
                      String(demo.ui.notificationCount),
                      undefined,
                      12,
                      500,
                      { bindings: { fills: "color-highlight-on-highlight" } },
                    ),
                  ],
                  {
                    paddingLeft: 7,
                    paddingRight: 7,
                    height: 20,
                    radius: 9999,
                    primaryAlign: "CENTER",
                    bindings: { fills: "color-highlight-default" },
                  },
                ),
              ],
              {
                gap: 4,
                padding: 6,
                radius: 4,
                bindings: { fills: "color-container-secondary-default" },
              },
            ),
            body("history", "History", "small"),
          ],
          { gap: 12 },
        ),
        row(
          "actions",
          [
            icon("mark", "check-mark", 16),
            body("mark-label", "Mark all as read", "small"),
            icon("close", "cross", 20),
          ],
          { gap: 8 },
        ),
      ],
      {
        width: w,
        height: 60,
        paddingLeft: 12,
        paddingRight: 16,
        primaryAlign: "SPACE_BETWEEN",
      },
    );
    const cards = records.map((n, i) =>
      row(
        "notification-" + n.id,
        [
          frame("avatar", [body("initials", n.initials, "small")], {
            width: 36,
            height: 36,
            radius: 4,
            primaryAlign: "CENTER",
            counterAlign: "CENTER",
            bindings: { fills: "color-container-secondary-default" },
          }),
          frame(
            "copy",
            [
              row(
                "actor-time",
                [
                  inst("actor", "Heading", "@" + n.actor, {
                    size: "medium",
                    weight: "strong",
                    color: "default",
                  }),
                  {
                    id: "unread-dot",
                    name: "Unread indicator",
                    kind: "ellipse",
                    width: 5,
                    height: 5,
                    bindings: { fills: "color-highlight-default" },
                  },
                  body("time", n.time, "x-small", "weak"),
                ],
                { gap: 4 },
              ),
              text("event", n.message, 268, 13, 400, { lineHeight: 16 }),
              ...(n.available
                ? [
                    row(
                      "target-actions",
                      [
                        action("view", "↗ View asset", { weak: true }),
                        action("open", "↗ Open library", { weak: true }),
                      ],
                      { gap: 8 },
                    ),
                  ]
                : []),
            ],
            { width: 289, gap: n.available ? 8 : 2 },
          ),
          abs(icon("read", "check-mark", 16), 349, 12),
        ],
        {
          width: 377,
          padding: 8,
          gap: 12,
          counterAlign: "MIN",
          height: n.available ? (i === 0 ? 94 : 110) : 92,
          radius: 4,
          bindings: { fills: S.dim },
        },
      ),
    );
    return frame(
      "notification-drawer",
      [
        header,
        frame("notification-list", cards, {
          width: w,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          gap: 8,
        }),
      ],
      {
        width: w,
        height: h,
        clipContent: true,
        bindings: { fills: S.surface },
      },
    );
  }
  add(
    "NotificationsDrawer",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: notifications(profiles[viewport]),
    })),
    "Observed unread notification drawer, including actionable and unavailable fixture rows.",
    [
      "At390px the drawer is401px wide and775px high, overflowing the viewport by11px as observed.",
    ],
  );

  const menuGroups = [
    [
      "PERSONAL SETTINGS",
      [
        [
          "speech-bubble-stack",
          "Notification settings",
          "Manage email and in-app settings",
        ],
        ["apps", "Applications", "Connect your apps to Frontify"],
        ["checkbox", "Cookie management", "Manage cookie usage"],
      ],
    ],
    [
      "PLATFORM",
      [
        ["bell", "Notification center", "See recent updates"],
        ["check-mark", "Requests", "Approve or decline requests"],
        ["report", "Reports", "Access your reports"],
        ["table", "Catalogs", "Manage your catalogs"],
        ["people", "People", "Manage tagged people"],
        ["chart-bars", "Analytics", "View data and performance analytics"],
      ],
    ],
    [
      "CONFIGURATION",
      [
        ["cog", "Account", "Set up your account"],
        ["link-box", "Domain management", "Manage domains and paths"],
        ["arrow-expand", "Access request", "Configure your access request"],
      ],
    ],
  ];
  function userMenu(p) {
    const w = p.mobile ? 390 : 500,
      inner = w - 48,
      col = p.mobile ? inner : (inner - 16) / 2;
    return frame(
      "user-menu",
      [
        row(
          "profile",
          [
            row(
              "identity",
              [
                userAvatar("avatar", 40),
                frame(
                  "identity-copy",
                  [
                    inst("name", "Heading", demo.ui.userLabel, {
                      size: "medium",
                      weight: "strong",
                      color: "default",
                    }),
                    body("email", "designer@example.invalid", "small", "weak"),
                  ],
                  { gap: 2 },
                ),
              ],
              { gap: 12 },
            ),
            row(
              "profile-actions",
              [
                frame("edit-action", [icon("edit", "pen", 20)], {
                  width: 36,
                  height: 36,
                  radius: 4,
                  primaryAlign: "CENTER",
                  counterAlign: "CENTER",
                  bindings: { fills: "color-container-secondary-default" },
                }),
                frame(
                  "logout-action",
                  [icon("logout", "arrow-out-logout", 20)],
                  {
                    width: 36,
                    height: 36,
                    radius: 4,
                    primaryAlign: "CENTER",
                    counterAlign: "CENTER",
                    bindings: { fills: "color-container-secondary-default" },
                  },
                ),
              ],
              { gap: 8 },
            ),
          ],
          { width: inner, primaryAlign: "SPACE_BETWEEN" },
        ),
        ...menuGroups.flatMap(([label, items], g) => [
          body("group-" + g, label, "x-small", "weak"),
          frame(
            "group-rows-" + g,
            Array.from(
              { length: p.mobile ? items.length : Math.ceil(items.length / 2) },
              (_, r) =>
                row(
                  "row-" + r,
                  items
                    .slice(
                      r * (p.mobile ? 1 : 2),
                      r * (p.mobile ? 1 : 2) + (p.mobile ? 1 : 2),
                    )
                    .map(([glyph, name, copy], j) =>
                      row(
                        "menu-item-" + r + "-" + j,
                        [
                          frame("tile", [icon("icon", glyph, 20)], {
                            width: 36,
                            height: 36,
                            radius: 4,
                            primaryAlign: "CENTER",
                            counterAlign: "CENTER",
                            bindings: {
                              fills: "color-container-secondary-default",
                            },
                          }),
                          frame(
                            "copy",
                            [
                              title("name", name),
                              text("helper", copy, col - 48, 12, 400, {
                                lineHeight: 16,
                                bindings: { fills: S.muted },
                              }),
                            ],
                            { width: col - 48, gap: 2 },
                          ),
                        ],
                        { width: col, gap: 12, counterAlign: "MIN" },
                      ),
                    ),
                  { gap: 16, counterAlign: "MIN" },
                ),
            ),
            { gap: p.mobile ? 16 : 12 },
          ),
        ]),
      ],
      {
        width: w,
        height: p.mobile ? 776 : 612,
        padding: 24,
        gap: 24,
        radius: p.mobile ? 0 : 4,
        clipContent: true,
        effectStyle: p.mobile ? undefined : "shadow-big",
        bindings: { fills: S.surface },
      },
    );
  }
  add(
    "UserMenu",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: userMenu(profiles[viewport]),
    })),
    "Observed grouped profile/settings menu; desktop two-column groups become a narrow single-column menu.",
  );
  function account(p) {
    const w = p.mobile ? 390 : 401,
      inner = w - 48;
    const switchRow = (id, label, helper) =>
      frame(
        id,
        [
          row("label", [title("label", label), nativeSwitch("switch")], {
            width: inner - 24,
            primaryAlign: "SPACE_BETWEEN",
          }),
          text("helper", helper, inner - 24, 12, 400, { lineHeight: 16 }),
          text("learn", "Learn more", inner - 24, 12, 400, {
            textDecoration: "UNDERLINE",
            bindings: { fills: "color-highlight-default" },
          }),
        ],
        { width: inner, padding: 12, gap: 12 },
      );
    return frame(
      "account-settings",
      [
        ruleRoot(insetHeading("header", "Account", w)),
        frame(
          "settings-content",
          [
            title("basics", "Basics"),
            frame(
              "basics-box",
              [
                body("name-label", "Name", "small", "weak"),
                inst(
                  "workspace-name",
                  "TextInput",
                  demo.ui.workspaceLabel,
                  {
                    status: "neutral",
                    mode: "default",
                    content: "value",
                    slots: "none",
                  },
                  { width: inner - 40 },
                ),
                line("divider", inner - 40),
                row(
                  "favicon",
                  [
                    slot("favicon-preview", "workspace-favicon", 56, 56),
                    frame("label", [
                      body("favicon", "Favicon"),
                      body(
                        "requirements",
                        "Type: PNG · Max1MB",
                        "x-small",
                        "weak",
                      ),
                    ]),
                    icon("caret", "caret-down", 16),
                  ],
                  {
                    gap: 16,
                    width: inner - 40,
                    height: 56,
                    bindings: { strokes: S.line },
                  },
                ),
              ],
              {
                width: inner,
                padding: 20,
                gap: 12,
                bindings: { strokes: S.line },
              },
            ),
            frame("ai-heading", [title("label", "AI features")], {
              paddingTop: 16,
            }),
            body("guidelines-label", "GUIDELINES", "small"),
            frame(
              "guideline-features",
              [
                switchRow(
                  "assistant",
                  "Brand assistant",
                  "A chatbot that lets users interact with your brand portal in a conversational way.",
                ),
                line("divider", inner),
                switchRow(
                  "translation",
                  "AI translation · Beta",
                  "Make AI translation available on guidelines across your organization.",
                ),
                text(
                  "availability",
                  "Account admins can now choose on which guidelines these AI features are enabled.",
                  inner - 24,
                  12,
                  400,
                  { lineHeight: 16 },
                ),
                action("admin", "Open admin dashboard", { weak: true }),
              ],
              { width: inner, gap: 12, bindings: { strokes: S.line } },
            ),
            body("libraries-label", "LIBRARIES", "small"),
            frame(
              "library-features",
              [
                switchRow(
                  "brand-assistant",
                  "Brand assistant in DAM · Beta",
                  "Use natural language to manage your library and connect workflows.",
                ),
                switchRow(
                  "image-search",
                  "Enhanced image search · Beta",
                  "AI analyzes images in the background to improve search results.",
                ),
              ],
              { width: inner, gap: 12, bindings: { strokes: S.line } },
            ),
            ...[
              "Login page",
              "Emails",
              "Error pages",
              "Cookie notice",
              "Guideline",
              "Security",
              "Personal projects",
              "Required permissions",
            ].map((label, i) =>
              row(
                "setting-" + i,
                [body("label", label), icon("caret", "caret-down", 16)],
                { width: inner, height: 48, primaryAlign: "SPACE_BETWEEN" },
              ),
            ),
          ],
          { width: w, padding: 24, gap: 16 },
        ),
      ],
      {
        width: w,
        height: p.mobile ? 776 : p.height,
        clipContent: true,
        bindings: { fills: S.surface },
      },
    );
  }
  add(
    "AccountSettingsDrawer",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: account(profiles[viewport]),
    })),
    "Observed full-height account settings drawer, static field/switch/select states.",
    [
      "Desktop drawer is anchored at x257 immediately beside the retained rail. Security/account actions are non-executable examples.",
    ],
  );
  function help(p) {
    const w = p.mobile ? 358 : 600;
    const items = [
      [
        "speech-bubble-stack",
        "Contact us",
        "Instantly connect to our support team for rapid assistance and proactive issue resolution.",
        false,
      ],
      [
        "question-mark-circle",
        "Open help center",
        "Access an extensive library of help articles, video tutorials, and FAQs to quickly find your answers.",
        true,
      ],
      [
        "sparks",
        "Visit customer hub",
        "Explore on-demand videos and resource collections designed to accelerate your learning.",
        true,
      ],
    ];
    return frame(
      "help-dialog",
      [
        ruleRoot({
          ...insetHeading("header", "How can we help you?", w),
          height: 78,
          paddingLeft: 36,
          children: [
            title("label", "How can we help you?", "x-large"),
            icon("close", "cross", 20),
          ],
        }),
        frame(
          "help-rows",
          items.map(([glyph, label, copy, external], i) =>
            row(
              "help-row-" + i,
              [
                frame("icon-tile", [icon("glyph", glyph, 24)], {
                  width: 64,
                  height: 64,
                  radius: 4,
                  primaryAlign: "CENTER",
                  counterAlign: "CENTER",
                  bindings: { fills: S.dim },
                }),
                frame(
                  "copy",
                  [
                    title("label", label),
                    text("description", copy, w - 160, 13, 400, {
                      lineHeight: 16,
                      bindings: { fills: S.muted },
                    }),
                  ],
                  { width: w - 160, gap: 4 },
                ),
                ...(external
                  ? [icon("external", "arrow-out-external", 16)]
                  : []),
              ],
              { width: w - 48, height: 72, gap: 16, counterAlign: "CENTER" },
            ),
          ),
          { width: w, padding: 24, gap: 16 },
        ),
      ],
      {
        width: w,
        height: 374,
        radius: 8,
        effectStyle: "shadow-big",
        bindings: { fills: S.surface },
      },
    );
  }
  add(
    "HelpDialog",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: help(profiles[viewport]),
    })),
    "Observed centered three-row help modal; all external/contact affordances remain static.",
  );
  function globalSearch(p, state) {
    const w = p.mobile ? 358 : 600;
    return frame(
      "global-search",
      [
        row(
          "input",
          [
            icon("magnifier", "magnifier", 20),
            body(
              "query",
              state === "results"
                ? "brand"
                : "Search assets, folders, and guidelines",
              "medium",
              state === "results" ? "default" : "weak",
              "default",
              { width: w - (state === "results" ? 92 : 64) },
            ),
            ...(state === "results" ? [icon("clear", "cross", 16)] : []),
          ],
          { width: w, height: 48, paddingLeft: 16, paddingRight: 16, gap: 12 },
        ),
        ...(state === "results"
          ? [
              frame(
                "results",
                [
                  row(
                    "result-heading",
                    [
                      title("assets", "Assets"),
                      row(
                        "show-all",
                        [
                          body("label", "Show all", "small"),
                          icon("arrow", "arrow-right", 16),
                        ],
                        { gap: 4 },
                      ),
                    ],
                    { width: w - 48, primaryAlign: "SPACE_BETWEEN" },
                  ),
                  ...demo.searchResults.map((a, i) =>
                    row(
                      "asset-" + a.id,
                      [
                        slot("preview", "search-result-" + (i + 1), 60, 60, {
                          radius: 4,
                        }),
                        frame(
                          "result-copy",
                          [
                            row(
                              "title",
                              a.name
                                .split(/(brand)/i)
                                .filter(Boolean)
                                .map((segment, i) =>
                                  segment.toLowerCase() === "brand"
                                    ? frame(
                                        "match-" + i,
                                        [
                                          inst("text", "Heading", segment, {
                                            size: "medium",
                                            weight: "strong",
                                            color: "default",
                                          }),
                                        ],
                                        {
                                          bindings: {
                                            fills:
                                              "color-container-warning-default",
                                          },
                                        },
                                      )
                                    : title("segment-" + i, segment),
                                ),
                              { gap: 0 },
                            ),
                            text("metadata", a.metadata, w - 132, 12, 400, {
                              lineHeight: 16,
                            }),
                            body("context", a.context, "x-small", "weak"),
                          ],
                          { width: w - 132, gap: 4 },
                        ),
                      ],
                      { gap: 12, width: w - 48, height: 72 },
                    ),
                  ),
                ],
                { padding: 24, width: w, gap: 16 },
              ),
            ]
          : []),
      ],
      {
        width: w,
        radius: 8,
        effectStyle: "shadow-big",
        bindings: { fills: S.surface },
      },
    );
  }
  add(
    "GlobalSearch",
    [
      {
        props: { viewport: "desktop", state: "blank" },
        root: globalSearch(profiles.desktop, "blank"),
      },
      {
        props: { viewport: "mobile", state: "blank" },
        root: globalSearch(profiles.mobile, "blank"),
      },
      {
        props: { viewport: "desktop", state: "results" },
        root: globalSearch(profiles.desktop, "results"),
      },
    ],
    "Observed input-only blank search and three-row results state with synthetic asset metadata.",
    ["No result actions or query execution; narrow results were not observed."],
  );

  function emptyIllustration(kind) {
    const gallery = frame(
      "gallery-card",
      [
        text("kind", "GALLERY", 170, 10, 400, {
          lineHeight: 12,
          bindings: { fills: S.muted },
        }),
        row(
          "gallery-images",
          [
            slot("main-photo", "empty-guidelines-main", 120, 78, { radius: 4 }),
            frame(
              "small-photos",
              [
                slot("small-photo-1", "empty-guidelines-small-1", 52, 36, {
                  radius: 4,
                }),
                slot("small-photo-2", "empty-guidelines-small-2", 52, 36, {
                  radius: 4,
                }),
              ],
              { gap: 6 },
            ),
          ],
          { gap: 8 },
        ),
      ],
      {
        width: 210,
        height: 140,
        padding: 12,
        gap: 8,
        radius: 8,
        rotation: 3,
        effectStyle: "shadow-default",
        bindings: { fills: S.surface },
      },
    );
    const fonts = frame(
      "font-card",
      [
        text("type", "FONTS", 100, 10, 400, {
          lineHeight: 12,
          bindings: { fills: S.muted },
        }),
        frame("sample", [display("letterform", "Aa", 100, 40, 48, 400)], {
          width: 120,
          height: 96,
          padding: 12,
          bindings: { fills: S.dim },
        }),
      ],
      {
        width: 144,
        height: 164,
        padding: 12,
        gap: 8,
        radius: 8,
        rotation: -10,
        effectStyle: "shadow-default",
        bindings: { fills: S.surface },
      },
    );
    const swatchCard = frame(
      "font-styles",
      [
        text("type", "STYLES", 100, 10, 400, {
          lineHeight: 12,
          bindings: { fills: S.muted },
        }),
        row(
          "font-swatches",
          [
            rect("sample-1", 20, 64, "color-error-default", 3),
            rect("sample-2", 20, 64, "color-primary-default", 3),
            rect("sample-3", 20, 64, "color-highlight-default", 3),
          ],
          { gap: 8 },
        ),
        line("text-line", 100),
        line("text-line-2", 76),
      ],
      {
        width: 144,
        height: 164,
        padding: 12,
        gap: 12,
        radius: 8,
        rotation: 8,
        effectStyle: "shadow-default",
        bindings: { fills: S.surface },
      },
    );
    return frame(
      "empty-illustration",
      kind === "fonts"
        ? [abs(swatchCard, 32, 24), abs(fonts, 156, 30)]
        : [
            abs(gallery, 58, 24),
            abs(
              frame(
                "text-card",
                [
                  text("type", "TEXT", 150, 10, 400, {
                    lineHeight: 12,
                    bindings: { fills: S.muted },
                  }),
                  line("line-1", 160),
                  line("line-2", 128),
                ],
                {
                  width: 190,
                  height: 54,
                  padding: 12,
                  gap: 8,
                  radius: 8,
                  rotation: 4,
                  effectStyle: "shadow-default",
                  bindings: { fills: S.surface },
                },
              ),
              66,
              162,
            ),
          ],
      { width: 320, height: 220 },
    );
  }
  function emptyPanel(kind, p) {
    const w = p.main - 48,
      h = p.mobile ? 534 : p.height - 162,
      isFonts = kind === "fonts",
      label = isFonts ? "Essentials" : "Guidelines";
    return frame(
      "empty-panel",
      [
        emptyIllustration(kind),
        display("display", label, Math.min(470, w - 24)),
        text(
          "description",
          isFonts
            ? "Set up your brand fonts. Once added, they’re available to all your guidelines and templates."
            : "Document your brand colors, typography, logo usage, and tone of voice in guidelines everyone in your organization can access.",
          Math.min(470, w - 24),
          14,
          400,
          { textAlignHorizontal: "CENTER", bindings: { fills: S.muted } },
        ),
        plusAction("create", isFonts ? "Add fonts" : "Create guideline"),
        text(
          "help",
          isFonts
            ? "Learn how to set up essentials"
            : "Learn how to set up guidelines",
          Math.min(470, w - 24),
          12,
          400,
          {
            lineHeight: 16,
            textAlignHorizontal: "CENTER",
            textDecoration: "UNDERLINE",
            bindings: { fills: S.muted },
          },
        ),
      ],
      {
        width: w,
        height: h,
        radius: 8,
        primaryAlign: "CENTER",
        counterAlign: "CENTER",
        gap: 16,
        bindings: { fills: S.dim },
      },
    );
  }
  add(
    "GuidelinesEmpty",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: emptyPanel("guidelines", profiles[viewport]),
    })),
    "Observed empty guideline overview; no existing guideline document or portal is invented.",
    [
      "The390px empty panel is a shell composition for notification context, not an independently verified full-page empty guideline viewport.",
    ],
  );
  add(
    "FontsEmpty",
    [
      {
        props: { viewport: "desktop" },
        root: emptyPanel("fonts", profiles.desktop),
      },
    ],
    "Observed Essentials fonts-empty state; brand font setup is distinct from application UI typography.",
  );
  function observedLibrary(p) {
    const w = p.mobile ? 342 : 271.8;
    return frame(
      "library-card",
      [
        slot("cover", "library-cover-primary", w, w / 2, { radius: 8 }),
        row(
          "footer",
          [
            frame(
              "library-thumb",
              [icon("icon", "image-stack", 20, "color-line-strong")],
              {
                width: 40,
                height: 40,
                primaryAlign: "CENTER",
                counterAlign: "CENTER",
                bindings: { fills: S.dim },
              },
            ),
            frame(
              "copy",
              [
                title("name", demo.observedLibrary.name),
                body(
                  "count",
                  demo.observedLibrary.assetCount + " assets",
                  "small",
                  "weak",
                ),
              ],
              { gap: 4 },
            ),
          ],
          { width: w, height: 64, padding: 12, gap: 12 },
        ),
      ],
      { width: w },
    );
  }
  add(
    "ObservedLibraryCard",
    ["desktop", "mobile"].map((viewport) => ({
      props: { viewport },
      root: observedLibrary(profiles[viewport]),
    })),
    "Observed single loaded library tile with a source image and representative340asset count; fictional library identity.",
  );

  function paletteList(p, state) {
    const width = p.main - 48;
    const cell = (id, content, w, h = 72) =>
      frame(id, Array.isArray(content) ? content : [content], {
        width: w,
        height: h,
        primaryAlign: "CENTER",
        counterAlign: "MIN",
      });
    const colWidths = [218, 104, 144, 246];
    return frame(
      "palettes",
      demo.palettes.map((palette, index) => {
        const expanded = state === "expanded" && index === 1;
        const heading = inst(
          "name",
          "Heading",
          p.mobile ? palette.shortName : palette.name,
          { size: "xx-large", weight: "strong", color: "default" },
        );
        const header = row(
          "palette-header",
          [
            row(
              "label-group",
              [
                heading,
                icon("toggle", expanded ? "caret-up" : "caret-down", 12),
                body(
                  "count",
                  palette.colors.length + " colors",
                  "x-small",
                  "weak",
                ),
              ],
              { gap: 12 },
            ),
            ...(expanded
              ? [
                  row(
                    "actions",
                    [icon("edit", "pen", 16), icon("delete", "trash-bin", 16)],
                    { gap: 24 },
                  ),
                ]
              : []),
          ],
          {
            height: p.mobile ? 38 : 40,
            width: width - 48,
            primaryAlign: expanded ? "SPACE_BETWEEN" : "MIN",
            counterAlign: "MIN",
          },
        );
        const swatches = row(
          "swatches",
          palette.colors.map((color, i) => ({
            ...rect("swatch-" + i, 56, 56, S.surface),
            fill: color.hex,
            bindings: {},
            paintRole: "brand-palette-content",
          })),
          { gap: 0 },
        );
        const table = frame(
          "color-table",
          [
            row(
              "columns",
              ["PREVIEW", "NAME", "RGBA", "HEX"].map((label, i) =>
                cell(
                  "column-" + i,
                  body("label", label, "x-small", "weak"),
                  colWidths[i],
                  32,
                ),
              ),
              { gap: 16, width: 760, height: 32 },
            ),
            ...palette.colors.map((color, i) =>
              row(
                "color-" + i,
                [
                  cell(
                    "preview-cell",
                    {
                      ...rect("preview", 218, 72, S.surface),
                      fill: color.hex,
                      bindings: {},
                      radius: 4,
                      paintRole: "brand-palette-content",
                    },
                    218,
                  ),
                  cell("name-cell", title("name", color.name), 104),
                  cell("rgba-cell", body("rgba", color.rgba, "small"), 144),
                  cell("hex-cell", body("hex", color.hex, "small"), 246),
                ],
                { gap: 16, width: 760, height: 88 },
              ),
            ),
            row(
              "add-color",
              [
                cell(
                  "preview-cell",
                  frame("tile", [icon("plus", "plus", 16)], {
                    width: 218,
                    height: 48,
                    primaryAlign: "CENTER",
                    counterAlign: "CENTER",
                    bindings: { fills: S.surface },
                  }),
                  218,
                  48,
                ),
                cell(
                  "name-cell",
                  body("label", "Add color", "small", "weak"),
                  104,
                  48,
                ),
                cell("rgba-cell", [], 144, 48),
                cell("hex-cell", [], 246, 48),
              ],
              { gap: 16, width: 760, height: 48 },
            ),
          ],
          { width: width - 48, gap: 8 },
        );
        return frame(
          "palette-" + palette.id,
          [header, expanded ? table : swatches],
          {
            width,
            padding: 24,
            paddingTop: p.mobile ? 24 : 16,
            gap: 8,
            radius: 4,
            ...(expanded ? { bindings: { fills: S.dim } } : {}),
          },
        );
      }),
      { width, gap: p.mobile ? 8 : 14 },
    );
  }
  add(
    "EssentialsPaletteList",
    ["desktop", "mobile"].flatMap((viewport) =>
      ["collapsed", "expanded"].map((state) => ({
        props: { viewport, state },
        root: paletteList(profiles[viewport], state),
      })),
    ),
    "Observed two-palette accordion list and expanded RGBA/HEX table.",
    [
      "At390px expanded columns remain a dense horizontally overflowing table; no invented mobile card conversion.",
      "Palette colors are fictional brand content, not application UI tokens.",
    ],
  );

  const featureGlyphs = [
    "link",
    "speech-bubble-dots",
    "workflow-shapes",
    "language",
    "magnifier",
    "suitcase-tag",
    "sparks",
    "document-list",
    "layers",
    "document-code",
  ];
  function agenticRail(p) {
    const base = c.rail("brands", p.height);
    base.children = base.children.filter((n) =>
      [
        "brand-switcher",
        "utility-navigation",
        "account",
        "utility-divider",
        "account-divider",
        "rail-divider",
      ].includes(n.id),
    );
    // The observed tablet rail retains its taller navigation flow; utilities
    // start below the feature list instead of pinning over it at 768px.
    if (p.width === 1024)
      for (const child of base.children) {
        if (child.id === "utility-navigation") child.y = 724;
        if (child.id === "utility-divider") child.y = 716;
        if (child.id === "account" || child.id === "account-divider")
          child.y = 948;
      }
    const switcher = base.children[0];
    switcher.children.find((n) => n.id === "workspace-copy").children = [
      title("workspace", "Agentic hub"),
    ];
    base.children.push(
      abs(
        frame(
          "agentic-navigation",
          [
            body("explore", "EXPLORE", "x-small"),
            row(
              "overview",
              [icon("icon", "document-list", 20), title("label", "Overview")],
              {
                width: 240,
                height: 32,
                gap: 12,
                paddingLeft: 12,
                radius: 4,
                bindings: { fills: "color-surface-active" },
              },
            ),
            line("divider", 240),
            body("features-label", "FEATURES", "x-small", "weak"),
            ...demo.agenticProductionFeatures.map((f, i) =>
              row(
                "feature-" + f.id,
                [
                  icon("glyph", featureGlyphs[i], 20, S.muted),
                  body("label", f.name, "medium", "weak"),
                ],
                { width: 240, height: 36, gap: 8, paddingLeft: 12 },
              ),
            ),
          ],
          { width: 240, gap: 4 },
        ),
        8,
        72,
      ),
    );
    return base;
  }
  function automationHero(width, mobile) {
    const scale = mobile ? 342 / 854 : 1,
      offset = width < 800 && !mobile ? -(854 - width) / 2 : 0;
    const scaled = (n) => n * scale;
    const diagramChildren = [
      abs(
        frame("asset-card-outline", [], {
          width: scaled(428),
          height: scaled(194),
          radius: scaled(16),
          bindings: { strokes: "color-line-mid" },
        }),
        scaled(36) + offset,
        scaled(40),
      ),
      abs(
        frame("automation-path", [], {
          width: scaled(594),
          height: scaled(140),
          radius: scaled(70),
          bindings: { strokes: "color-line-mid" },
        }),
        scaled(78) + offset,
        scaled(136),
      ),
      abs(
        frame("generate-path", [], {
          width: scaled(774),
          height: scaled(120),
          radius: scaled(60),
          bindings: { strokes: "color-line-mid" },
        }),
        scaled(78) + offset,
        scaled(278),
      ),
      ...[
        [-14, 78, 96],
        [-6, 152, 82],
        [8, 226, 90],
        [16, 300, 102],
      ].map(([rotation, x, y], i) =>
        abs(
          {
            ...slot(
              "photo-card-" + (i + 1),
              "agentic-photo-" + (i + 1),
              scaled(124),
              scaled(140),
              { radius: scaled(4) },
            ),
            rotation,
          },
          scaled(x) + offset,
          scaled(y),
        ),
      ),
      abs(
        frame(
          "automation-pill",
          [
            icon(
              "lightning",
              "lightning",
              scaled(20),
              "color-highlight-on-highlight",
            ),
            text("label", "Automation", scaled(130), scaled(20), 400, {
              lineHeight: scaled(28),
              bindings: { fills: "color-highlight-on-highlight" },
            }),
          ],
          {
            width: scaled(182),
            height: scaled(54),
            paddingLeft: scaled(20),
            layout: "HORIZONTAL",
            counterAlign: "CENTER",
            radius: scaled(27),
            bindings: { fills: "color-highlight-default" },
          },
        ),
        scaled(576) + offset,
        scaled(180),
      ),
      abs(
        row(
          "generate-controls",
          [
            frame(
              "generate",
              [
                icon("spark", "sparks", scaled(20)),
                text("label", "Generate:", scaled(96), scaled(20), 400, {
                  lineHeight: scaled(28),
                }),
              ],
              {
                width: scaled(164),
                height: scaled(54),
                paddingLeft: scaled(18),
                layout: "HORIZONTAL",
                counterAlign: "CENTER",
                radius: scaled(27),
                bindings: { fills: S.dim, strokes: S.text },
              },
            ),
            ...["Title", "Description", "Tags"].map((label, i) =>
              frame(
                "property-" + i,
                [
                  text(
                    "label",
                    label,
                    scaled([70, 108, 62][i]),
                    scaled(20),
                    400,
                    { lineHeight: scaled(28), bindings: { fills: S.muted } },
                  ),
                ],
                {
                  width: scaled([78, 142, 80][i]),
                  height: scaled(54),
                  paddingLeft: scaled(12),
                  paddingTop: scaled(12),
                  radius: scaled(27),
                  bindings: { fills: S.dim, strokes: S.line },
                },
              ),
            ),
          ],
          { gap: 0 },
        ),
        scaled(192) + offset,
        scaled(374),
      ),
    ];
    return frame("automation-hero", diagramChildren, {
      width,
      height: mobile ? 192 : width === 854 ? 448 : 444,
      radius: 16,
      clipContent: true,
      bindings: { fills: S.dim, strokes: S.line },
    });
  }
  function agentic(p) {
    const w = p.main,
      inner = p.mobile ? 342 : w - (p.width === 1024 ? 128 : 144),
      heroImage = p.mobile ? 342 : p.width === 1728 ? 854 : 426,
      copyWidth = p.mobile ? 342 : inner - heroImage - 32;
    const featureWidth = p.mobile ? 342 : (inner - 48) / 3;
    let heading = frame(
      "agentic-heading",
      [
        display(
          "title",
          "Agentic hub",
          p.width === 1024 ? 330 : 600,
          36,
          54,
          400,
        ),
        text(
          "intro",
          "Your brand’s AI tools and agents find, organize, and create for you — right where you already work.",
          p.mobile ? 342 : p.width === 1024 ? 173 : 400,
          14,
          400,
          { bindings: { fills: S.muted } },
        ),
      ],
      {
        width: w,
        paddingLeft: p.mobile ? 24 : 72,
        paddingRight: p.width === 1024 ? 64 : 72,
        paddingTop: 32,
        paddingBottom: 24,
        gap: p.mobile ? 16 : 24,
        layout: p.mobile ? "VERTICAL" : "HORIZONTAL",
        primaryAlign: "SPACE_BETWEEN",
      },
    );
    if (p.mobile)
      heading = frame(
        "agentic-heading",
        [
          frame(
            "title-section",
            [display("title", "Agentic hub", 342, 36, 54, 400)],
            { width: 390, height: 78, paddingLeft: 24, paddingTop: 10 },
          ),
          line("title-divider", 390),
          frame(
            "intro-section",
            [
              text(
                "intro",
                "Your brand’s AI tools and agents find, organize, and create for you — right where you already work.",
                342,
                14,
                400,
                { bindings: { fills: S.muted } },
              ),
            ],
            { width: 390, paddingLeft: 24, paddingTop: 12 },
          ),
        ],
        { width: 390 },
      );
    const hero = frame(
      "hero",
      [
        automationHero(heroImage, p.mobile),
        frame(
          "automation-copy",
          [
            display("title", "Automations", copyWidth, 32, 48, 400),
            text(
              "description",
              "Keep every asset organized, even as your library grows. Set a rule once — say, when a file is uploaded, use AI to generate a description, translate it, and apply tags — and automations handle the rest. Combine a large variety of actions with OpenAI-powered or custom triggers to connect other AI tools and extend your workflows even further. The upkeep runs in the background, and no one has to think about it.",
              copyWidth,
              14,
              400,
              { bindings: { fills: S.muted } },
            ),
            action("learn", "Learn more", { size: "medium" }),
          ],
          { width: copyWidth, gap: 24, paddingTop: p.mobile ? 0 : 16 },
        ),
      ],
      {
        layout: p.mobile ? "VERTICAL" : "HORIZONTAL",
        width: inner,
        gap: p.mobile ? 24 : 32,
        counterAlign: "MIN",
      },
    );
    const links = frame(
      "feature-grid",
      Array.from({ length: p.mobile ? 10 : 4 }, (_, r) =>
        row(
          "feature-row-" + r,
          demo.agenticProductionFeatures
            .slice(
              r * (p.mobile ? 1 : 3),
              r * (p.mobile ? 1 : 3) + (p.mobile ? 1 : 3),
            )
            .map((f, i) =>
              row(
                "feature-" + f.id,
                [
                  frame(
                    "tile",
                    [
                      icon(
                        "glyph",
                        featureGlyphs[r * (p.mobile ? 1 : 3) + i],
                        24,
                      ),
                    ],
                    {
                      width: 56,
                      height: 56,
                      radius: 8,
                      primaryAlign: "CENTER",
                      counterAlign: "CENTER",
                      bindings: { fills: S.dim },
                    },
                  ),
                  frame(
                    "copy",
                    [
                      title("name", f.name),
                      text(
                        "description",
                        f.description,
                        featureWidth - 72,
                        14,
                        400,
                        { bindings: { fills: S.muted } },
                      ),
                    ],
                    { width: featureWidth - 72, gap: 4 },
                  ),
                ],
                {
                  width: featureWidth,
                  height: 72,
                  gap: 16,
                  counterAlign: "CENTER",
                },
              ),
            ),
          { gap: 24, counterAlign: "MIN" },
        ),
      ),
      { gap: 24, width: inner },
    );
    const content = frame(
      "agentic-content",
      [
        heading,
        ...(!p.mobile ? [line("header-divider", w)] : []),
        frame(
          "body",
          [
            hero,
            frame(
              "features-section",
              [display("features", "Features", inner, 36, 54, 400), links],
              { gap: 24, width: inner },
            ),
            display("learn-heading", "Learn", inner, 36, 54, 400),
            row(
              "learn-media",
              demo.learning.map((item, i) =>
                frame(
                  "learn-" + item.id,
                  [
                    slot(
                      "image",
                      "agentic-learn-" + (i + 1),
                      p.mobile ? 342 : (inner - 24) / 2,
                      180,
                      { radius: 8 },
                    ),
                    title("title", item.title),
                  ],
                  { gap: 12 },
                ),
              ),
              { gap: 24, layout: p.mobile ? "VERTICAL" : "HORIZONTAL" },
            ),
          ],
          {
            paddingLeft: p.mobile ? 24 : p.width === 1024 ? 64 : 96,
            paddingRight: p.mobile ? 24 : p.width === 1024 ? 64 : 48,
            paddingTop: p.mobile ? 24 : 32,
            paddingBottom: 48,
            gap: p.mobile ? 34 : p.width === 1728 ? 80 : 48,
            width: w,
          },
        ),
      ],
      {
        width: w,
        height: p.mobile ? p.height - 68 : p.height,
        clipContent: true,
      },
    );
    return content;
  }
  add(
    "AgenticHubContent",
    ["desktop", "tablet", "mobile"].map((viewport) => ({
      props: { viewport },
      root: agentic(profiles[viewport]),
    })),
    "Observed Agentic hub header, automation hero, feature links and Learn media, retaining Cranny display roles.",
    [
      "Cranny family and36/54 and32/48 sizes are observed. Weight400 is pending computed-style confirmation; do not claim font-weight parity before that evidence.",
      "At1024px the rail remains and the hero stays two-column with wrapped text; at390px content stacks.",
    ],
  );

  for (const viewport of ["desktop", "mobile"]) {
    const p = profiles[viewport];
    screen(
      "notifications",
      "Notifications",
      viewport,
      overlay(
        shell("guidelines", p),
        p,
        use("drawer", "NotificationsDrawer", { viewport }),
        { x: p.mobile ? 0 : 257, y: 0 },
      ),
      {
        limitations: p.mobile
          ? [
              "Observed401px drawer overflows390px viewport by11px; bottom bar remains visible.",
            ]
          : [],
      },
    );
    screen(
      "account-settings",
      "Account settings",
      viewport,
      overlay(
        shell(p.mobile ? "libraries" : "brands", p),
        p,
        use("drawer", "AccountSettingsDrawer", { viewport }),
        { x: p.mobile ? 0 : 257, y: 0 },
      ),
    );
    screen(
      "user-menu",
      "User menu",
      viewport,
      overlay(
        shell(p.mobile ? "libraries" : "brands", p),
        p,
        use("menu", "UserMenu", { viewport }),
        { x: p.mobile ? 0 : 273, y: p.mobile ? 0 : 376, backdrop: false },
      ),
    );
    screen(
      "help",
      "Help",
      viewport,
      overlay(
        shell(p.mobile ? "libraries" : "brands", p),
        p,
        use("dialog", "HelpDialog", { viewport }),
        {
          x: p.mobile ? 16 : (p.width - 600) / 2,
          y: (p.height - 374) / 2,
          overRail: true,
        },
      ),
    );
    screen(
      "search-blank",
      "Global search blank",
      viewport,
      overlay(
        shell(p.mobile ? "libraries" : "fonts", p),
        p,
        use("search", "GlobalSearch", { viewport, state: "blank" }),
        { x: p.mobile ? 16 : (p.width - 600) / 2, y: 80, overRail: true },
      ),
    );
    screen(
      "brand-library-loaded",
      "Brand libraries overview",
      viewport,
      shell("libraries", p),
    );
    for (const state of ["collapsed", "expanded"])
      screen(
        "essentials-colors-" + state,
        "Essentials colors " + state,
        viewport,
        shell(
          "colors",
          p,
          use("palettes", "EssentialsPaletteList", { viewport, state }),
        ),
        {
          state,
          limitations:
            p.mobile && state === "expanded"
              ? [
                  "Dense expanded table extends horizontally beyond the390px viewport, as observed.",
                ]
              : [],
        },
      );
  }
  screen(
    "search-results",
    "Global search results",
    "desktop",
    overlay(
      shell("fonts", profiles.desktop),
      profiles.desktop,
      use("search", "GlobalSearch", { viewport: "desktop", state: "results" }),
      { x: 564, y: 80, overRail: true },
    ),
    { state: "results" },
  );
  screen(
    "brand-guidelines-empty",
    "Brand guidelines empty",
    "desktop",
    shell("guidelines", profiles.desktop),
    { state: "empty" },
  );
  screen(
    "essentials-fonts-empty",
    "Essentials fonts empty",
    "desktop",
    shell("fonts", profiles.desktop),
    { state: "empty" },
  );
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    const p = profiles[viewport];
    const agenticBar = c.bottom("brands");
    agenticBar.children[0].children.find(
      (n) => n.id === "workspace-copy",
    ).children[0].text = "Agentic hub";
    screen(
      "agentic-hub",
      "Agentic hub",
      viewport,
      frame(
        "screen",
        p.mobile
          ? [
              use("content", "AgenticHubContent", { viewport }),
              abs(
                shared(
                  "mobile-bar",
                  "MobileBrandBar",
                  { page: "agentic" },
                  agenticBar,
                ),
                0,
                p.height - 68,
              ),
            ]
          : [
              shared(
                "rail",
                "NavigationRail",
                { page: "agentic", height: String(p.height) },
                agenticRail(p),
              ),
              use("content", "AgenticHubContent", { viewport }),
            ],
        {
          layout: "HORIZONTAL",
          width: p.width,
          height: p.height,
          clipContent: true,
          bindings: { fills: S.surface },
        },
      ),
    );
  }
  return { patterns, screens, imageSlots, sourceReference };
}
