import type { ImageAsset } from "./schema";
/** Offline image decoding/integrity checks; no atob, fetch, Node or WebCrypto dependency. */
export function decodeImageBase64(value: string): Uint8Array {
  if (
    !value ||
    value.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw Error("Invalid canonical image base64");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8Array(
    (value.length / 4) * 3 -
      (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0),
  );
  let at = 0;
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i]),
      b = alphabet.indexOf(value[i + 1]),
      c = alphabet.indexOf(value[i + 2]),
      d = alphabet.indexOf(value[i + 3]);
    if (
      (value[i + 2] === "=" && b & 15) ||
      (value[i + 3] === "=" && c >= 0 && c & 3)
    )
      throw Error("Noncanonical image base64 padding");
    out[at++] = (a << 2) | (b >> 4);
    if (at < out.length) out[at++] = (b << 4) | (c >> 2);
    if (at < out.length) out[at++] = (c << 6) | d;
  }
  return out;
}
/** SHA256 over exact encoded file bytes; content identity, not native Figma imageHash. */
export function imageSha256(bytes: Uint8Array): string {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const bits = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(padded.length - 4, bits >>> 0);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n)),
    w = new Int32Array(64);
  for (let at = 0; at < padded.length; at += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(at + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2];
      w[i] =
        (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
        w[i - 16] +
        (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10)) +
        w[i - 7];
    }
    let [a, b, c, d, e, f, g, z] = h;
    for (let i = 0; i < 64; i++) {
      const t =
        (z +
          (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
          ((e & f) ^ (~e & g)) +
          k[i] +
          w[i]) |
        0;
      const q =
        ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      z = g;
      g = f;
      f = e;
      e = (d + t) | 0;
      d = c;
      c = b;
      b = a;
      a = (t + q) | 0;
    }
    [a, b, c, d, e, f, g, z].forEach((x, i) => (h[i] = (h[i] + x) | 0));
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
export function encodedImageInfo(bytes: Uint8Array): {
  mimeType: string;
  width: number;
  height: number;
} {
  const u16 = (i: number) => bytes[i] * 256 + bytes[i + 1],
    u32 = (i: number) =>
      bytes[i] * 0x1000000 +
      (bytes[i + 1] << 16) +
      (bytes[i + 2] << 8) +
      bytes[i + 3];
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR"
  )
    return { mimeType: "image/png", width: u32(16), height: u32(20) };
  if (
    bytes.length >= 10 &&
    /^GIF8[79]a$/.test(String.fromCharCode(...bytes.slice(0, 6)))
  )
    return {
      mimeType: "image/gif",
      width: bytes[6] + bytes[7] * 256,
      height: bytes[8] + bytes[9] * 256,
    };
  if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i++] !== 255) throw Error("Invalid JPEG marker");
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = u16(i);
      if (length < 2 || i + length > bytes.length)
        throw Error("Invalid JPEG segment");
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      )
        return {
          mimeType: "image/jpeg",
          height: u16(i + 3),
          width: u16(i + 5),
        };
      i += length;
    }
  }
  throw Error(
    "Unsupported or malformed encoded image; expected PNG, JPEG or GIF",
  );
}
export function validatedImageBytes(asset: ImageAsset): Uint8Array {
  if (
    !asset ||
    typeof asset.id !== "string" ||
    !asset.id ||
    !/^[a-f0-9]{64}$/.test(asset.sha256) ||
    typeof asset.base64 !== "string"
  )
    throw Error("Invalid image registry identity/digest");
  const bytes = decodeImageBase64(asset.base64);
  if (imageSha256(bytes) !== asset.sha256)
    throw Error(`Image SHA256 mismatch: ${asset.id}`);
  const actual = encodedImageInfo(bytes);
  if (
    actual.mimeType !== asset.mimeType ||
    actual.width !== asset.width ||
    actual.height !== asset.height ||
    actual.width < 1 ||
    actual.height < 1 ||
    actual.width > 4096 ||
    actual.height > 4096
  )
    throw Error(
      `Image MIME/dimensions mismatch or unsupported native size: ${asset.id}`,
    );
  return bytes;
}
