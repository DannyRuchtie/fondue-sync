import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
function info(bytes) {
  if (
    bytes.length >= 24 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR"
  )
    return {
      mimeType: "image/png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6)))
    return {
      mimeType: "image/gif",
      width: bytes.readUInt16LE(6),
      height: bytes.readUInt16LE(8),
    };
  if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i++] !== 255) break;
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes.readUInt16BE(i);
      if (length < 2 || i + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      )
        return {
          mimeType: "image/jpeg",
          height: bytes.readUInt16BE(i + 3),
          width: bytes.readUInt16BE(i + 5),
        };
      i += length;
    }
  }
  throw Error(
    "Unsupported or malformed offline image; expected PNG, JPEG or GIF",
  );
}
/** Manifest paths resolve beneath its own directory; no remote retrieval at build/import. */
export function loadImageAssets(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.assets))
    throw Error("Image manifest requires assets array");
  const dir = fs.realpathSync(path.dirname(manifestPath)),
    ids = new Set();
  return manifest.assets
    .map((asset) => {
      if (
        !asset ||
        typeof asset.id !== "string" ||
        !asset.id ||
        ids.has(asset.id) ||
        typeof asset.file !== "string" ||
        path.isAbsolute(asset.file)
      )
        throw Error(
          "Invalid/duplicate offline image manifest identity or file",
        );
      ids.add(asset.id);
      const file = fs.realpathSync(path.resolve(dir, asset.file));
      if (!file.startsWith(dir + path.sep))
        throw Error("Image file escapes manifest directory");
      const bytes = fs.readFileSync(file),
        sha256 = crypto.createHash("sha256").update(bytes).digest("hex"),
        actual = info(bytes);
      if (asset.sha256 !== undefined && asset.sha256 !== sha256)
        throw Error(`Offline image SHA256 mismatch: ${asset.id}`);
      for (const key of ["mimeType", "width", "height"])
        if (asset[key] !== undefined && asset[key] !== actual[key])
          throw Error(`Offline image ${key} mismatch: ${asset.id}`);
      if (
        actual.width < 1 ||
        actual.height < 1 ||
        actual.width > 4096 ||
        actual.height > 4096
      )
        throw Error(`Offline image exceeds native dimensions: ${asset.id}`);
      return {
        id: asset.id,
        sha256,
        base64: bytes.toString("base64"),
        ...actual,
        ...(asset.source ? { source: asset.source } : {}),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
}
/** Layer digests participate in managed definitions; encoded bytes occur once in the registry. */
export function enrichImageReferences(bundle, imageAssets) {
  const byId = new Map(imageAssets.map((asset) => [asset.id, asset]));
  let references = 0;
  const visit = (layer) => {
    if (layer.imageAssetId) {
      const asset = byId.get(layer.imageAssetId);
      if (!asset)
        throw Error(`Missing offline image ${layer.imageAssetId}: ${layer.id}`);
      layer.imageAssetSha256 = asset.sha256;
      references++;
    }
    for (const child of layer.children ?? []) visit(child);
  };
  for (const recipe of bundle.recipes)
    for (const variant of recipe.variants) visit(variant.root);
  for (const example of bundle.examples ?? []) visit(example.root);
  if (imageAssets.length) bundle.imageAssets = imageAssets;
  return {
    assets: imageAssets.length,
    references,
    encodedBytes: imageAssets.reduce(
      (sum, a) => sum + Buffer.from(a.base64, "base64").length,
      0,
    ),
  };
}
