/** Exact offline encoded image bytes. Native imageHash is resolved at import, never serialized as source identity. */
export type ImageAsset = {
  id: string;
  sha256: string;
  base64: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif";
  width: number;
  height: number;
  source?: Record<string, unknown>;
};
export type Token = {
  id: string;
  name: string;
  type: "COLOR" | "FLOAT" | "STRING";
  collection: "Primitives" | "Semantic";
  values: Record<string, any>;
  css: string;
  scopes?: string[];
  provenance?: Record<string, unknown>;
  nativeFontFamily?: { sourceFamily: string; style: string };
};
export type Layer = {
  id: string;
  kind:
    | "frame"
    | "text"
    | "rectangle"
    | "ellipse"
    | "svg"
    | "instance"
    | "componentInstance";
  name: string;
  /** Native editable content region; children are library defaults, not instance content. */
  contentSlot?: {
    id: string;
    name: string;
    description?: string;
    minChildren?: number;
    maxChildren?: number;
  };
  text?: string;
  imageAssetId?: string;
  imageAssetSha256?: string;
  imageScaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
  imageTransform?: Transform;
  imageScalingFactor?: number;
  svg?: string;
  svgFillNone?: boolean;
  clearSvgRootFills?: boolean;
  svgPaintBindings?: {
    paint: "fill" | "stroke";
    color: string;
    tokenId: string;
  }[];
  paintRole?: string;
  iconId?: string;
  componentName?: string;
  componentRole?: string;
  /** Overrides target unique, existing source anatomy; they never insert or detach children. */
  instanceOverrides?: Record<string, Partial<Layer>>;
  recipeId?: string;
  variantProps?: Record<string, string>;
  textOverrides?: Record<string, string>;
  dataBinding?: Record<string, unknown>;
  textStyle?: string;
  effectStyle?: string;
  rotation?: number;
  focusRing?: {
    inner: string;
    outer: string;
    innerSpread?: number;
    outerSpread?: number;
  };
  effects?: Effect[];
  clipContent?: boolean;
  iconColor?: string;
  lineHeight?: number;
  fontFamily?: string;
  strokeWeight?: number;
  strokeWidth?: number;
  opacity?: number;
  visible?: boolean;
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  primaryAlign?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAlign?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
  arcData?: { startingAngle: number; endingAngle: number; innerRadius: number };
  width?: number;
  height?: number;
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  layout?: "HORIZONTAL" | "VERTICAL";
  gap?: number;
  padding?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  x?: number;
  y?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  textCase?: TextCase;
  bindings?: Record<string, string>;
  children?: Layer[];
};
export type Recipe = {
  /** Generated browsing metadata; source name and stable recipe ID stay unchanged. */
  libraryCategory?: string;
  assetName?: string;
  /** Authorizes owned primitive-to-base-instance composition upgrades beneath stable mains. */
  compositionPolicy?: 1;
  componentPropertyPolicy?: 2;
  id: string;
  name: string;
  package: string;
  source: string[];
  status: "supported" | "partial";
  limitations: string[];
  documentation?: {
    purpose: string;
    usage: string;
    properties: string;
    description: string;
    origin: string;
    metadataSource: string | null;
    links: { uri: string }[];
  };
  variants: { id: string; props: Record<string, string>; root: Layer }[];
};
export type Bundle = {
  schemaVersion: 1;
  release: string;
  provenance: Record<string, any>;
  tokens: Token[];
  styles: any[];
  icons: {
    id: string;
    name: string;
    svg: string;
    source: string;
    sizes?: { size: number; svg: string; source: string }[];
    defaultColorToken?: string;
  }[];
  recipes: Recipe[];
  imageAssets?: ImageAsset[];
  examples?: {
    id: string;
    name: string;
    root: Layer;
    bindings?: any;
    documentation?: any;
  }[];
  fixtures?: Record<string, any>;
  inventory: any[];
  composition?: {
    key: string;
    name: string;
    package: string;
    mode: string;
    state: string;
    regions: string[];
    reason: string;
    slots: {
      recipeId: string;
      component: string;
      path: string;
      name: string;
    }[];
    recipeIds: string[];
    entryRecipeId?: string;
  }[];
  gaps: any[];
  fingerprint: string;
};
