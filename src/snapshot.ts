import { canonical } from "./plan";
import { read } from "./metadata";
const properties = [
  "type",
  "name",
  "width",
  "height",
  "visible",
  "opacity",
  "layoutMode",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "itemSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "fills",
  "strokes",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "effects",
  "characters",
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textStyleId",
  "effectStyleId",
  "boundVariables",
  "componentPropertyReferences",
  "componentPropertyDefinitions",
  "resolvedType",
  "valuesByMode",
  "scopes",
  "codeSyntax",
  "variableCollectionId",
  "textCase",
  "description",
  "documentationLinks",
  "rotation",
  "relativeTransform",
  "vectorPaths",
  "vectorNetwork",
  "arcData",
  "strokeAlign",
  "strokeCap",
  "strokeJoin",
  "strokeDashes",
  "cornerSmoothing",
  "textAlignHorizontal",
  "textAlignVertical",
  "textAutoResize",
  "clipsContent",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "layoutAlign",
  "layoutGrow",
  "layoutPositioning",
];
function shared(node: any, key: string): string {
  if (typeof node.getSharedPluginData !== "function") return "";
  return read(node, key);
}
function metadata(node: any, main?: any) {
  const result = Object.fromEntries(
    [
      "identity",
      "instance-identity",
      "component-binding",
      "data-binding",
      "example-binding",
      ...(node.type === "INSTANCE" ? [] : ["variant-props"]),
    ]
      .map((key) => [key, shared(node, key)])
      .filter(([, value]) => value),
  );
  // Legacy failed clones inherit later main-component plugin data. That is not a local edit.
  if (
    node.type === "INSTANCE" &&
    !result["instance-identity"] &&
    !result["component-binding"] &&
    result.identity &&
    main &&
    result.identity === shared(main, "identity")
  )
    delete result.identity;
  return result;
}
function autoPositioned(node: any) {
  return (
    node.parent?.layoutMode &&
    node.parent.layoutMode !== "NONE" &&
    node.layoutPositioning !== "ABSOLUTE"
  );
}
function autoDimension(node: any, key: string) {
  if (
    !["width", "height"].includes(key) ||
    !node.layoutMode ||
    node.layoutMode === "NONE"
  )
    return false;
  const primary = (key === "width") === (node.layoutMode === "HORIZONTAL");
  return (
    (primary ? node.primaryAxisSizingMode : node.counterAxisSizingMode) ===
    "AUTO"
  );
}
const cornerFields = [
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
];
const strokeFields = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
];
const alias = (value: any): boolean =>
  Array.isArray(value)
    ? value.length > 0 && value.every(alias)
    : !!value &&
      value.type === "VARIABLE_ALIAS" &&
      typeof value.id === "string";
const hasBinding = (bindings: any, key: string) =>
  !!bindings && alias(bindings[key]);
function safelyBoundVariables(node: any) {
  try {
    return node.boundVariables;
  } catch {
    return undefined;
  }
}
/** Native bound fields expose resolved values as well as aliases. Only the alias is
 * authored state; its current value follows variables/modes and is not local drift.
 * Alias maps, unbound values, explicit paint opacity, and variable.valuesByMode stay intact.
 */
function normalizeAuthoredObject(input: any): any {
  if (Array.isArray(input)) return input.map(normalizeAuthoredObject);
  if (!input || typeof input !== "object") return input;
  const node: any = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      normalizeAuthoredObject(value),
    ]),
  );
  const bindings = node.boundVariables;
  for (const field of [
    "width",
    "height",
    "visible",
    "opacity",
    "itemSpacing",
    "counterAxisSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "paragraphSpacing",
    "paragraphIndent",
    "fontWeight",
  ])
    if (hasBinding(bindings, field)) delete node[field];
  for (const [combined, fields] of [
    ["cornerRadius", cornerFields],
    ["strokeWeight", strokeFields],
  ] as const) {
    // Older snapshots captured only uniform combined values. Expanding a KNOWN
    // uniform value upgrades their representation without guessing mixed geometry.
    if (typeof node[combined] === "number")
      for (const field of fields)
        if (node[field] === undefined) node[field] = node[combined];
    const combinedBound = hasBinding(bindings, combined),
      individualBound = fields.some((field) => hasBinding(bindings, field));
    if (combinedBound || individualBound) delete node[combined];
    for (const field of fields)
      if (combinedBound || hasBinding(bindings, field)) delete node[field];
  }
  if (node.fontName && hasBinding(bindings, "fontWeight")) {
    delete node.fontName.style;
    if (node.fontName.variationSettings)
      delete node.fontName.variationSettings.wght;
  }
  for (const field of ["fills", "strokes"])
    if (Array.isArray(node[field]))
      node[field] = node[field].map((paint: any, index: number) => {
        if (!paint || typeof paint !== "object") return paint;
        if (
          paint.type === "SOLID" &&
          (hasBinding(paint.boundVariables, "color") ||
            (node[field].length === 1 && hasBinding(bindings, field)))
        )
          delete paint.color;
        if (hasBinding(paint.boundVariables, "opacity")) delete paint.opacity;
        return paint;
      });
  // Effects have their own precise field aliases. An aggregate node.effects alias
  // cannot identify a field and is therefore never used to discard literal values.
  if (Array.isArray(node.effects))
    node.effects = node.effects.map((effect: any) => {
      if (!effect || typeof effect !== "object") return effect;
      const bound = effect.boundVariables;
      for (const field of ["color", "radius", "spread"])
        if (hasBinding(bound, field)) delete effect[field];
      if (effect.offset) {
        if (hasBinding(bound, "offsetX")) delete effect.offset.x;
        if (hasBinding(bound, "offsetY")) delete effect.offset.y;
        if (!Object.keys(effect.offset).length) delete effect.offset;
      }
      return effect;
    });
  return node;
}
/** Upgrade a previously persisted snapshot with the same alias-only comparison.
 * This does not rewrite variable values or relax source/ownership metadata. Invalid
 * saved JSON throws so a corrupt baseline requires review rather than being blessed.
 */
export function normalizeSavedSnapshot(serialized: string): string {
  return canonical(normalizeAuthoredObject(JSON.parse(serialized)));
}
function directFieldBindings(
  node: any,
  keys: string[],
): Record<string, any> | undefined {
  const source = safelyBoundVariables(node);
  if (!source || typeof source !== "object") return undefined;
  const fields = new Set(keys);
  if (fields.has("cornerRadius"))
    cornerFields.forEach((key) => fields.add(key));
  if (fields.has("strokeWeight"))
    strokeFields.forEach((key) => fields.add(key));
  const selected = Object.fromEntries(
    [...fields]
      .filter((key) => hasBinding(source, key))
      .map((key) => [key, source[key]]),
  );
  return Object.keys(selected).length ? selected : undefined;
}
function value(node: any, key: string, asset: any) {
  if (key === "width" || key === "height") {
    if (autoDimension(node, key)) return undefined;
  }
  if (["x", "y"].includes(key) && (node === asset || autoPositioned(node)))
    return undefined;
  const original = node[key];
  if (original === undefined || typeof original === "symbol") return undefined;
  const copy = JSON.parse(JSON.stringify(original));
  if (key === "relativeTransform" && (node === asset || autoPositioned(node))) {
    copy[0][2] = 0;
    copy[1][2] = 0;
  }
  return copy;
}
/** Capture authored state, rather than the rendered inheritance of component instances.
 * InstanceNode.overrides is direct-only in the Plugin API. Source updates can therefore
 * change inherited text, geometry and paint without being classified as local edits.
 * This is a structural guard; real Figma propagation remains a native acceptance check.
 */
export async function snapshot(asset: any): Promise<string> {
  const visit = async (node: any): Promise<any> => {
    if (node.type === "INSTANCE") {
      const main =
        typeof node.getMainComponentAsync === "function"
          ? await node.getMainComponentAsync()
          : node.mainComponent;
      const result: any = {
        type: "INSTANCE",
        mainComponentId: main?.id ?? null,
        managed: metadata(node, main),
        isExposedInstance: node.isExposedInstance ?? false,
      };
      const descendants = new Map<string, any>();
      const collect = (n: any) => {
        descendants.set(n.id, n);
        for (const c of n.children ?? []) collect(c);
      };
      collect(node);
      const records = [];
      for (const override of node.overrides ?? []) {
        const target = descendants.get(override.id);
        const fields: Record<string, any> = {};
        if (!target) {
          records.push({ id: override.id, missing: true });
          continue;
        }
        for (const key of [...override.overriddenFields].sort()) {
          // Plugin metadata has a separate stable representation. Inherited property defaults
          // are not direct visual overrides; descendant fields record text/boolean/swap effects.
          if (key === "pluginData" || key === "componentProperties") continue;
          try {
            const v = value(target, key, asset);
            if (v !== undefined) fields[key] = v;
          } catch {
            fields[key] = "[unreadable]";
          }
        }
        if (!override.overriddenFields.includes("boundVariables")) {
          const bound = directFieldBindings(target, override.overriddenFields);
          if (bound) fields.boundVariables = bound;
        }
        if (
          target.type === "INSTANCE" &&
          override.overriddenFields.includes("componentProperties")
        ) {
          const linked =
            typeof target.getMainComponentAsync === "function"
              ? await target.getMainComponentAsync()
              : target.mainComponent;
          const propertyOwner =
            linked?.parent?.type === "COMPONENT_SET" ? linked.parent : linked;
          const defaults = propertyOwner?.componentPropertyDefinitions ?? {};
          const explicit: any = {};
          for (const [key, property] of Object.entries(
            target.componentProperties ?? {},
          ) as [string, any][]) {
            // Include an explicitly authored key even when it currently equals its main default.
            const referenced = (node.overrides ?? []).some((o: any) => {
              const t = descendants.get(o.id);
              return Object.entries(t?.componentPropertyReferences ?? {}).some(
                ([field, id]) =>
                  id === key && o.overriddenFields.includes(field),
              );
            });
            if (
              referenced ||
              !defaults[key] ||
              property.value !== defaults[key].defaultValue
            )
              explicit[key] = property;
          }
          fields.componentProperties = explicit;
          if (target !== node) fields.mainComponentId = linked?.id ?? null;
        }
        const managed = metadata(target);
        if (Object.keys(managed).length) fields.managed = managed;
        if (Object.keys(fields).length)
          records.push({ id: override.id, fields });
      }
      result.overrides = records.sort((a, b) => a.id.localeCompare(b.id));
      // Authored metadata on nested pattern slots must remain inspectable even without
      // a visual override. Inherited metadata belongs to the source and is excluded.
      return result;
    }
    const result: Record<string, any> = {};
    for (const key of properties) {
      try {
        if (
          key === "componentPropertyDefinitions" &&
          node.type === "COMPONENT" &&
          node.parent?.type === "COMPONENT_SET"
        )
          continue;
        if (key in node) {
          const v = value(node, key, asset);
          if (v !== undefined) result[key] = v;
        }
      } catch {
        /* Mixed or unavailable properties are not serialized. */
      }
    }
    const managed = metadata(node);
    if (Object.keys(managed).length) result.managed = managed;
    if (node !== asset && !autoPositioned(node)) {
      result.x = node.x;
      result.y = node.y;
    }
    if (node.children)
      result.children = await Promise.all(node.children.map(visit));
    return result;
  };
  return canonical(normalizeAuthoredObject(await visit(asset)));
}
