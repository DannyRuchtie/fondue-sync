/** Released public image parts. Image content comes only from the approved local manifest. */
import fs from "node:fs";
const media = JSON.parse(
  fs.readFileSync(
    new URL("../fixtures/media/manifest.json", import.meta.url),
    "utf8",
  ),
);
if (media.status !== "ready" || media.assets.length !== 6)
  throw Error("Reviewed six-image fixture manifest required");
const assets = media.assets;
const C = "packages/components/src/components/";
const S = {
  surface: "color-surface-default",
  dim: "color-surface-dim",
  line: "color-line-mid",
  strong: "color-line-strong",
  subtle: "color-line-subtle",
  text: "color-primary-default",
  secondary: "color-secondary-default",
};
const edges = (token) =>
  Object.fromEntries(
    ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"].map((p) => [
      p,
      token,
    ]),
  );
const frame = (id, children, width, height, extra = {}) => ({
  id,
  name: id,
  kind: "frame",
  layout: "HORIZONTAL",
  gap: 0,
  padding: 0,
  width,
  height,
  primaryAlign: "MIN",
  counterAlign: "CENTER",
  children,
  ...extra,
});
const image = (id, asset, width, height, scale) => ({
  id,
  name: asset.source.name,
  kind: "rectangle",
  width,
  height,
  imageAssetId: asset.id,
  imageScaleMode: scale,
});
const text = (id, value, size = "medium", strong = false, color = S.text) => ({
  id,
  name: id,
  kind: "text",
  text: value,
  textStyle: `text-body-${size}-${strong ? "strong" : "default"}`,
  bindings: { fills: color },
});
const axes = (values, render) => {
  let rows = [{}];
  for (const [key, choices] of Object.entries(values))
    rows = rows.flatMap((row) =>
      choices.map((value) => ({ ...row, [key]: String(value) })),
    );
  return rows.map((props, i) => ({
    id: Object.entries(props)
      .map(([k, v]) => `${k}=${v}`)
      .join(";"),
    props,
    root: render(props, i),
  }));
};
const staticLimits = [
  "Images are approved local example fixtures, not a screenshot of a component or page. Replace the image fill for application content.",
  "Native variants are static; source image loading, alternative-text accessibility, DOM sizing and browser events still require application/runtime verification.",
];
const recipe = (id, name, files, variants, limits) => ({
  id: `components/${id}`,
  name,
  package: "@frontify/fondue/components",
  source: files.map((f) => C + f),
  status: "partial",
  limitations: [...limits, ...staticLimits],
  variants,
});

const padding = {
  none: [0, "component-constant-spacing-0"],
  small: [12, "spacing-small"],
  medium: [24, "spacing-large"],
  large: [32, "spacing-x-large"],
};
export const bannerImage = recipe(
  "Card.BannerImage",
  "Card/BannerImage",
  ["Card/Card.ts", "Card/CardBanner.tsx", "Card/styles/card.module.scss"],
  axes(
    {
      size: ["small", "large"],
      fit: ["cover", "contain"],
      padding: ["none", "small", "medium", "large"],
    },
    (p, i) => {
      const width = 240,
        height = p.size === "small" ? 80 : 160;
      const [space, token] = padding[p.padding];
      return frame(
        "banner-image",
        [
          image(
            "image",
            assets[i % assets.length],
            width - 2 * space,
            height - 2 * space,
            p.fit === "cover" ? "FILL" : "FIT",
          ),
        ],
        width,
        height,
        {
          padding: space,
          clipContent: true,
          radius: 8,
          strokeWeight: 1,
          bindings: {
            fills: S.dim,
            strokes: S.subtle,
            strokeWeight: "border-width-default",
            cornerRadius: "border-radius-large",
            ...edges(token),
          },
        },
      );
    },
  ),
  [
    "fit and padding are Card.BannerImage props; size is the containing Card.Banner prop. The source ratios are small 3:1 and large 9:6, shown at the Card root minimum width 240px.",
    "Every fit/padding/size combination is represented; arbitrary parent widths, adjacent image separators, selection overlays and hover-description overlays remain composition/runtime concerns.",
  ],
);

export const thumbnailImage = recipe(
  "Card.ThumbnailImage",
  "Card/ThumbnailImage",
  ["Card/Card.ts", "Card/CardContent.tsx", "Card/styles/card.module.scss"],
  [
    {
      id: "default",
      props: {},
      root: frame(
        "thumbnail-image",
        [
          image(
            "image",
            assets.find((a) => a.id === "frontify-digital-touch"),
            40,
            40,
            "FIT",
          ),
        ],
        40,
        40,
        {
          radius: 4,
          clipContent: true,
          bindings: { fills: S.dim, cornerRadius: "border-radius-medium" },
        },
      ),
    },
  ],
  [
    "The public Card.ThumbnailImage is 40×40px with object-fit:contain and the medium radius. Its Card grid placement and 12px margins are supplied by the containing Card composition, not baked into the standalone image part.",
    "src and alt are open application content; the single native default uses one reviewed portrait fixture and does not invent an image-source enum.",
  ],
);

export const assetImagePreview = recipe(
  "AssetInput/image-preview",
  "AssetInput/image-preview",
  [
    "AssetInput/AssetInput.tsx",
    "AssetInput/AssetInputRoot.tsx",
    "AssetInput/AssetInputPreview.tsx",
    "AssetInput/AssetInputPreviewImage.tsx",
    "AssetInput/styles/asset-input.module.scss",
  ],
  axes(
    { orientation: ["horizontal", "vertical"], isOpen: [false, true] },
    (p, i) => {
      const vertical = p.orientation === "vertical",
        width = vertical ? 280 : 360;
      const previewWidth = vertical ? width - 2 : 56,
        previewHeight = vertical ? 128 : 56;
      const asset = assets[(i + 1) % assets.length];
      const preview = frame(
        "preview",
        [image("image", asset, previewWidth, previewHeight, "FIT")],
        previewWidth,
        previewHeight,
        { clipContent: true, bindings: { fills: S.dim } },
      );
      const divider = {
        id: "preview-divider",
        name: "Preview separator",
        kind: "rectangle",
        width: vertical ? previewWidth : 1,
        height: vertical ? 1 : previewHeight,
        bindings: {
          fills: S.line,
          [vertical ? "height" : "width"]: "border-width-default",
        },
      };
      const labels = frame(
        "labels",
        [
          text("title", asset.source.name),
          text("metadata", "Image · JPEG", "x-small", false, S.secondary),
        ],
        vertical ? width - 82 : width - 139,
        36,
        {
          layout: "VERTICAL",
          counterAlign: "MIN",
          primaryAlign: "CENTER",
          clipContent: true,
        },
      );
      const caret = frame(
        "caret",
        [
          {
            id: "caret-icon",
            name: "Caret",
            kind: "instance",
            iconId: p.isOpen === "true" ? "icon:caret-up" : "icon:caret-down",
            width: 16,
            height: 16,
            iconColor: S.secondary,
          },
        ],
        48,
        48,
        {
          padding: 16,
          primaryAlign: "CENTER",
          bindings: { fills: S.surface, ...edges("spacing-medium") },
        },
      );
      const content = frame(
        "content",
        [labels, caret],
        vertical ? width - 2 : width - 59,
        vertical ? 48 : 56,
        {
          paddingLeft: 16,
          primaryAlign: "SPACE_BETWEEN",
          bindings: { paddingLeft: "spacing-medium" },
        },
      );
      return frame(
        "asset-input-image",
        [preview, divider, content],
        width,
        vertical ? 179 : 58,
        {
          layout: vertical ? "VERTICAL" : "HORIZONTAL",
          radius: 4,
          padding: 1,
          strokeWeight: 1,
          clipContent: true,
          bindings: {
            fills: S.surface,
            strokes: p.isOpen === "true" ? S.strong : S.line,
            strokeWeight: "border-width-default",
            cornerRadius: "border-radius-medium",
            ...edges("border-width-default"),
          },
        },
      );
    },
  ),
  [
    "This separate recipe composes the released AssetInput.Root+Preview+PreviewImage; existing PDF/icon AssetInput recipes are retained. orientation and isOpen are actual Root props.",
    "Single-image preview uses object-fit:contain at 56px horizontal or 128px vertical. Root width 360/280 is a documented sample container; vertical title/caret row 48px derives from the 16px caret and 16px padding.",
    "Two-to-four-part image grids, loading states, missing-title/metadata layouts and text ellipsis are not enumerated here; arbitrary image URLs and onPress behavior stay in code.",
  ],
);

export default [bannerImage, thumbnailImage, assetImagePreview];
