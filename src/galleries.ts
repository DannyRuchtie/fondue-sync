import type { Bundle, Recipe } from "./schema";
import { Presentation, type PresentationIndex } from "./presentation";
import {
  familyDocumentation,
  profileCaption,
  friendlyProperty,
} from "./documentation";
import { read, write } from "./metadata";
export type GalleryIndex = PresentationIndex & {
  sections?: Record<string, string>;
  sectionGuides?: Record<string, string>;
  galleryMoveAudits?: {
    release: string;
    moves: {
      assetKey: string;
      nodeId: string;
      fromParentId: string | null;
      toPageId: string;
    }[];
  }[];
};
export type GalleryPreview = {
  key: string;
  sourceAssetId: string;
  mainId: string;
  caption: string;
  icon?: boolean;
};
export type GalleryGroup = {
  key: string;
  family: string;
  category?: string;
  consumerPage: string;
  masterPage: string;
  sectionId: string | null;
  previews: GalleryPreview[];
  recipeIds: string[];
  assets: {
    assetKey: string;
    nodeId: string;
    parentId: string | null;
    pageId: string | null;
  }[];
};
export type GalleryPlan = {
  conflicts: { key: string; nodeId?: string; reason: string }[];
  groups: GalleryGroup[];
  moves: {
    assetKey: string;
    nodeId: string;
    fromParentId: string | null;
    toPageKey: string;
  }[];
  warnings: string[];
};
function route(recipe: Recipe) {
  if (recipe.package.endsWith("/charts"))
    return { domain: "charts", page: "Charts" };
  if (recipe.package.endsWith("/rte"))
    return { domain: "rte", page: "Rich text" };
  if (recipe.package.includes("patterns"))
    return { domain: "patterns", page: "Product patterns" };
  return { domain: "components", page: "Components" };
}
function pageOf(node: BaseNode | null): string | null {
  let parent = node;
  while (parent && parent.type !== "PAGE") parent = parent.parent;
  return parent?.id ?? null;
}
/** Read-only exact-ID audit. No pages, instances, masters, guides or metadata are changed. */
export async function planCuratedGalleries(
  api: PluginAPI,
  bundle: Bundle,
  index: GalleryIndex,
  options: { groupKeys?: string[] } = {},
): Promise<GalleryPlan> {
  const wanted = options.groupKeys ? new Set(options.groupKeys) : null;
  const groups = new Map<string, GalleryGroup>(),
    warnings: string[] = [],
    conflicts: GalleryPlan["conflicts"] = [];
  for (const recipe of bundle.recipes) {
    const target = route(recipe),
      family = recipe.name.split("/")[0],
      key = target.domain + "/" + family;
    if (wanted && !wanted.has(key)) continue;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        family,
        category: recipe.libraryCategory,
        consumerPage: target.page,
        masterPage: "Library masters - " + target.page,
        sectionId: index.sections?.[key] ?? null,
        previews: [],
        recipeIds: [],
        assets: [],
      };
      groups.set(key, group);
    }
    group.recipeIds.push(recipe.id);
    const ref = index.assets["recipe:" + recipe.id];
    const master = ref ? await api.getNodeByIdAsync(ref.id) : null;
    if (
      !master ||
      (master.type !== "COMPONENT_SET" && master.type !== "COMPONENT")
    ) {
      warnings.push("Missing native master for " + recipe.id);
      continue;
    }
    group.assets.push({
      assetKey: "recipe:" + recipe.id,
      nodeId: master.id,
      parentId: master.parent?.id ?? null,
      pageId: pageOf(master),
    });
    const first = recipe.variants[0];
    const main =
      master.type === "COMPONENT"
        ? master
        : master.children.find(
            (n) => n.type === "COMPONENT" && read(n, "variant") === first?.id,
          );
    if (!main || main.type !== "COMPONENT") {
      warnings.push("Missing exact first source variant for " + recipe.id);
      continue;
    }
    group.previews.push({
      key: "profile:" + recipe.id,
      sourceAssetId: master.id,
      mainId: main.id,
      caption: profileCaption(recipe),
    });
    const guideRef = index.assets["guide:" + recipe.id];
    if (guideRef) {
      const guide = await api.getNodeByIdAsync(guideRef.id);
      if (guide && guide.type !== "PAGE" && guide.type !== "DOCUMENT")
        group.assets.push({
          assetKey: "guide:" + recipe.id,
          nodeId: guide.id,
          parentId: guide.parent?.id ?? null,
          pageId: pageOf(guide),
        });
      else warnings.push("Missing detailed guide " + recipe.id);
    }
  }
  if (bundle.icons.length && (!wanted || wanted.has("icons"))) {
    const group: GalleryGroup = {
      key: "icons",
      family: "Icons",
      consumerPage: "Icons",
      masterPage: "Library masters - Icons",
      sectionId: index.sections?.icons ?? null,
      previews: [],
      recipeIds: [],
      assets: [],
    };
    groups.set("icons", group);
    for (const icon of bundle.icons) {
      const ref = index.assets["icon:" + icon.id],
        master = ref ? await api.getNodeByIdAsync(ref.id) : null;
      if (
        !master ||
        (master.type !== "COMPONENT_SET" && master.type !== "COMPONENT")
      ) {
        warnings.push("Missing icon master " + icon.id);
        continue;
      }
      group.assets.push({
        assetKey: "icon:" + icon.id,
        nodeId: master.id,
        parentId: master.parent?.id ?? null,
        pageId: pageOf(master),
      });
      const main =
        master.type === "COMPONENT"
          ? master.width === 24 && master.height === 24
            ? master
            : null
          : master.children.find(
              (n) => n.type === "COMPONENT" && read(n, "optical-size") === "24",
            );
      if (!main || main.type !== "COMPONENT") {
        warnings.push("Missing exact 24px optical source for " + icon.id);
        continue;
      }
      group.previews.push({
        key: "icon:" + icon.id,
        sourceAssetId: master.id,
        mainId: main.id,
        caption: friendlyProperty(icon.name),
        icon: true,
      });
    }
  }
  const result = [...groups.values()].sort(
    (a, b) =>
      a.consumerPage.localeCompare(b.consumerPage, "en") ||
      (a.category ?? "").localeCompare(b.category ?? "", "en") ||
      a.family.localeCompare(b.family, "en"),
  );
  for (const group of result) {
    if (group.sectionId) {
      const section = await api.getNodeByIdAsync(group.sectionId);
      if (!section || section.type !== "SECTION")
        conflicts.push({
          key: group.key,
          nodeId: group.sectionId,
          reason: "Managed consumer section is missing or changed type.",
        });
    }
    const legacyCaption = index.sectionGuides?.[group.key];
    if (legacyCaption) {
      const caption = await api.getNodeByIdAsync(legacyCaption);
      if (caption && caption.type !== "PAGE" && caption.type !== "DOCUMENT")
        group.assets.push({
          assetKey: "sectionGuide:" + group.key,
          nodeId: caption.id,
          parentId: caption.parent?.id ?? null,
          pageId: pageOf(caption),
        });
    }
    for (const preview of group.previews) {
      const ref = index.presentationInstances?.[preview.key];
      if (!ref) continue;
      const instance = await api.getNodeByIdAsync(ref);
      if (!instance || instance.type !== "INSTANCE") {
        conflicts.push({
          key: preview.key,
          nodeId: ref,
          reason:
            "Managed preview missing or changed type; explicit recovery required.",
        });
        continue;
      }
      const baseline = read(instance, "presentation-source-main");
      if (baseline && baseline !== preview.mainId)
        conflicts.push({
          key: preview.key,
          nodeId: ref,
          reason:
            "First source variant identity changed; explicit preview migration required.",
        });
      const selected = await instance.getMainComponentAsync();
      if (
        !selected ||
        (selected.id !== preview.sourceAssetId &&
          selected.parent?.id !== preview.sourceAssetId)
      )
        conflicts.push({
          key: preview.key,
          nodeId: ref,
          reason:
            "Preview was swapped outside its source profile; local choice preserved.",
        });
    }
    for (const [key, id] of Object.entries(index.presentationNodes ?? {})) {
      if (!key.startsWith("gallery/" + group.key + "/")) continue;
      const node = await api.getNodeByIdAsync(id);
      if (!node || node.type === "PAGE" || node.type === "DOCUMENT") {
        conflicts.push({
          key,
          nodeId: id,
          reason: "Presentation node missing or changed type.",
        });
        continue;
      }
      const owner = read(node, "presentation-key");
      if (owner && owner !== key)
        conflicts.push({
          key,
          nodeId: id,
          reason: "Presentation ownership metadata differs.",
        });
      const expected = read(node, "presentation-type");
      if (expected && expected !== node.type)
        conflicts.push({
          key,
          nodeId: id,
          reason: "Presentation native type differs.",
        });
    }
    for (const name of [group.consumerPage, group.masterPage]) {
      const id = index.pages[name];
      if (id) {
        const page = await api.getNodeByIdAsync(id);
        if (!page || page.type !== "PAGE")
          conflicts.push({
            key: name,
            nodeId: id,
            reason: "Managed page missing or changed type.",
          });
      }
    }
  }
  const moves = result.flatMap((group) =>
    group.assets
      .filter((asset) => asset.pageId !== index.pages[group.masterPage])
      .map((asset) => ({
        assetKey: asset.assetKey,
        nodeId: asset.nodeId,
        fromParentId: asset.parentId,
        toPageKey: group.masterPage,
      })),
  );
  return { groups: result, moves, warnings, conflicts };
}
export type CuratedGalleryReport = {
  complete: boolean;
  plan: GalleryPlan;
  sections: {
    key: string;
    id: string;
    pageId: string;
    guideId: string;
    galleryId: string;
    previewIds: string[];
    width: number;
    height: number;
  }[];
  createdNodeIds: string[];
  mutatedNodeIds: string[];
  warnings: string[];
  auditedMoves: number;
};
export async function syncCuratedGalleries(
  api: PluginAPI,
  bundle: Bundle,
  index: GalleryIndex,
  save: () => void,
  options: {
    approvedMoveIds?: string[];
    planOnly?: boolean;
    groupKeys?: string[];
  } = {},
): Promise<CuratedGalleryReport> {
  const plan = await planCuratedGalleries(api, bundle, index, options);
  const result: CuratedGalleryReport = {
    complete: plan.conflicts.length === 0 && plan.warnings.length === 0,
    plan,
    sections: [],
    createdNodeIds: [],
    mutatedNodeIds: [],
    warnings: [...plan.warnings],
    auditedMoves: 0,
  };
  if (options.planOnly || plan.conflicts.length) return result;
  if (options.approvedMoveIds) {
    const approved = new Set(options.approvedMoveIds);
    const unapproved = plan.moves.filter((move) => !approved.has(move.nodeId));
    if (unapproved.length)
      throw Error(
        "Unapproved exact-ID master/guide move: " +
          unapproved.map((move) => move.nodeId).join(", "),
      );
  }
  const ctx = new Presentation(api, index, save);
  await ctx.preflight();
  const pages = new Map<string, PageNode>();
  for (const name of new Set(
    plan.groups.flatMap((g) => [g.consumerPage, g.masterPage]),
  ))
    pages.set(name, await ctx.page(name));
  const nativeMoves = plan.moves.map((move) => ({
    ...move,
    toPageId: pages.get(move.toPageKey)!.id,
  }));
  if (nativeMoves.length) {
    index.galleryMoveAudits ??= [];
    index.galleryMoveAudits.push({
      release: bundle.release,
      moves: nativeMoves.map(
        ({ assetKey, nodeId, fromParentId, toPageId }) => ({
          assetKey,
          nodeId,
          fromParentId,
          toPageId,
        }),
      ),
    });
    save();
  }
  // The full exact-ID audit is committed before the first main/guide is reparented.
  for (const move of nativeMoves) {
    const node = await api.getNodeByIdAsync(move.nodeId);
    if (!node || node.type === "PAGE" || node.type === "DOCUMENT")
      throw Error("Audited asset disappeared " + move.nodeId);
    pages.get(move.toPageKey)!.appendChild(node);
    ctx.mutated.add(node.id);
    result.auditedMoves++;
  }
  index.sections ??= {};
  const pad = ctx.number("spacing-x-large"),
    gap = ctx.number("spacing-large"),
    inner = ctx.number("spacing-medium");
  const known = new Set([
    ...Object.values(index.presentationNodes ?? {}),
    ...Object.values(index.presentationInstances ?? {}),
    ...Object.values(index.sections),
  ]);
  for (const group of plan.groups) {
    if (!group.previews.length) continue;
    const consumer = pages.get(group.consumerPage)!;
    let section = group.sectionId
      ? await api.getNodeByIdAsync(group.sectionId)
      : null;
    if (group.sectionId && (!section || section.type !== "SECTION"))
      throw Error("Consumer section identity changed " + group.key);
    if (!section) {
      section = api.createSection();
      consumer.appendChild(section as SectionNode);
      index.sections[group.key] = section.id;
      save();
      ctx.created.add(section.id);
      write(section, "section-group", group.key);
    } else if (section.parent?.id !== consumer.id)
      consumer.appendChild(section as SectionNode);
    const nativeSection = section as SectionNode;
    nativeSection.name = group.category
      ? `${group.category} / ${group.family}`
      : group.family;
    ctx.paint(nativeSection, "fills", "color-surface-default");
    ctx.mutated.add(nativeSection.id);
    known.add(nativeSection.id);
    const unknown = nativeSection.children.filter((n) => !known.has(n.id));
    const start = unknown.length
      ? Math.max(...unknown.map((n) => n.y + n.height)) + gap
      : pad;
    const document = await ctx.frame(
      "gallery/" + group.key + "/document",
      nativeSection,
    );
    ctx.auto(document, "VERTICAL", "spacing-x-large", "spacing-large");
    const title = await ctx.text(
      "gallery/" + group.key + "/title",
      document,
      group.family,
      "text-heading-xx-large-default",
      "color-primary-default",
      900,
    );
    const body = await ctx.frame("gallery/" + group.key + "/body", document);
    ctx.auto(
      body,
      "HORIZONTAL",
      "component-constant-spacing-0",
      "spacing-x-large",
    );
    const gallery = await ctx.frame("gallery/" + group.key + "/grid", body);
    const guide = await ctx.frame(
      "gallery/" + group.key + "/guide",
      body,
      "",
      "surface",
    );
    ctx.auto(
      guide,
      "VERTICAL",
      "component-constant-spacing-0",
      "spacing-medium",
    );
    const recipes = bundle.recipes.filter((r) =>
      group.recipeIds.includes(r.id),
    );
    const doc = recipes.length ? familyDocumentation(recipes) : null;
    const guideCopy = doc
      ? [
          doc.purpose,
          doc.usage,
          doc.controls.join("\n"),
          doc.notes.join("\n"),
          "Select a preview to adjust native variant properties. This is a representative source configuration, not a claim that it is the default. Complete definitions and profile notes remain on the Source components page.",
        ]
      : [
          "Use native icon instances rather than detached vectors.",
          "Each preview uses the exact 24px optical source. Other optical sizes remain available on the Source components page.",
          "Select an instance to change supported properties.",
        ];
    for (let i = 0; i < guideCopy.length; i++) {
      if (!guideCopy[i]) continue;
      await ctx.text(
        "gallery/" + group.key + "/guide/" + i,
        guide,
        guideCopy[i],
        i === 0 ? "text-body-medium-strong" : "text-body-small-default",
        i === 0 ? "color-primary-default" : "color-secondary-default",
        360,
      );
    }
    const previews: string[] = [],
      tiles: FrameNode[] = [];
    for (const preview of group.previews) {
      const key = "gallery/" + group.key + "/" + preview.key;
      const tile = await ctx.frame(key, gallery, "", "card");
      ctx.auto(tile, "VERTICAL", "spacing-large", "spacing-medium");
      const main = await api.getNodeByIdAsync(preview.mainId);
      if (!main || main.type !== "COMPONENT")
        throw Error("Audited source component disappeared " + preview.mainId);
      const instance = await ctx.instance(preview.key, tile, main);
      const selected = await instance.getMainComponentAsync();
      if (
        selected &&
        selected.parent?.id !== preview.sourceAssetId &&
        selected.id !== preview.sourceAssetId
      )
        result.warnings.push(
          "Preserved preview with a manually swapped source " + preview.key,
        );
      previews.push(instance.id);
      known.add(instance.id);
      await ctx.text(
        key + "/caption",
        tile,
        preview.caption,
        preview.icon ? "text-body-x-small-strong" : "text-body-medium-strong",
        "color-primary-default",
        preview.icon ? 112 : 192,
      );
      if (!preview.icon)
        await ctx.text(
          key + "/hint",
          tile,
          "Representative configuration",
          "text-body-x-small-default",
          "color-secondary-default",
          192,
        );
      // Never rescale an instance or its text. Natural source size determines the row.
      tiles.push(tile);
      known.add(tile.id);
    }
    const columns = group.key === "icons" ? 6 : 4,
      minWidth = group.key === "icons" ? 160 : 240;
    const galleryWidth = Math.max(
      columns * minWidth + (columns - 1) * gap,
      ...tiles.map((tile) => tile.width),
    );
    ctx.wrap(gallery, galleryWidth);
    ctx.position(document, 0, start);
    const sectionWidth = Math.max(
      document.width + pad,
      ...unknown.map((n) => n.x + n.width + pad),
    );
    const sectionHeight = Math.max(
      start + document.height + pad,
      ...unknown.map((n) => n.y + n.height + pad),
    );
    nativeSection.resizeWithoutConstraints(sectionWidth, sectionHeight);
    known.add(title.id);
    known.add(gallery.id);
    known.add(guide.id);
    known.add(document.id);
    known.add(body.id);
    result.sections.push({
      key: group.key,
      id: nativeSection.id,
      pageId: consumer.id,
      guideId: guide.id,
      galleryId: gallery.id,
      previewIds: previews,
      width: nativeSection.width,
      height: nativeSection.height,
    });
  }
  // Compact family sections on consumer pages; user-created content stays put.
  for (const [name, page] of pages) {
    if (name.startsWith("Library masters")) continue;
    const own = result.sections.filter((s) => s.pageId === page.id),
      outsiders = page.children.filter((n) => !known.has(n.id));
    let y = outsiders.length
      ? Math.max(...outsiders.map((n) => n.y + n.height)) + gap
      : 0;
    for (const item of own) {
      const section = (await api.getNodeByIdAsync(item.id)) as SectionNode;
      section.x = 0;
      section.y = y;
      y += section.height + ctx.number("spacing-xx-large");
    }
  }
  // Masters remain editable and paired with their full detail guides. Layout moves
  // root positions only, preserving applied source snapshots and every child ID.
  for (const [name, page] of pages) {
    if (!name.startsWith("Library masters")) continue;
    const assets = plan.groups
      .filter((g) => g.masterPage === name)
      .flatMap((g) => g.assets);
    const ids = new Set(assets.map((a) => a.nodeId));
    const outsiders = page.children.filter((n) => !ids.has(n.id));
    let y = outsiders.length
      ? Math.max(...outsiders.map((n) => n.y + n.height)) + gap
      : 0;
    for (const asset of assets) {
      const node = (await api.getNodeByIdAsync(asset.nodeId)) as SceneNode;
      if (node.parent?.id !== page.id) continue;
      ctx.position(node, 0, y);
      y += node.height + gap;
    }
  }
  save();
  result.createdNodeIds = [...ctx.created];
  result.mutatedNodeIds = [...ctx.mutated];
  result.warnings.push(...ctx.warnings);
  result.complete = result.complete && result.warnings.length === 0;
  return result;
}
