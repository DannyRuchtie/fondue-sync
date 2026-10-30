import type { Bundle, ImageAsset } from "../src/schema";
export function loadImageAssets(manifestPath: string): ImageAsset[];
export function enrichImageReferences(
  bundle: Bundle,
  imageAssets: ImageAsset[],
): { assets: number; references: number; encodedBytes: number };
