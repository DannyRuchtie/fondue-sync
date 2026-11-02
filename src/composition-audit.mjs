/** Product patterns compose canonical controls; frames remain valid for layout/art. */
const policies = {
  ProductionNavigationRail:
    /^(utility-\d+|nav-.+|overview|feature-\d+|navigation-search)$/,
  ProductionMobileBrandBar: /^(more)$/,
  ProductionPageHeader:
    /^(new-action-group|selected-tab|tab-colors|tab-fonts|add)$/,
  ProductionSearchToolbar:
    /^(unboxed-search|search|sort-trigger|grid-selected|list)$/,
  ProductionBrandCard: /^(banner|brand-thumbnail|brand-name|more)$/,
  ProductionGuidelineCard: /^(banner|guideline-name|page-count|more)$/,
  ProductionLibraryCard:
    /^(banner|library-thumbnail|library-name|asset-count)$/,
  ProductionLibrariesEmptyState: /^(create)$/,
  ProductionNotificationsDrawer:
    /^(unread-label|history|view|open|mark-all|close|read)$/,
  ProductionUserMenu: /^(edit-action|logout-action)$/,
  ProductionAccountSettingsDrawer:
    /^(header|workspace-name|switch|setting-\d+|admin)$/,
  ProductionHelpDialog: /^(close)$/,
  ProductionGlobalSearch: /^(input|show-all)$/,
  ProductionGuidelinesEmpty: /^(create)$/,
  ProductionFontsEmpty: /^(create)$/,
  ProductionObservedLibraryCard: /^(cover|library-thumb|name|count)$/,
  ProductionEssentialsPaletteList:
    /^(edit|delete|add-color|column-\d+|name-cell|rgba-cell|hex-cell)$/,
  ProductionAgenticHubContent: /^(learn)$/,
};

// Rich content uses open layout wrappers, but its controls/anatomy must still
// come from base components rather than a newly authored pattern wrapper.
const composedRules = {
  ProductionNavigationRail: [
    { id: /^(brand-switcher|account)$/, needs: [/^Button(?:\/|$)/] },
  ],
  ProductionMobileBrandBar: [
    { id: /^(workspace|account)$/, needs: [/^Button(?:\/|$)/] },
  ],
  ProductionSearchToolbar: [{ id: /^sort$/, needs: [/^Button(?:\/|$)/] }],
  ProductionNotificationsDrawer: [
    {
      id: /^notification-header$/,
      needs: [/^Tabs\/Trigger$/, /^Button(?:\/|$)/],
    },
    { id: /^actions$/, needs: [/^Button(?:\/|$)/] },
    { id: /^unread$/, needs: [/^Tabs\/Trigger$/, /^Badge(?:\/|$)/] },
  ],
  ProductionUserMenu: [
    { id: /^menu-item-/, needs: [/^Button(?:\/|$)/, /^Card\/ThumbnailIcon$/] },
  ],
  ProductionHelpDialog: [
    { id: /^help-row-/, needs: [/^Button(?:\/|$)/, /^Card\/ThumbnailIcon$/] },
  ],
  ProductionEssentialsPaletteList: [
    { id: /^label-group$/, needs: [/^Accordion(?:\/|$)/] },
    { id: /^color-table$/, needs: [/^Table\/HeaderCell$/, /^Table\/RowCell$/] },
    { id: /^columns$/, needs: [/^Table\/HeaderCell$/] },
    { id: /^color-\d+$/, needs: [/^Table\/RowCell$/] },
  ],
};
const referenceMatches = (node, recipe) =>
  node.recipeId
    ? recipe.id === node.recipeId
    : recipe.name.split("/")[0] === node.componentName;
const canonicalNames = (node, recipes) =>
  recipes
    .filter((r) => r.id.startsWith("components/") && referenceMatches(node, r))
    .map((r) => r.name);

// Decorative lettering and diagrams are authored artwork, not UI controls.
const artwork =
  /(?:^|\/)(?:[^/]*illustration[^/]*|automation-hero|font-styles|font-card|gallery-card|text-card)(?:\/|$)/;
function visit(node, fn, path = "") {
  const current = path + "/" + node.id;
  fn(node, current);
  for (const child of node.children ?? []) visit(child, fn, current);
}

export function productPatternCompositionReport(recipes) {
  return recipes
    .filter((r) => r.id.startsWith("patterns/Production"))
    .map((recipe) => {
      const dependencies = new Set();
      let controls = 0,
        layoutFrames = 0,
        artworkLayers = 0;
      for (const variant of recipe.variants)
        visit(variant.root, (node, path) => {
          if (artwork.test(path)) artworkLayers++;
          if (node.kind === "frame") layoutFrames++;
          if (node.kind === "componentInstance") {
            dependencies.add(node.recipeId ?? node.componentName);
            if (node.componentRole || policies[recipe.name]?.test(node.id))
              controls++;
          }
        });
      return {
        id: recipe.id,
        name: recipe.name,
        reviewed: recipe.name in policies,
        variants: recipe.variants.length,
        controls,
        layoutFrames,
        artworkLayers,
        dependencies: [...dependencies].sort(),
      };
    });
}

export function auditProductPatternComposition(recipes) {
  const issues = [];
  for (const recipe of recipes.filter((r) =>
    r.id.startsWith("patterns/Production"),
  )) {
    const rule = policies[recipe.name];
    if (!rule)
      issues.push({
        code: "unaudited-pattern",
        recipeId: recipe.id,
        message:
          "Classify the controls and permitted layout/artwork of this new product pattern.",
      });
    for (const variant of recipe.variants)
      visit(variant.root, (node, path) => {
        const context = `${recipe.id}/${variant.id}${path}`;
        if (
          !artwork.test(path) &&
          (node.componentRole || rule?.test(node.id)) &&
          node.kind !== "componentInstance"
        )
          issues.push({
            code: "recreated-control",
            recipeId: recipe.id,
            path,
            message: `Use a canonical base component instance for ${context}.`,
          });
        if (
          node.kind === "text" &&
          node.fontFamily !== "Cranny" &&
          !artwork.test(path)
        )
          issues.push({
            code: "standalone-ui-text",
            recipeId: recipe.id,
            path,
            message: `Use a Text or Heading component for ${context}.`,
          });
        for (const wrapper of composedRules[recipe.name] ?? []) {
          if (
            !wrapper.id.test(node.id) ||
            (node.kind === "componentInstance" &&
              ["Text", "Heading"].includes(node.componentName))
          )
            continue;
          const references = [];
          visit(node, (child) => {
            if (child.kind === "componentInstance")
              references.push(...canonicalNames(child, recipes));
          });
          for (const required of wrapper.needs)
            if (!references.some((name) => required.test(name)))
              issues.push({
                code: "missing-composed-control",
                recipeId: recipe.id,
                path,
                message: `Compose ${context} using canonical ${required.source} anatomy.`,
              });
        }
        if (node.kind !== "componentInstance") return;
        const candidates = recipes.filter((r) => referenceMatches(node, r));
        if (
          (node.componentRole || rule?.test(node.id)) &&
          !candidates.some((r) => r.id.startsWith("components/"))
        )
          issues.push({
            code: "nonbase-control",
            recipeId: recipe.id,
            path,
            message: `Control ${context} must reference Source components / Components, not another product pattern.`,
          });
        if (
          !candidates.some((r) =>
            r.variants.some((v) =>
              Object.entries(node.variantProps ?? {}).every(
                ([k, value]) => String(v.props[k]) === String(value),
              ),
            ),
          )
        )
          issues.push({
            code: "missing-base-component",
            recipeId: recipe.id,
            path,
            message: `No canonical component/variant resolves ${context}: ${node.recipeId ?? node.componentName}.`,
          });
      });
  }
  return issues;
}
