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
  "fills",
  "strokes",
  "strokeWeight",
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
function metadata(node: any) {
  return Object.fromEntries(
    ["identity", "component-binding", "data-binding", "example-binding"]
      .map((key) => [key, shared(node, key)])
      .filter(([, value]) => value),
  );
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
        managed: metadata(node),
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
        if (
          target.type === "INSTANCE" &&
          override.overriddenFields.includes("componentProperties")
        ) {
          const linked =
            typeof target.getMainComponentAsync === "function"
              ? await target.getMainComponentAsync()
              : target.mainComponent;
          const defaults =
            linked?.componentPropertyDefinitions ??
            linked?.parent?.componentPropertyDefinitions ??
            {};
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
  return canonical(await visit(asset));
}
