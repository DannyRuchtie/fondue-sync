import type { Bundle, Layer, Recipe, Token } from "./schema";
import {
  canonical,
  decide,
  type Action,
  type Entry,
  type RecordEntry,
} from "./plan";
import { snapshot } from "./snapshot";
import { bundleProblems, migrationProblems } from "./preflight";
import { read, write } from "./metadata";
type Index = {
  schema: 1 | 2;
  fontWarnings?: string[];
  pendingCollections?: string[];
  warnings?: string[];
  release?: string;
  fingerprint?: string;
  assets: Record<string, { id: string; kind: Entry["kind"] }>;
  collections: Record<string, string>;
  pages: Record<string, string>;
};
export type Report = {
  release: string;
  fingerprint: string;
  actions: Action[];
  warnings: string[];
  errors: string[];
  counts: Record<string, number>;
  complete: boolean;
};
export class SyncEngine {
  api: PluginAPI;
  bundle: Bundle;
  index: Index;
  warnings: string[] = [];
  font: FontName = { family: "Inter", style: "Regular" };
  fonts = new Map<string, Promise<FontName>>();
  tokenCache = new Map<string, Variable>();
  appliedPropertyDefaults = new Set<string>();
  lastSavedIndex: string | undefined;
  shardPayloads = new Map<number, string>();
  shardFor(id: string) {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++)
      hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
    return (hash >>> 0) % 16;
  }
  constructor(api: PluginAPI, bundle: Bundle) {
    this.api = api;
    this.bundle = bundle;
    const stored = read(api.root, "index");
    this.index = stored
      ? JSON.parse(stored)
      : { schema: 2, assets: {}, collections: {}, pages: {} };
    if ((this.index as any).assetShards === 16) {
      this.index.assets = {};
      for (let i = 0; i < 16; i++) {
        const data = read(api.root, "index_assets_" + i);
        if (!data) throw Error("Missing managed index shard " + i);
        this.shardPayloads.set(i, data);
        Object.assign(this.index.assets, JSON.parse(data));
      }
    }
    if (stored) this.lastSavedIndex = JSON.stringify(this.index);
    this.warnings = [...(this.index.warnings ?? this.index.fontWarnings ?? [])];
    if (this.index.schema !== 1 && this.index.schema !== 2)
      throw Error("Unsupported sync ledger. Use a compatible plugin version.");
  }
  save() {
    this.index.schema = 2;
    const serialized = JSON.stringify(this.index);
    if (serialized === this.lastSavedIndex) return;
    const shards: Array<Record<string, { id: string; kind: Entry["kind"] }>> =
      Array.from({ length: 16 }, () => ({}));
    for (const [key, ref] of Object.entries(this.index.assets))
      shards[this.shardFor(key)][key] = ref;
    for (let i = 0; i < 16; i++) {
      const payload = JSON.stringify(shards[i]);
      if (this.shardPayloads.get(i) !== payload) {
        write(this.api.root, "index_assets_" + i, payload);
        this.shardPayloads.set(i, payload);
      }
    }
    const { assets, ...header } = this.index;
    write(
      this.api.root,
      "index",
      JSON.stringify({ ...header, assetShards: 16 }),
    );
    this.lastSavedIndex = serialized;
  }
  entries(): { entry: Entry; value: any }[] {
    return (
      [
        ["token", this.bundle.tokens],
        ["style", this.bundle.styles],
        ["icon", this.bundle.icons],
        ["recipe", this.bundle.recipes],
        ["example", this.bundle.examples ?? []],
        [
          "guide",
          this.bundle.recipes.map((r) => ({
            id: r.id,
            name: r.name,
            documentation: r.documentation,
            release: this.bundle.release,
            limitations: r.limitations,
          })),
        ],
      ] as const
    ).flatMap(([kind, list]) =>
      list.map((value) => ({
        entry: {
          id: kind + ":" + value.id,
          kind,
          definition: canonical({
            ...value,
            ...(this.bundle.provenance.rendererRevision
              ? { rendererRevision: this.bundle.provenance.rendererRevision }
              : {}),
          }),
        },
        value,
      })),
    );
  }
  async resolve(id: string, kind: Entry["kind"]): Promise<any> {
    return kind === "token"
      ? this.api.variables.getVariableByIdAsync(id)
      : kind === "style"
        ? this.api.getStyleByIdAsync(id)
        : this.api.getNodeByIdAsync(id);
  }
  async inspect(): Promise<Report> {
    const actions: Action[] = [];
    for (const { entry } of this.entries()) {
      const ref = this.index.assets[entry.id];
      const asset = ref ? await this.resolve(ref.id, ref.kind) : null;
      let baseline: RecordEntry | undefined;
      if (asset) {
        const raw = read(asset, "applied");
        if (raw) baseline = JSON.parse(raw);
      }
      if (ref && !baseline)
        actions.push({
          ...entry,
          action: asset ? "conflict" : "missing",
          reason:
            "Ledger refers to an absent asset or missing baseline; manual recovery required.",
        });
      else {
        let action = decide(
          entry,
          baseline,
          asset ? await snapshot(asset) : null,
        );
        if (asset && action.action === "update") {
          try {
            const next = JSON.parse(entry.definition);
            const old = baseline ? JSON.parse(baseline.definition) : null;
            if (entry.kind === "recipe") this.checkMigration(asset, next);
            if (entry.kind === "example") {
              const problems = migrationProblems("example", old, next);
              if (problems.length)
                throw Error(problems.map((p) => p.message).join(" "));
            }
            if (
              entry.kind === "icon" &&
              (old?.svg !== next.svg ||
                canonical(old?.sizes ?? []) !== canonical(next.sizes ?? []))
            )
              throw Error(
                "SVG changes require an explicit migration to preserve vector identities.",
              );
            if (
              entry.kind === "token" &&
              old &&
              (old.type !== next.type || old.collection !== next.collection)
            )
              throw Error(
                "Variable type or collection change requires an explicit migration.",
              );
            if (entry.kind === "style" && old && old.type !== next.type)
              throw Error("Style type change requires an explicit migration.");
          } catch (error) {
            action = { ...action, action: "conflict", reason: String(error) };
          }
        }
        actions.push(action);
      }
    }
    for (const [name, id] of Object.entries(this.index.collections)) {
      const collection =
        await this.api.variables.getVariableCollectionByIdAsync(id);
      const names = name === "Semantic" ? ["Light", "Dark"] : ["Value"];
      if (
        !collection ||
        (canonical(collection.modes.map((m) => m.name).sort()) !==
          canonical(names.sort()) &&
          !this.index.pendingCollections?.includes(name))
      )
        actions.push({
          id: "collection:" + name,
          kind: "token",
          definition: "",
          action: collection ? "conflict" : "missing",
          reason:
            "Managed collection modes changed or collection removed. Restore mode identities before updating.",
        });
    }
    const active = new Set(actions.map((a) => a.id));
    for (const [id, ref] of Object.entries(this.index.assets))
      if (!active.has(id))
        actions.push({
          id,
          kind: ref.kind,
          definition: "",
          action: "retained",
          reason:
            "Removed upstream; retained for published instances. Review an explicit migration.",
        });
    const counts: Record<string, number> = {};
    for (const action of actions)
      counts[action.action] = (counts[action.action] || 0) + 1;
    return {
      release: this.bundle.release,
      fingerprint: this.bundle.fingerprint,
      actions,
      warnings: [...this.warnings],
      errors: [],
      counts,
      complete: !actions.some((a) =>
        ["conflict", "missing", "retained", "create", "update"].includes(
          a.action,
        ),
      ),
    };
  }
  async page(key: string): Promise<PageNode> {
    let page = this.index.pages[key]
      ? await this.api.getNodeByIdAsync(this.index.pages[key])
      : null;
    if (page && page.type !== "PAGE")
      throw Error("Managed page identity changed");
    if (!page) {
      page = this.api.createPage();
      page.name = "Fondue / " + key;
      this.index.pages[key] = page.id;
      this.save();
    }
    if ("loadAsync" in page) await (page as PageNode).loadAsync();
    return page as PageNode;
  }
  async collection(name: string): Promise<VariableCollection> {
    const id = this.index.collections[name];
    let collection = id
      ? await this.api.variables.getVariableCollectionByIdAsync(id)
      : null;
    if (id && !collection)
      throw Error(
        "Managed collection missing: " +
          name +
          ". Restore collection before continuing.",
      );
    if (!collection) {
      collection = this.api.variables.createVariableCollection(
        "Fondue / " + name,
      );
      this.index.collections[name] = collection.id;
      this.index.pendingCollections = [
        ...(this.index.pendingCollections ?? []),
        name,
      ];
      this.save();
    }
    const names = name === "Semantic" ? ["Light", "Dark"] : ["Value"];
    if (
      collection.modes.length === 1 &&
      (collection.modes[0].name === "Mode 1" ||
        this.index.pendingCollections?.includes(name))
    )
      collection.renameMode(collection.defaultModeId, names[0]);
    for (const label of names)
      if (!collection.modes.some((m) => m.name === label))
        collection.addMode(label);
    this.index.pendingCollections = (
      this.index.pendingCollections ?? []
    ).filter((n) => n !== name);
    this.save();
    return collection;
  }
  async token(id: string) {
    const cached = this.tokenCache.get(id);
    if (cached) return cached;
    const ref = this.index.assets["token:" + id];
    if (!ref) throw Error("Missing token binding " + id);
    const variable = await this.api.variables.getVariableByIdAsync(ref.id);
    if (!variable) throw Error("Missing variable " + id);
    this.tokenCache.set(id, variable);
    return variable;
  }
  async createTokenShell(token: Token) {
    const collection = await this.collection(token.collection);
    const variable = this.api.variables.createVariable(
      token.name,
      collection,
      token.type,
    );
    this.index.assets["token:" + token.id] = { id: variable.id, kind: "token" };
    this.save();
    // A pending record prevents a failed initial import from being mistaken for an untracked local edit.
    await this.checkpoint(
      {
        id: "token:" + token.id,
        kind: "token",
        definition: canonical({ ...token, pending: true }),
      },
      variable,
    );
    write(variable, "pending", "true");
    return variable;
  }
  async applyToken(token: Token, variable: Variable) {
    if (variable.resolvedType !== token.type)
      throw Error("Variable type migration required for " + token.id);
    const collection = await this.collection(token.collection);
    for (const [mode, value] of Object.entries(token.values)) {
      const modeId = collection.modes.find((m) => m.name === mode)?.modeId;
      if (!modeId) throw Error("Missing mode " + mode);
      variable.setValueForMode(
        modeId,
        value && typeof value === "object" && "alias" in value
          ? this.api.variables.createVariableAlias(
              await this.token(value.alias),
            )
          : value,
      );
    }
    variable.description = `Fondue ${this.bundle.release}. ${token.css}. ${token.collection}; modes: ${Object.keys(token.values).join(", ")}. Numeric CSS rem values use the release root size 16px.`;
    variable.name = token.name;
    variable.setVariableCodeSyntax("WEB", token.css);
    variable.scopes = (token.scopes ??
      (token.collection === "Primitives"
        ? []
        : token.type === "COLOR"
          ? ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"]
          : token.type === "FLOAT"
            ? ["GAP", "WIDTH_HEIGHT", "CORNER_RADIUS"]
            : ["FONT_FAMILY"])) as VariableScope[];
  }
  async fontFor(family: string, style: string): Promise<FontName> {
    const key = family + ":" + style;
    let pending = this.fonts.get(key);
    if (!pending) {
      pending = this.loadFont(family, style);
      this.fonts.set(key, pending);
    }
    return pending;
  }
  async loadFont(family: string, style: string): Promise<FontName> {
    const normalized = style.replace("SemiBold", "Semi Bold");
    const requested = { family, style: normalized };
    try {
      await this.api.loadFontAsync(requested);
      return requested;
    } catch {
      const fallback = { family: "Inter", style: normalized };
      try {
        await this.api.loadFontAsync(fallback);
      } catch {
        fallback.style = "Regular";
        await this.api.loadFontAsync(fallback);
      }
      const warning = `Font ${family} ${style} unavailable; using ${fallback.family} ${fallback.style}.`;
      if (!this.warnings.includes(warning)) this.warnings.push(warning);
      return fallback;
    }
  }
  async applyStyle(def: any, style: any) {
    style.name = def.name;
    style.description = `Fondue ${this.bundle.release}. Released ${def.type === "TEXT" ? "typography" : "composite shadow"} style ${def.id}. Source: committed token CSS. Font fallbacks require visual review.`;
    if (def.type === "TEXT") {
      style.fontName = await this.fontFor(
        def.fontFamily,
        def.fontStyle || "Regular",
      );
      style.fontSize = def.fontSize;
      style.lineHeight =
        typeof def.lineHeight === "number"
          ? { unit: "PIXELS", value: def.lineHeight }
          : def.lineHeight;
      style.letterSpacing =
        typeof def.letterSpacing === "number"
          ? { unit: "PIXELS", value: def.letterSpacing }
          : def.letterSpacing;
      if (def.textCase) style.textCase = def.textCase;
      for (const [key, id] of Object.entries(def.bindings ?? {}))
        if (key !== "fontFamily" && key !== "fontStyle")
          style.setBoundVariable(key, await this.token(id as string));
    } else {
      style.effects = def.colorToken
        ? await Promise.all(
            def.effects.map(async (effect: any) =>
              this.api.variables.setBoundVariableForEffect(
                effect,
                "color",
                await this.token(def.colorToken),
              ),
            ),
          )
        : def.effects;
    }
  }
  paint(hex: string): SolidPaint {
    const clean = hex.replace("#", "");
    if (!/^[\da-f]{6}$/i.test(clean))
      throw Error("Unsupported recipe paint " + hex);
    return {
      type: "SOLID",
      color: {
        r: parseInt(clean.slice(0, 2), 16) / 255,
        g: parseInt(clean.slice(2, 4), 16) / 255,
        b: parseInt(clean.slice(4, 6), 16) / 255,
      },
    };
  }
  async layer(
    def: Layer,
    parent: any,
    existing?: any,
    owner?: any,
    path = "",
  ): Promise<any> {
    let node = existing;
    const identityPath = path + "/" + def.id;
    if (def.kind === "componentInstance") {
      const candidates = this.bundle.recipes.filter((r) =>
        def.recipeId
          ? r.id === def.recipeId
          : r.name.split("/")[0] === def.componentName,
      );
      const choices = candidates
        .flatMap((r) => r.variants.map((v) => ({ recipe: r, variant: v })))
        .filter(({ variant: v }) =>
          Object.entries(def.variantProps ?? {}).every(
            ([k, value]) => v.props[k] === value,
          ),
        );
      if (!choices.length)
        throw Error(
          "No native component/variant matches " +
            (def.recipeId ?? def.componentName) +
            " " +
            JSON.stringify(def.variantProps),
        );
      const choice = choices[0];
      const ref = this.index.assets["recipe:" + choice.recipe.id];
      const set = ref ? await this.api.getNodeByIdAsync(ref.id) : null;
      if (!set || set.type !== "COMPONENT_SET")
        throw Error(
          "Native component dependency not yet synchronized: " +
            choice.recipe.id,
        );
      const main = set.children.find(
        (c) => read(c, "variant") === choice.variant.id,
      );
      if (!main || main.type !== "COMPONENT")
        throw Error("Variant identity missing: " + choice.variant.id);
      if (!node) {
        node = main.createInstance();
        parent.appendChild(node);
      } else if ((await node.getMainComponentAsync()).id !== main.id)
        node.swapComponent(main);
      if (owner) node.isExposedInstance = true;
      const definitions = node.componentProperties;
      const textKeys = Object.keys(definitions).filter(
        (k) => definitions[k].type === "TEXT",
      );
      if (def.text !== undefined) {
        if (!textKeys.length)
          throw Error("No exposed text property on " + choice.recipe.name);
        node.setProperties({ [textKeys[0]]: def.text });
      }
      for (const [key, value] of Object.entries(def.textOverrides ?? {})) {
        const property = textKeys.find(
          (k) => k.split("#")[0].endsWith("/" + key) || k === key,
        );
        if (!property)
          throw Error(
            "No stable text property " + key + " on " + choice.recipe.name,
          );
        node.setProperties({ [property]: value });
      }
      write(
        node,
        "component-binding",
        JSON.stringify({
          recipeId: choice.recipe.id,
          variantId: choice.variant.id,
          properties: def.variantProps ?? {},
        }),
      );
    }
    if (def.kind === "instance") {
      const ref = this.index.assets["icon:" + def.iconId];
      const icon = ref ? await this.api.getNodeByIdAsync(ref.id) : null;
      let main: any = icon;
      if (icon?.type === "COMPONENT_SET") {
        main = icon.children.find(
          (c) => read(c, "optical-size") === String(def.width ?? 24),
        );
        if (!main) {
          main = icon.children.find((c) => read(c, "optical-size") === "24");
          const warning = `${def.iconId} has no exact ${def.width}px optical source; using the released24px path scaled to requested size.`;
          if (!this.warnings.includes(warning)) this.warnings.push(warning);
        }
      }
      if (!main || main.type !== "COMPONENT")
        throw Error("Missing native icon " + def.iconId);
      if (!node) {
        node = main.createInstance();
        parent.appendChild(node);
      } else if ((await node.getMainComponentAsync()).id !== main.id)
        node.swapComponent(main);
    }
    if (!node) {
      node =
        def.kind === "text"
          ? this.api.createText()
          : def.kind === "ellipse"
            ? this.api.createEllipse()
            : def.kind === "rectangle"
              ? this.api.createRectangle()
              : def.kind === "svg"
                ? this.api.createNodeFromSvg(def.svg!)
                : this.api.createFrame();
      parent.appendChild(node);
    }
    const previousLayer = read(node, "layer-definition");
    const previous = previousLayer ? JSON.parse(previousLayer) : null;
    if (def.kind === "instance" && previous?.iconColor && !def.iconColor)
      node.resetOverrides();
    write(node, "identity", def.id);
    node.name = def.name;
    write(
      node,
      "data-binding",
      def.dataBinding ? JSON.stringify(def.dataBinding) : "",
    );
    for (const field of Object.keys(previous?.bindings ?? {}))
      if (
        !(field in (def.bindings ?? {})) &&
        field !== "fills" &&
        field !== "strokes"
      )
        node.setBoundVariable(field, null);
    if (previous?.textStyle && !def.textStyle && node.type === "TEXT") {
      await this.fontFor(node.fontName.family, node.fontName.style);
      await node.setTextStyleIdAsync("");
    }
    if (previous?.effectStyle && !def.effectStyle)
      await node.setEffectStyleIdAsync("");
    if (def.rotation !== undefined || previous?.rotation !== undefined)
      node.rotation = def.rotation ?? 0;
    if (def.visible !== undefined || previous?.visible !== undefined)
      node.visible = def.visible ?? true;
    if (def.opacity !== undefined || previous?.opacity !== undefined)
      node.opacity = def.opacity ?? 1;
    if (def.layoutPositioning || previous?.layoutPositioning)
      node.layoutPositioning = def.layoutPositioning ?? "AUTO";
    if (def.x !== undefined) node.x = def.x;
    if (def.y !== undefined) node.y = def.y;
    if (
      def.strokeWidth !== undefined ||
      def.strokeWeight !== undefined ||
      previous?.strokeWidth !== undefined ||
      previous?.strokeWeight !== undefined
    )
      node.strokeWeight = def.strokeWidth ?? def.strokeWeight ?? 1;
    if (def.arcData || previous?.arcData)
      node.arcData = def.arcData ?? {
        startingAngle: 0,
        endingAngle: Math.PI * 2,
        innerRadius: 0,
      };
    if (def.effects) node.effects = def.effects;
    else if ((previous?.effects || previous?.focusRing) && !def.focusRing)
      node.effects = [];
    if (def.focusRing) {
      const ring = def.focusRing;
      node.effects = await Promise.all(
        [
          [ring.inner, ring.innerSpread ?? 2],
          [ring.outer, ring.outerSpread ?? 6],
        ].map(async ([id, spread]) =>
          this.api.variables.setBoundVariableForEffect(
            {
              type: "DROP_SHADOW",
              color: { r: 0, g: 0, b: 0, a: 1 },
              offset: { x: 0, y: 0 },
              radius: 0,
              spread: Number(spread),
              visible: true,
              blendMode: "NORMAL",
            },
            "color",
            await this.token(String(id)),
          ),
        ),
      );
    }
    if (def.kind === "text") {
      // All text layers are exposed, with stable property keys that survive updates.
      node.fontName = await this.fontFor(
        def.fontFamily ?? "Diatype",
        (
          {
            300: "Light",
            400: "Regular",
            500: "Medium",
            600: "Semi Bold",
            700: "Bold",
          } as Record<number, string>
        )[def.fontWeight ?? 400] ?? "Regular",
      );
      node.fontSize = def.fontSize ?? 14;
      node.characters = def.text ?? "";
      node.textAutoResize = "WIDTH_AND_HEIGHT";
      if (def.lineHeight !== undefined)
        node.lineHeight = { unit: "PIXELS", value: def.lineHeight };
      if (def.textDecoration || previous?.textDecoration)
        node.textDecoration = def.textDecoration ?? "NONE";
      if (def.textStyle) {
        const ref = this.index.assets["style:" + def.textStyle];
        if (!ref) throw Error("Missing text style " + def.textStyle);
        await node.setTextStyleIdAsync(ref.id);
      }
      if (def.fontSize !== undefined) node.fontSize = def.fontSize;
      if (def.lineHeight !== undefined)
        node.lineHeight = { unit: "PIXELS", value: def.lineHeight };
      if (def.fontWeight !== undefined || def.fontFamily !== undefined)
        node.fontName = await this.fontFor(
          def.fontFamily ?? node.fontName.family,
          (
            {
              300: "Light",
              400: "Regular",
              500: "Medium",
              600: "Semi Bold",
              700: "Bold",
            } as Record<number, string>
          )[def.fontWeight ?? 400] ?? "Regular",
        );
      if (owner) {
        const label = "Text / " + identityPath;
        const definitions = owner.componentPropertyDefinitions;
        let key = Object.keys(definitions).find(
          (k) => k.split("#")[0] === label,
        );
        if (!key)
          key = owner.addComponentProperty(label, "TEXT", node.characters);
        if (!key) throw Error("Could not create native text property " + label);
        const propertyIdentity = owner.id + ":" + key;
        if (!this.appliedPropertyDefaults.has(propertyIdentity)) {
          if (
            owner.componentPropertyDefinitions[key]?.defaultValue !==
            node.characters
          )
            owner.editComponentProperty(key, { defaultValue: node.characters });
          this.appliedPropertyDefaults.add(propertyIdentity);
        }
        node.componentPropertyReferences = {
          ...node.componentPropertyReferences,
          characters: key,
        };
      }
    }
    if (def.kind === "instance" && owner) {
      const definitions = owner.componentPropertyDefinitions;
      const ensure = (
        name: string,
        type: "INSTANCE_SWAP" | "BOOLEAN",
        value: string | boolean,
      ) =>
        Object.keys(definitions).find((k) => k.split("#")[0] === name) ??
        owner.addComponentProperty(name, type, value);
      node.componentPropertyReferences = {
        ...node.componentPropertyReferences,
        mainComponent: ensure(
          "Icon / " + identityPath,
          "INSTANCE_SWAP",
          (await node.getMainComponentAsync()).id,
        ),
        visible: ensure("Show / " + identityPath, "BOOLEAN", true),
      };
    }
    if (def.effectStyle) {
      const ref = this.index.assets["style:" + def.effectStyle];
      if (!ref) throw Error("Missing effect style " + def.effectStyle);
      await node.setEffectStyleIdAsync(ref.id);
    }
    if (def.kind === "frame") {
      node.layoutMode = def.layout ?? "VERTICAL";
      node.primaryAxisSizingMode = "AUTO";
      node.counterAxisSizingMode = "AUTO";
      node.itemSpacing = def.gap ?? 0;
      node.counterAxisAlignItems =
        def.counterAlign ?? def.counterAxisAlignItems ?? "CENTER";
      node.primaryAxisAlignItems =
        def.primaryAlign ?? def.primaryAxisAlignItems ?? "MIN";
      node.paddingTop =
        node.paddingBottom =
        node.paddingLeft =
        node.paddingRight =
          def.padding ?? 0;
      for (const key of [
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
      ] as const)
        if (def[key] !== undefined) node[key] = def[key];
      node.clipsContent = def.clipContent ?? false;
    }
    if (
      def.kind !== "svg" &&
      def.kind !== "instance" &&
      def.kind !== "componentInstance"
    ) {
      node.fills = def.fill ? [this.paint(def.fill)] : [];
      node.strokes = def.stroke ? [this.paint(def.stroke)] : [];
      if (def.radius !== undefined || previous?.radius !== undefined)
        node.cornerRadius = def.radius ?? 0;
    }
    if (def.width !== undefined && def.kind === "text")
      node.textAutoResize = "HEIGHT";
    if (def.width !== undefined || def.height !== undefined) {
      node.resize(def.width ?? node.width, def.height ?? node.height);
      if (def.kind === "frame") {
        if (def.layout === "HORIZONTAL") {
          if (def.width) node.primaryAxisSizingMode = "FIXED";
          if (def.height) node.counterAxisSizingMode = "FIXED";
        } else {
          if (def.height) node.primaryAxisSizingMode = "FIXED";
          if (def.width) node.counterAxisSizingMode = "FIXED";
        }
      }
    }

    if (def.iconColor && (def.kind === "instance" || def.kind === "svg")) {
      const color = await this.token(def.iconColor);
      const paint = (child: any) => {
        for (const key of ["fills", "strokes"])
          if (key in child && Array.isArray(child[key]))
            child[key] = child[key].map((p: Paint) =>
              p.type === "SOLID"
                ? this.api.variables.setBoundVariableForPaint(p, "color", color)
                : p,
            );
        if (child.children) child.children.forEach(paint);
      };
      paint(node);
    }
    for (const [field, id] of Object.entries(def.bindings ?? {})) {
      const variable = await this.token(id);
      if (field === "fills" || field === "strokes") {
        node[field] = [
          this.api.variables.setBoundVariableForPaint(
            { type: "SOLID", color: { r: 0, g: 0, b: 0 } },
            "color",
            variable,
          ),
        ];
      } else node.setBoundVariable(field, variable);
    }
    for (const child of def.children ?? []) {
      const prior = node.children?.find(
        (n: any) => read(n, "identity") === child.id,
      );
      await this.layer(child, node, prior, owner, identityPath);
    }
    write(node, "layer-definition", canonical(def));
    // Never guess deletion of formerly managed children. A structural removal is a migration.
    return node;
  }
  async applyRecipe(recipe: Recipe, set: any) {
    set.name = recipe.name;
    set.description =
      recipe.documentation?.description ??
      `Fondue ${this.bundle.release}. ${recipe.package}: ${recipe.name}. ${recipe.status}. ${recipe.limitations.join(" ")}\nSources: ${recipe.source.join(", ")}`;
    if (recipe.documentation?.links)
      set.documentationLinks = recipe.documentation.links;
    for (let i = 0; i < recipe.variants.length; i++) {
      const variant = recipe.variants[i];
      let component = set.children.find(
        (n: any) => read(n, "variant") === variant.id,
      );
      if (!component) {
        component = this.api.createComponent();
        set.appendChild(component);
        write(component, "variant", variant.id);
      }
      component.name =
        Object.entries(variant.props)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") || "State=Default";
      await this.layer(variant.root, set, component, set);
      component.name =
        Object.entries(variant.props)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ") || "State=Default";
      component.description = set.description;
      if (recipe.documentation?.links)
        component.documentationLinks = recipe.documentation.links;
      component.x = 0;
      component.y = 0;
    }
    const cellWidth = Math.max(...set.children.map((n: any) => n.width)) + 32;
    const cellHeight = Math.max(...set.children.map((n: any) => n.height)) + 40;
    set.children.forEach((n: any, i: number) => {
      n.x = (i % 4) * cellWidth;
      n.y = Math.floor(i / 4) * cellHeight;
    });
    set.resize(
      Math.max(...set.children.map((n: any) => n.x + n.width)) + 32,
      Math.max(...set.children.map((n: any) => n.y + n.height)) + 32,
    );
  }
  checkMigration(asset: any, next: Recipe) {
    const raw = read(asset, "applied");
    if (!raw) return;
    const previous = JSON.parse(JSON.parse(raw).definition);
    const problems = migrationProblems("recipe", previous, next);
    if (problems.length) throw Error(problems.map((p) => p.message).join(" "));
  }
  async checkpoint(entry: Entry, asset: any) {
    // Persist the allocated identity before awaiting its snapshot or writing a multi-entry baseline.
    this.index.assets[entry.id] = { id: asset.id, kind: entry.kind };
    this.save();
    write(
      asset,
      "applied",
      JSON.stringify({
        nodeId: asset.id,
        definition: entry.definition,
        snapshot: await snapshot(asset),
      }),
    );
    write(asset, "pending", "");
    write(
      asset,
      "mapping",
      JSON.stringify({
        id: entry.id,
        release: this.bundle.release,
        source: JSON.parse(entry.definition).source ?? null,
        importPath:
          entry.kind === "recipe" &&
          ["components", "charts", "rte"].includes(
            (JSON.parse(entry.definition).package ?? "").replace(
              "@frontify/fondue/",
              "",
            ),
          )
            ? "@frontify/fondue/" +
              JSON.parse(entry.definition).package.replace(
                "@frontify/fondue/",
                "",
              )
            : null,
        patternId: JSON.parse(entry.definition).package?.includes("fondue-sync")
          ? JSON.parse(entry.definition).id
          : null,
        codeConnectStatus: "not-registered",
      }),
    );
    this.index.assets[entry.id] = { id: asset.id, kind: entry.kind };
    this.save();
  }
  async arrangePages() {
    for (const key of [
      "Icons",
      "Components",
      "Charts",
      "Rich text",
      "Documentation",
      "Product patterns",
      "Examples",
    ]) {
      const id = this.index.pages[key];
      if (!id) continue;
      const page = await this.api.getNodeByIdAsync(id);
      if (!page || page.type !== "PAGE") continue;
      if ("loadAsync" in page) await page.loadAsync();
      const managed = new Set(
        Object.values(this.index.assets)
          .filter(
            (v) =>
              v.kind === "icon" ||
              v.kind === "recipe" ||
              v.kind === "guide" ||
              v.kind === "example",
          )
          .map((v) => v.id),
      );
      const nodes = page.children.filter((n) => managed.has(n.id));
      let y = 0;
      const columns = key === "Icons" ? 6 : 2;
      for (let offset = 0; offset < nodes.length; offset += columns) {
        const row = nodes.slice(offset, offset + columns);
        let x = 0;
        for (const node of row) {
          if (node.x !== x) node.x = x;
          if (node.y !== y) node.y = y;
          x += node.width + 120;
        }
        y += Math.max(...row.map((n) => n.height)) + 160;
      }
    }
  }
  async sync(progress?: (message: string) => void): Promise<Report> {
    this.appliedPropertyDefaults.clear();
    const plan = await this.inspect();
    const errors: string[] = [];
    const invalid = bundleProblems(this.bundle);
    if (invalid.length) {
      plan.errors = invalid.map((p) => p.message);
      plan.complete = false;
      return plan;
    }
    if (
      plan.actions.some(
        (a) => a.action === "conflict" || a.action === "missing",
      )
    ) {
      plan.errors.push(
        "Update stopped: resolve local drift or missing managed assets before applying this release.",
      );
      return plan;
    }
    this.save(); // Initialize/migrate the empty ledger before allocating any canvas assets.
    const retryFonts = Boolean(this.index.fontWarnings?.length);
    this.warnings = (this.index.warnings ?? []).filter(
      (w) => !w.startsWith("Font "),
    );
    this.fonts.clear();
    if (retryFonts)
      for (const action of plan.actions)
        if (
          action.action === "unchanged" &&
          ["style", "recipe", "guide", "example"].includes(action.kind)
        ) {
          action.action = "update";
          action.reason = "Retrying source fonts after a previous fallback.";
        }
    const runnable = plan.actions.filter((a) =>
      ["create", "update"].includes(a.action),
    );
    try {
      for (const name of new Set(this.bundle.tokens.map((t) => t.collection)))
        await this.collection(name);
    } catch (error) {
      plan.errors.push(
        "Foundation setup stopped before variable creation. The file must support the required Light/Dark modes: " +
          String(error),
      );
      plan.complete = false;
      return plan;
    }
    // Shell pass makes alias resolution order-independent. Checkpoint each shell before its values are applied.
    for (const action of runnable.filter(
      (a) => a.kind === "token" && a.action === "create",
    )) {
      try {
        await this.createTokenShell(JSON.parse(action.definition));
      } catch (error) {
        errors.push(`${action.id}: ${String(error)}`);
      }
    }
    for (const action of runnable) {
      progress?.(`${action.action}: ${action.id}`);
      let asset: any = null;
      let previousSnapshot: string | null = null;
      let previousDefinition: string | null = null;
      try {
        const def = JSON.parse(action.definition);
        const ref = this.index.assets[action.id];
        asset = ref ? await this.resolve(ref.id, ref.kind) : null;
        if (asset) {
          previousSnapshot = await snapshot(asset);
          const previous = read(asset, "applied");
          if (previous) previousDefinition = JSON.parse(previous).definition;
        }
        if (asset && action.kind === "recipe") this.checkMigration(asset, def);
        if (action.kind === "token") {
          if (!asset) throw Error("Variable shell unavailable");
          await this.applyToken(def, asset);
        }
        if (action.kind === "style") {
          if (!asset) {
            asset =
              def.type === "TEXT"
                ? this.api.createTextStyle()
                : this.api.createEffectStyle();
            await this.checkpoint(
              { ...action, definition: canonical({ ...def, pending: true }) },
              asset,
            );
          }
          await this.applyStyle(def, asset);
        }
        if (action.kind === "icon") {
          const page = await this.page("Icons");
          if (!asset) {
            const seed = this.api.createComponent();
            page.appendChild(seed);
            if (def.sizes?.length) {
              seed.name = "Size=" + def.sizes[0].size;
              write(seed, "optical-size", String(def.sizes[0].size));
              asset = this.api.combineAsVariants([seed], page);
            } else asset = seed;
            await this.checkpoint(
              { ...action, definition: canonical({ ...def, pending: true }) },
              asset,
            );
          }
          asset.name = "Icon / " + def.name;
          asset.fills = [];
          const variants = def.sizes?.length
            ? def.sizes
            : [{ size: 24, svg: def.svg, source: def.source }];
          for (const optical of variants) {
            let component = asset;
            if (asset.type === "COMPONENT_SET") {
              component = asset.children.find(
                (c: any) => read(c, "optical-size") === String(optical.size),
              );
              if (!component) {
                component = this.api.createComponent();
                asset.appendChild(component);
                write(component, "optical-size", String(optical.size));
              }
              component.name = "Size=" + optical.size;
            }
            component.fills = [];
            if (!component.children.length) {
              const vector = this.api.createNodeFromSvg(optical.svg);
              component.appendChild(vector);
              vector.x = 0;
              vector.y = 0;
            }
            component.resize(optical.size, optical.size);
            component.description = `Fondue ${this.bundle.release}. ${def.name}; exact ${optical.size}px optical SVG from ${optical.source}.`;
            component.documentationLinks = [
              {
                uri: `https://github.com/Frontify/fondue/blob/${this.bundle.provenance.commit}/${optical.source}`,
              },
            ];
          }
          if (asset.type === "COMPONENT_SET") {
            let x = 16;
            asset.children.forEach((c: any) => {
              c.x = x;
              c.y = 16;
              x += c.width + 16;
            });
            asset.resize(x, 64);
          }
          asset.description = `Fondue ${this.bundle.release}. Native optical sizes: ${variants.map((v: any) => v.size).join(", ")}. Source: ${def.source}.`;
        }
        if (action.kind === "recipe") {
          const page = await this.page(
            def.package.includes("fondue-sync")
              ? "Product patterns"
              : def.package === "charts" ||
                  def.package === "@frontify/fondue/charts"
                ? "Charts"
                : def.package === "rte" ||
                    def.package === "@frontify/fondue/rte"
                  ? "Rich text"
                  : "Components",
          );
          if (!asset) {
            const seed = this.api.createComponent();
            page.appendChild(seed);
            seed.name = "State=Default";
            asset = this.api.combineAsVariants([seed], page);
            write(seed, "variant", def.variants[0].id);
            await this.checkpoint(
              {
                ...action,
                definition: canonical({ ...def, pending: true, variants: [] }),
              },
              asset,
            );
            const ordinal = Object.values(this.index.assets).filter(
              (v) => v.kind === "recipe",
            ).length;
            asset.x = (ordinal % 3) * 1600;
            asset.y = Math.floor(ordinal / 3) * 2400;
          }
          await this.applyRecipe(def, asset);
        }
        if (action.kind === "example") {
          const page = await this.page("Examples");
          if (!asset) {
            asset = this.api.createFrame();
            page.appendChild(asset);
            await this.checkpoint(
              { ...action, definition: canonical({ ...def, pending: true }) },
              asset,
            );
          }
          asset = await this.layer(def.root, page, asset);
          asset.name = def.name;
          write(
            asset,
            "example-binding",
            JSON.stringify({
              id: def.id,
              bindings: def.bindings ?? {},
              schemaVersion: 1,
            }),
          );
        }
        if (action.kind === "guide") {
          const page = await this.page("Documentation");
          const docs = def.documentation;
          const paragraphs = [
            ["Title", def.name, 24],
            ["Purpose", docs?.purpose ?? "", 16],
            ["Usage", docs?.usage ?? "", 14],
            ["Properties", docs?.properties ?? "", 13],
            ["Coverage", def.limitations.join("\n"), 12],
            ["Source", docs?.links.map((l: any) => l.uri).join("\n") ?? "", 12],
          ];
          if (!asset) {
            asset = this.api.createFrame();
            page.appendChild(asset);
            await this.checkpoint(
              { ...action, definition: canonical({ ...def, pending: true }) },
              asset,
            );
          }
          const guide: Layer = {
            id: "guide",
            kind: "frame",
            name: def.name + " / usage",
            layout: "VERTICAL",
            width: 700,
            padding: 24,
            gap: 16,
            counterAlign: "MIN",
            fill: "#ffffff",
            children: paragraphs.map(([name, text, size]) => ({
              id: String(name),
              name: String(name),
              kind: "text",
              width: 650,
              fontSize: Number(size),
              text: String(text),
              fill: "#202020",
            })),
          };
          asset = await this.layer(guide, page, asset);
          const ordinal = Object.values(this.index.assets).filter(
            (v) => v.kind === "guide",
          ).length;
          if (action.action === "create") {
            asset.x = (ordinal % 3) * 800;
            asset.y = Math.floor(ordinal / 3) * 1600;
          }
        }
        if (!asset) throw Error("Asset creation failed");
        await this.checkpoint(action, asset);
      } catch (error) {
        if (
          asset &&
          (previousSnapshot === null ||
            (await snapshot(asset)) !== previousSnapshot)
        )
          await this.checkpoint(
            {
              ...action,
              definition:
                previousDefinition ??
                canonical({ ...JSON.parse(action.definition), pending: true }),
            },
            asset,
          );
        errors.push(`${action.id}: ${String(error)}`);
      }
    }
    await this.arrangePages();
    this.index.fontWarnings = this.warnings.filter((w) =>
      w.startsWith("Font "),
    );
    this.index.warnings = [...this.warnings];
    this.save();
    const result = await this.inspect();
    result.errors = errors;
    result.warnings = [...this.warnings];
    result.complete = result.complete && errors.length === 0;
    if (result.complete) {
      this.index.release = this.bundle.release;
      this.index.fingerprint = this.bundle.fingerprint;
      this.save();
    }
    return result;
  }
}
