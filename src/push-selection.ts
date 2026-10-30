import { read } from "./metadata";
import { canonical } from "./plan";
import { snapshot, normalizeSavedSnapshot } from "./snapshot";
import type { Bundle } from "./schema";

export type PushIssue = {
  code: string;
  message: string;
  nodeId?: string;
  blocking: true;
};
export type PushChange = {
  id: string;
  selectionId: string;
  nodeId: string;
  recipeId: string;
  componentName: string;
  variantId: string;
  layerId: string;
  property: string;
  before: any;
  after: any;
  tokenIds: string[];
  scope: "component" | "shared-token";
};
export type PushToken = {
  id: string;
  variableId: string;
  name: string;
  type: string;
  values: Record<string, any>;
  existing: boolean;
  before?: any;
  css?: string;
  provenance?: any;
  requiresName?: boolean;
};
export type SelectionReport = {
  schemaVersion: 1;
  release: string;
  fingerprint: string;
  sourceCommit: string;
  figmaFileKey?: string;
  selectionIds: string[];
  components: {
    selectionId: string;
    nodeId: string;
    recipeId: string;
    componentName: string;
    variantId: string;
    layerId: string;
    isInstance: boolean;
  }[];
  changes: PushChange[];
  tokens: PushToken[];
  issues: PushIssue[];
  warnings: string[];
};
const visual = new Set([
  "width",
  "height",
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
  "opacity",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "boundVariables",
]);
// Content and exposed property choices belong to a product instance.
// These remain unsupported when editing a main component definition.
const instanceConfiguration = new Set([
  "characters",
  "componentProperties",
  "componentPropertyReferences",
]);
function instanceProposalSnapshot(value: any): any {
  if (!value || typeof value !== "object") return value;
  const result = copy(value);
  if (Array.isArray(result.overrides))
    result.overrides = result.overrides
      .map((entry: any) => ({
        ...entry,
        fields: Object.fromEntries(
          Object.entries(entry.fields ?? {}).filter(
            ([key]) => !instanceConfiguration.has(key),
          ),
        ),
      }))
      .filter(
        (entry: any) =>
          Object.keys(entry.fields).some((key) => key !== "managed") ||
          entry.missing,
      );
  return result;
}
const ignored = new Set([
  "children",
  "managed",
  "name",
  "description",
  "documentationLinks",
  "relativeTransform",
  "x",
  "y",
]);
const copy = (v: any) =>
  v === undefined ? null : JSON.parse(JSON.stringify(v));
function stored(n: any, k: string): string {
  return typeof n?.getSharedPluginData === "function" ? read(n, k) : "";
}
function parsed(n: any, k: string): any {
  const raw = stored(n, k);
  return raw ? JSON.parse(raw) : undefined;
}
function aliases(v: any): string[] {
  if (!v || typeof v !== "object") return [];
  if (v.type === "VARIABLE_ALIAS" && typeof v.id === "string") return [v.id];
  return [...new Set(Object.values(v).flatMap(aliases))];
}
function walk(n: any, visit: (n: any) => void, root = true) {
  visit(n);
  if (!root && n.type === "INSTANCE") return;
  for (const c of n.children ?? []) walk(c, visit, false);
}
const identity = (n: any) => stored(n, "identity");
function atPath(root: any, path: string[]) {
  let n = root;
  for (const id of path) {
    const matches = (n.children ?? []).filter(
      (c: any) => c.managed?.identity === id,
    );
    if (matches.length !== 1) return undefined;
    n = matches[0];
  }
  return n;
}
/** Read only selected objects and token dependencies; never advances sync baselines. */
export async function inspectSelection(
  api: any,
  bundle: Bundle,
): Promise<SelectionReport> {
  const selected: any[] = [...(api.currentPage?.selection ?? [])];
  const result: SelectionReport = {
    schemaVersion: 1,
    release: bundle.release,
    fingerprint: bundle.fingerprint,
    sourceCommit:
      bundle.provenance.commit ?? bundle.provenance.sourceCommit ?? "",
    ...(typeof api.fileKey === "string" && api.fileKey
      ? { figmaFileKey: api.fileKey }
      : {}),
    selectionIds: selected.map((n) => n.id),
    components: [],
    changes: [],
    tokens: [],
    issues: [],
    warnings: [],
  };
  const issue = (code: string, message: string, nodeId?: string) =>
    result.issues.push({ code, message, nodeId, blocking: true });
  if (!selected.length) {
    issue(
      "empty-selection",
      "Select a Fondue component or a layer inside one.",
    );
    return result;
  }
  const tokens = new Map<string, PushToken>(),
    visiting = new Set<string>();
  const tokenFor = async (
    variableId: string,
  ): Promise<PushToken | undefined> => {
    if (visiting.has(variableId)) {
      issue(
        "token-alias-cycle",
        "A selected token contains an alias cycle.",
        variableId,
      );
      return;
    }
    if (tokens.has(variableId)) return tokens.get(variableId);
    visiting.add(variableId);
    try {
      const variable = await api.variables.getVariableByIdAsync(variableId);
      if (!variable) {
        issue(
          "missing-token",
          "A selected property references a missing variable.",
          variableId,
        );
        return;
      }
      const applied = parsed(variable, "applied"),
        def = applied ? JSON.parse(applied.definition) : undefined;
      const collection = await api.variables.getVariableCollectionByIdAsync(
        variable.variableCollectionId,
      );
      if (!collection) {
        issue(
          "missing-token-collection",
          "A selected variable has no available collection.",
          variableId,
        );
        return;
      }
      const values: Record<string, any> = {};
      for (const [modeId, value] of Object.entries(
        variable.valuesByMode ?? {},
      )) {
        const mode = collection.modes.find((m: any) => m.modeId === modeId);
        if (!mode) {
          issue(
            "missing-token-mode",
            "A selected variable refers to an unknown mode.",
            variableId,
          );
          continue;
        }
        const ids = aliases(value);
        if (ids.length) {
          const target = await tokenFor(ids[0]);
          if (target) values[mode.name] = { alias: target.id };
        } else values[mode.name] = copy(value);
      }
      const token: PushToken = {
        id: def?.id ?? `new:${variableId}`,
        variableId,
        name: def?.name ?? variable.name,
        type: variable.resolvedType,
        values,
        existing: !!def,
        ...(def
          ? { before: def.values, css: def.css, provenance: def.provenance }
          : {}),
      };
      tokens.set(variableId, token);
      if (def && applied) {
        const before = JSON.parse(normalizeSavedSnapshot(applied.snapshot));
        if (
          canonical(before.valuesByMode) !== canonical(variable.valuesByMode)
        ) {
          result.changes.push({
            id: `token:${token.id}`,
            selectionId: selected[0].id,
            nodeId: variableId,
            recipeId: "",
            componentName: "Shared token",
            variantId: "",
            layerId: "",
            property: "valuesByMode",
            before: copy(def.values),
            after: values,
            tokenIds: [token.id],
            scope: "shared-token",
          });
          result.warnings.push(
            `Changing ${token.name} affects every consumer of this shared token.`,
          );
        }
      }
      return token;
    } catch (e) {
      issue("invalid-token", String(e), variableId);
      return;
    } finally {
      visiting.delete(variableId);
    }
  };
  const canonicalAliases = async (
    v: any,
    includeDependencies = true,
  ): Promise<any> => {
    if (Array.isArray(v))
      return Promise.all(
        v.map((value) => canonicalAliases(value, includeDependencies)),
      );
    if (!v || typeof v !== "object") return copy(v);
    if (v.type === "VARIABLE_ALIAS" && typeof v.id === "string") {
      if (!includeDependencies) {
        const variable = await api.variables.getVariableByIdAsync(v.id);
        const applied = parsed(variable, "applied");
        const id = applied ? JSON.parse(applied.definition).id : `new:${v.id}`;
        return { type: "VARIABLE_ALIAS", id };
      }
      const t = await tokenFor(v.id);
      return { type: "VARIABLE_ALIAS", id: t?.id ?? v.id };
    }
    return Object.fromEntries(
      await Promise.all(
        Object.entries(v).map(async ([k, x]) => [
          k,
          await canonicalAliases(x, includeDependencies),
        ]),
      ),
    );
  };
  const emitted = new Map<string, string>();
  const roots = selected.filter(
    (n) =>
      !selected.some((other) => {
        if (n === other) return false;
        for (let p = n.parent; p; p = p.parent) if (p === other) return true;
        return false;
      }),
  );
  for (const selection of roots) {
    try {
      let component = selection;
      while (
        component &&
        !["COMPONENT", "COMPONENT_SET", "INSTANCE"].includes(component.type)
      )
        component = component.parent;
      if (!component) {
        issue(
          "unmanaged-selection",
          "The selected object is not inside a mapped Fondue component.",
          selection.id,
        );
        continue;
      }
      const isInstance = component.type === "INSTANCE",
        main = isInstance ? await component.getMainComponentAsync() : component;
      if (!main) {
        issue(
          "missing-main",
          "The selected instance has no accessible main component.",
          selection.id,
        );
        continue;
      }
      const owner = main.type === "COMPONENT_SET" ? main : main.parent,
        mapping = parsed(owner, "mapping"),
        applied = parsed(owner, "applied");
      const recipe = bundle.recipes.find(
        (r) => `recipe:${r.id}` === mapping?.id,
      );
      if (!recipe || !applied) {
        issue(
          "missing-baseline",
          "The selected component needs an imported Fondue source mapping and baseline.",
          selection.id,
        );
        continue;
      }
      if (mapping.release && mapping.release !== bundle.release) {
        issue(
          "baseline-release",
          "The selected component was imported from a different release; use the matching plugin bundle before proposing changes.",
          selection.id,
        );
        continue;
      }
      const oldDef = JSON.parse(applied.definition),
        saved = JSON.parse(normalizeSavedSnapshot(applied.snapshot));
      if (oldDef.id !== recipe.id) {
        issue(
          "baseline-identity",
          "The imported component baseline does not match its mapping.",
          selection.id,
        );
        continue;
      }
      if (recipe.package.includes("fondue-sync")) {
        issue(
          "plugin-owned-component",
          "This selection is a Fondue Sync pattern; it has no upstream component implementation.",
          selection.id,
        );
        continue;
      }
      if (isInstance)
        result.warnings.push(
          `Pushing ${recipe.name} proposes a shared component change from this instance override.`,
        );
      const mainVariant =
        main.type === "COMPONENT_SET" ? "" : stored(main, "variant");
      result.components.push({
        selectionId: selection.id,
        nodeId: selection.id,
        recipeId: recipe.id,
        componentName: recipe.name,
        variantId: mainVariant,
        layerId: identity(selection),
        isInstance,
      });
      const nodes: any[] = [];
      walk(selection, (n) => nodes.push(n));
      const overrides = new Map<string, Set<string>>();
      if (isInstance)
        for (const o of component.overrides ?? [])
          overrides.set(o.id, new Set(o.overriddenFields));
      for (const node of nodes) {
        if (node.type === "COMPONENT_SET") continue;
        let variant = mainVariant;
        const path: string[] = [];
        let current = node;
        while (current && current !== owner && current !== component) {
          path.unshift(identity(current));
          current = current.parent;
        }
        if (isInstance) path.unshift(identity(main));
        else if (component.type === "COMPONENT_SET") {
          let v = node;
          while (v && v.parent !== owner) v = v.parent;
          variant = v ? stored(v, "variant") : "";
        } else path.unshift(identity(component));
        if (path.some((id) => !id)) {
          issue(
            "missing-layer-identity",
            "A selected layer was added or lacks a stable source identity.",
            node.id,
          );
          continue;
        }
        const beforeNode = atPath(saved, path);
        if (!beforeNode) {
          issue(
            "missing-layer-baseline",
            "A selected layer cannot be located uniquely in the imported baseline.",
            node.id,
          );
          continue;
        }
        if (node.type === "INSTANCE" && node !== component) {
          const nestedSnapshot = JSON.parse(await snapshot(node));
          if (
            canonical(
              isInstance
                ? instanceProposalSnapshot(nestedSnapshot)
                : nestedSnapshot,
            ) !==
            canonical(
              isInstance ? instanceProposalSnapshot(beforeNode) : beforeNode,
            )
          )
            issue(
              "nested-instance-change",
              "Select the changed nested instance directly to propose its owning component change.",
              node.id,
            );
          continue;
        }
        let afterNode: any;
        if (node.type === "INSTANCE") {
          afterNode = { ...beforeNode };
          for (const prop of overrides.get(node.id) ?? []) {
            if (prop !== "pluginData") afterNode[prop] = copy(node[prop]);
          }
        } else afterNode = JSON.parse(await snapshot(node));
        if (
          !isInstance &&
          node.type !== "INSTANCE" &&
          canonical(
            (beforeNode.children ?? []).map((n: any) => n.managed?.identity),
          ) !==
            canonical(
              (afterNode.children ?? []).map((n: any) => n.managed?.identity),
            )
        )
          issue(
            "structural-change",
            "Selected layer children were removed, reordered or replaced; an explicit structural mapping is required.",
            node.id,
          );
        const keys = isInstance
          ? [...(overrides.get(node.id) ?? [])]
          : [
              ...new Set([
                ...Object.keys(beforeNode),
                ...Object.keys(afterNode),
              ]),
            ];
        for (const variableId of aliases(afterNode.boundVariables))
          await tokenFor(variableId);
        const fields = keys.flatMap((property) =>
          property === "boundVariables"
            ? [
                ...new Set([
                  ...Object.keys(beforeNode.boundVariables ?? {}),
                  ...Object.keys(afterNode.boundVariables ?? {}),
                ]),
              ].map((field) => `boundVariables.${field}`)
            : [property],
        );
        for (const property of fields) {
          if (ignored.has(property) || property === "pluginData") continue;
          if (isInstance && instanceConfiguration.has(property)) continue;
          if (
            isInstance &&
            (beforeNode.componentPropertyReferences?.[property] ||
              node.componentPropertyReferences?.[property])
          )
            continue;
          const boundField = property.startsWith("boundVariables.")
            ? property.slice(15)
            : undefined;
          const corners = [
            "topLeftRadius",
            "topRightRadius",
            "bottomLeftRadius",
            "bottomRightRadius",
          ];
          const strokes = [
            "strokeTopWeight",
            "strokeRightWeight",
            "strokeBottomWeight",
            "strokeLeftWeight",
          ];
          // Uniform combined fields are one authored edit; mixed geometry uses individual fields.
          if (
            corners.includes(property) &&
            typeof afterNode.cornerRadius === "number"
          )
            continue;
          if (
            strokes.includes(property) &&
            typeof afterNode.strokeWeight === "number"
          )
            continue;
          if (
            property === "cornerRadius" &&
            typeof afterNode.cornerRadius !== "number" &&
            corners.some((field) => afterNode[field] !== undefined)
          )
            continue;
          if (
            property === "strokeWeight" &&
            typeof afterNode.strokeWeight !== "number" &&
            strokes.some((field) => afterNode[field] !== undefined)
          )
            continue;
          if (
            boundField === "cornerRadius" &&
            !afterNode.boundVariables?.cornerRadius &&
            corners.some((field) => afterNode[field] !== undefined)
          )
            continue;
          if (
            boundField === "strokeWeight" &&
            !afterNode.boundVariables?.strokeWeight &&
            strokes.some((field) => afterNode[field] !== undefined)
          )
            continue;
          // Resolved numeric values disappear from normalized snapshots when bound;
          // the binding change is the authored edit, rather than a deleted value.
          if (
            !boundField &&
            (afterNode.boundVariables?.[property] ||
              (/Radius$/.test(property) &&
                afterNode.boundVariables?.cornerRadius))
          )
            continue;
          if (
            boundField &&
            afterNode.boundVariables?.[boundField] === undefined &&
            afterNode[boundField] !== undefined
          )
            continue;
          const before = await canonicalAliases(
              boundField
                ? beforeNode.boundVariables?.[boundField]
                : beforeNode[property],
              false,
            ),
            after = await canonicalAliases(
              boundField
                ? afterNode.boundVariables?.[boundField]
                : afterNode[property],
            );
          if (canonical(before) === canonical(after)) continue;
          if (!visual.has(boundField ?? property)) {
            issue(
              "unsupported-property",
              `The selected ${property} change requires an explicit source mapping.`,
              node.id,
            );
            continue;
          }
          const id = `${recipe.id}:${variant}:${path.join("/")}:${property}`;
          const signature = canonical({ before, after });
          const previous = emitted.get(id);
          if (previous !== undefined) {
            if (previous !== signature)
              issue(
                "conflicting-selection",
                `Selected instances propose different values for ${recipe.name} / ${property}. Select one proposal for this shared component property.`,
                node.id,
              );
            continue;
          }
          emitted.set(id, signature);
          const tokenIds = aliases(after);
          if (!boundField && !tokenIds.length && typeof after === "number") {
            const role =
                property === "opacity"
                  ? "opacity"
                  : /radius/i.test(property)
                    ? "radius"
                    : /stroke/i.test(property)
                      ? "border-width"
                      : /width|height/i.test(property)
                        ? "size"
                        : /font|lineHeight|letterSpacing/i.test(property)
                          ? "typography"
                          : "spacing",
              proposalId = `literal:${id}`;
            tokens.set(proposalId, {
              id: proposalId,
              variableId: "",
              name: "",
              type: "FLOAT",
              values: { Value: after },
              existing: false,
              requiresName: true,
              provenance: {
                role,
                unit: property === "opacity" ? "number" : "px",
              },
            });
            tokenIds.push(proposalId);
          }
          if (["fills", "strokes"].includes(property) && !tokenIds.length) {
            if (
              Array.isArray(after) &&
              after.length === 1 &&
              after[0].type === "SOLID" &&
              after[0].color
            ) {
              const proposalId = `literal:${id}`;
              tokens.set(proposalId, {
                id: proposalId,
                variableId: "",
                name: "",
                type: "COLOR",
                values: {
                  Value: { ...after[0].color, a: after[0].opacity ?? 1 },
                },
                existing: false,
                requiresName: true,
                provenance: { role: "color" },
              });
              tokenIds.push(proposalId);
            } else
              issue(
                "unsupported-paint",
                "Only a single solid color can currently become a new color token.",
                node.id,
              );
          }
          result.changes.push({
            id,
            selectionId: selection.id,
            nodeId: node.id,
            recipeId: recipe.id,
            componentName: recipe.name,
            variantId: variant,
            layerId: path[path.length - 1],
            property,
            before,
            after,
            tokenIds,
            scope: "component",
          });
        }
      }
    } catch (e) {
      issue("invalid-selection", String(e), selection.id);
    }
  }
  result.tokens = [...tokens.values()];
  result.warnings = [...new Set(result.warnings)];
  return result;
}
