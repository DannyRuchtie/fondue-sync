/** Per-record atomic shared-plugin-data storage.
 * Small records live inline in one bounded head entry. Large records use immutable
 * generation chunks, then commit one small head entry. Unchanged values write nothing.
 * This is atomic at the head-entry boundary only: it is NOT a canvas transaction,
 * a transaction across records/nodes, or a global transaction with the root index.
 * FNV detects accidental corruption; provenance and authenticity use bundle SHA256.
 */
export const METADATA_NAMESPACE = "fondue_sync";
export const METADATA_ENTRY_LIMIT = 100_000;
export const METADATA_CHUNK_BYTES = 24_000;
type ObjectStore = {
  getSharedPluginData(namespace: string, key: string): string;
  setSharedPluginData(namespace: string, key: string, value: string): void;
  getSharedPluginDataKeys?(namespace: string): string[];
};
type Head = {
  version: 1;
  gen: string;
  parts: number;
  bytes: number;
  checksum: string;
  inline?: string;
};
let generationSequence = 0;
/** UTF-8 length, matching replacement encoding for unpaired UTF-16 surrogates.
 * No TextEncoder dependency: the classic plugin sandbox need not provide it.
 */
export function utf8Length(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}
/** FNV-1a over exact UTF-16 code units as two little-endian bytes. */
function checksum(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    hash = Math.imul(hash ^ (code & 255), 0x01000193);
    hash = Math.imul(hash ^ (code >>> 8), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const headKey = (key: string) => key + "__fs_head";
const chunkPrefix = (key: string, gen: string) => key + "__fs_" + gen + "_";
function fail(key: string, message: string): never {
  throw Error(`Fondue metadata ${key}: ${message}`);
}
function parseHead(raw: string, key: string): Head {
  let head: any;
  try {
    head = JSON.parse(raw);
  } catch {
    fail(key, "invalid committed head JSON");
  }
  if (
    head?.version !== 1 ||
    typeof head.gen !== "string" ||
    !/^[a-z0-9_-]{1,80}$/.test(head.gen) ||
    !Number.isSafeInteger(head.parts) ||
    head.parts < 0 ||
    !Number.isSafeInteger(head.bytes) ||
    head.bytes < 0 ||
    typeof head.checksum !== "string" ||
    !/^[0-9a-f]{8}$/.test(head.checksum)
  )
    fail(key, "invalid committed head manifest");
  if (Object.prototype.hasOwnProperty.call(head, "inline")) {
    if (
      typeof head.inline !== "string" ||
      head.parts !== 0 ||
      utf8Length(METADATA_NAMESPACE) +
        utf8Length(headKey(key)) +
        utf8Length(raw) >
        METADATA_CHUNK_BYTES
    )
      fail(key, "invalid inline committed head");
  } else if (
    (head.bytes === 0) !== (head.parts === 0) ||
    head.parts < Math.ceil(head.bytes / METADATA_CHUNK_BYTES) ||
    head.parts > Math.ceil(head.bytes / (METADATA_CHUNK_BYTES - 3))
  )
    fail(key, "inconsistent committed head lengths");
  return head;
}
function setEntry(object: ObjectStore, key: string, value: string) {
  if (
    utf8Length(METADATA_NAMESPACE) + utf8Length(key) + utf8Length(value) >
    METADATA_ENTRY_LIMIT
  )
    fail(key, "shared-data entry exceeds 100000 UTF-8 bytes");
  object.setSharedPluginData(METADATA_NAMESPACE, key, value);
}
function readGeneration(object: ObjectStore, key: string, head: Head): string {
  const chunks: string[] = [];
  for (let i = 0; i < head.parts; i++) {
    const chunk = object.getSharedPluginData(
      METADATA_NAMESPACE,
      chunkPrefix(key, head.gen) + i,
    );
    if (!chunk) fail(key, `missing committed chunk ${i}`);
    if (utf8Length(chunk) > METADATA_CHUNK_BYTES)
      fail(key, `oversized committed chunk ${i}`);
    chunks.push(chunk);
  }
  const value = head.inline ?? chunks.join("");
  if (utf8Length(value) !== head.bytes || checksum(value) !== head.checksum)
    fail(key, "committed record integrity mismatch");
  return value;
}
/** Read the committed generation; never blend generations or hide committed corruption.
 * Existing _parts records remain readable until their first successful new write.
 */
export function read(object: ObjectStore, key: string): string {
  const raw = object.getSharedPluginData(METADATA_NAMESPACE, headKey(key));
  if (raw) return readGeneration(object, key, parseHead(raw, key));
  const legacyParts = object.getSharedPluginData(
    METADATA_NAMESPACE,
    key + "_parts",
  );
  if (legacyParts) {
    const count = Number(legacyParts);
    if (!Number.isSafeInteger(count) || count < 1)
      fail(key, "invalid legacy part count");
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = object.getSharedPluginData(
        METADATA_NAMESPACE,
        key + "_" + i,
      );
      if (!part && !(count === 1 && i === 0))
        fail(key, `missing legacy chunk ${i}`);
      chunks.push(part);
    }
    return chunks.join("");
  }
  return object.getSharedPluginData(METADATA_NAMESPACE, key);
}
function chunksOf(value: string): string[] {
  const chunks: string[] = [];
  let start = 0,
    bytes = 0;
  for (let index = 0; index < value.length;) {
    const code = value.codePointAt(index)!;
    const units = code > 0xffff ? 2 : 1;
    const next = code < 0x80 ? 1 : code < 0x800 ? 2 : code > 0xffff ? 4 : 3;
    if (bytes + next > METADATA_CHUNK_BYTES) {
      chunks.push(value.slice(start, index));
      start = index;
      bytes = 0;
    }
    bytes += next;
    index += units;
  }
  if (start < value.length) chunks.push(value.slice(start));
  return chunks;
}
/** Commit one record. Failed chunk/head writes leave the previous committed head intact.
 * Cleanup is best effort AFTER commitment; cleanup failure never invalidates success.
 */
export function write(object: ObjectStore, key: string, value: string): void {
  const oldRaw = object.getSharedPluginData(METADATA_NAMESPACE, headKey(key));
  const oldHead = oldRaw ? parseHead(oldRaw, key) : null;
  const previous = oldHead
    ? readGeneration(object, key, oldHead)
    : read(object, key); // Reject committed corruption before deciding to skip.
  if (previous === value) return; // A no-op performs no native writes, including cleanup.
  const oldLegacy = oldHead
    ? null
    : object.getSharedPluginData(METADATA_NAMESPACE, key + "_parts");
  const gen =
    Date.now().toString(36) +
    "_" +
    (++generationSequence).toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10);
  const candidate: Head = {
    version: 1,
    gen,
    parts: 0,
    bytes: utf8Length(value),
    checksum: checksum(value),
    inline: value,
  };
  const isInline =
    utf8Length(METADATA_NAMESPACE) +
      utf8Length(headKey(key)) +
      utf8Length(JSON.stringify(candidate)) <=
    METADATA_CHUNK_BYTES;
  const chunks = isInline ? [] : chunksOf(value);
  const head: Head = isInline
    ? candidate
    : {
        version: 1,
        gen,
        parts: chunks.length,
        bytes: candidate.bytes,
        checksum: candidate.checksum,
      };
  // Check even an empty record's head key before creating any generation entries.
  if (
    utf8Length(METADATA_NAMESPACE) +
      utf8Length(headKey(key)) +
      utf8Length(JSON.stringify(head)) >
    METADATA_ENTRY_LIMIT
  )
    fail(key, "head entry exceeds 100000 UTF-8 bytes");
  chunks.forEach((chunk, i) => {
    const storageKey = chunkPrefix(key, gen) + i;
    if (object.getSharedPluginData(METADATA_NAMESPACE, storageKey) !== "")
      fail(key, "generation collision; existing chunks are immutable");
    setEntry(object, storageKey, chunk);
  });
  setEntry(object, headKey(key), JSON.stringify(head)); // The sole commit point.
  try {
    if (oldHead)
      for (let i = 0; i < oldHead.parts; i++)
        setEntry(object, chunkPrefix(key, oldHead.gen) + i, "");
    if (oldLegacy) {
      const count = Number(oldLegacy);
      if (Number.isSafeInteger(count) && count >= 1)
        for (let i = 0; i < count; i++) setEntry(object, key + "_" + i, "");
      setEntry(object, key + "_parts", "");
    }
    if (object.getSharedPluginData(METADATA_NAMESPACE, key))
      setEntry(object, key, "");
    // Failed earlier writes may have left orphan generation chunks. Only this exact
    // record's generated chunk namespace is owned; do not delete arbitrary prefixes.
    if (object.getSharedPluginDataKeys) {
      const prefix = key + "__fs_";
      const current = chunkPrefix(key, gen);
      for (const stored of object.getSharedPluginDataKeys(METADATA_NAMESPACE)) {
        const suffix = stored.slice(prefix.length);
        if (
          stored.startsWith(prefix) &&
          !stored.startsWith(current) &&
          /^[a-z0-9_-]{1,80}_\d+$/.test(suffix)
        )
          setEntry(object, stored, "");
      }
    }
  } catch {
    /* New head is committed; cleanup is optional and retry-safe. */
  }
}
