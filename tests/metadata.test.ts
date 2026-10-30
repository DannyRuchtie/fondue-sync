import { test } from "node:test";
import assert from "node:assert/strict";
import {
  read,
  write,
  utf8Length,
  METADATA_NAMESPACE,
  METADATA_CHUNK_BYTES,
} from "../src/metadata";
function store() {
  const values = new Map<string, string>();
  let reject: (key: string, value: string) => boolean = () => false;
  const sizes: number[] = [];
  return {
    values,
    sizes,
    setReject(fn: typeof reject) {
      reject = fn;
    },
    getSharedPluginData(ns: string, key: string) {
      return values.get(ns + ":" + key) ?? "";
    },
    getSharedPluginDataKeys(ns: string) {
      return [...values.keys()]
        .filter((k) => k.startsWith(ns + ":"))
        .map((k) => k.slice(ns.length + 1));
    },
    setSharedPluginData(ns: string, key: string, value: string) {
      const length =
        Buffer.byteLength(ns) +
        Buffer.byteLength(key) +
        Buffer.byteLength(value);
      assert.ok(length <= 100000, "native entry limit");
      sizes.push(length);
      if (reject(key, value)) throw Error("Simulated native write failure");
      if (value === "") values.delete(ns + ":" + key);
      else values.set(ns + ":" + key, value);
    },
  };
}
test("UTF8 byte measurement matches native UTF8 including astral and lone surrogates", () => {
  for (const value of [
    "ASCII",
    "é",
    "中文",
    "😀",
    "a😀b",
    "\ud800",
    "\udc00",
    "\ud800x\udc00",
  ])
    assert.equal(utf8Length(value), Buffer.byteLength(value));
});
test("large Unicode records round-trip at bounded UTF8 chunk entry sizes", () => {
  const s = store();
  const value = "a😀é中文\ud800\udc00x\ud800".repeat(50000);
  assert.ok(Buffer.byteLength(value) > 1000000);
  write(s, "large", value);
  assert.equal(read(s, "large"), value);
  for (const [key, chunk] of s.values)
    if (!key.endsWith("__fs_head"))
      assert.ok(Buffer.byteLength(chunk) <= METADATA_CHUNK_BYTES);
  assert.ok(Math.max(...s.sizes) < 100000);
});
test("chunk-write failure preserves the previous committed generation without blending", () => {
  const s = store();
  write(s, "record", "old😀".repeat(10000));
  const previous = read(s, "record");
  const head = s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head");
  s.setReject((key) => key.endsWith("_1"));
  assert.throws(() => write(s, "record", "new中文".repeat(15000)), /Simulated/);
  assert.equal(
    s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head"),
    head,
  );
  assert.equal(read(s, "record"), previous);
  s.setReject(() => false);
  write(s, "record", "recovered");
  assert.equal(read(s, "record"), "recovered");
});
test("head-write failure preserves old value and next commit cleans old/orphan chunks", () => {
  const s = store();
  write(s, "record", "previous");
  s.setReject((key) => key === "record__fs_head");
  assert.throws(() => write(s, "record", "next".repeat(20000)), /Simulated/);
  assert.equal(read(s, "record"), "previous");
  s.setReject(() => false);
  write(s, "record", "final");
  assert.equal(read(s, "record"), "final");
  const keys = s.getSharedPluginDataKeys(METADATA_NAMESPACE);
  assert.equal(keys.length, 1);
});
test("missing or corrupted committed chunks fail explicitly", () => {
  const s = store();
  write(s, "record", "valid".repeat(10000));
  const head = JSON.parse(
    s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head"),
  );
  const key = METADATA_NAMESPACE + ":record__fs_" + head.gen + "_0";
  s.values.set(key, "wrong");
  assert.throws(() => read(s, "record"), /integrity mismatch/);
  s.values.delete(key);
  assert.throws(() => read(s, "record"), /missing committed chunk/);
});
test("empty records commit an explicit zero-part head and remain empty after reopen", () => {
  const s = store();
  write(s, "record", "prior");
  write(s, "record", "");
  assert.equal(read(s, "record"), "");
  const head = JSON.parse(
    s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head"),
  );
  assert.equal(head.parts, 0);
  assert.equal(head.bytes, 0);
  assert.equal(s.getSharedPluginDataKeys(METADATA_NAMESPACE).length, 1);
});
test("legacy direct and chunked records remain readable and migrate only after successful commit", () => {
  const s = store();
  s.setSharedPluginData(METADATA_NAMESPACE, "direct", "old direct");
  assert.equal(read(s, "direct"), "old direct");
  s.setSharedPluginData(METADATA_NAMESPACE, "record_parts", "2");
  s.setSharedPluginData(METADATA_NAMESPACE, "record_0", "old ");
  s.setSharedPluginData(METADATA_NAMESPACE, "record_1", "chunks");
  assert.equal(read(s, "record"), "old chunks");
  s.setReject((key) => key === "record__fs_head");
  assert.throws(() => write(s, "record", "new"), /Simulated/);
  assert.equal(read(s, "record"), "old chunks");
  s.setReject(() => false);
  write(s, "record", "new");
  assert.equal(read(s, "record"), "new");
  assert.equal(s.getSharedPluginData(METADATA_NAMESPACE, "record_parts"), "");
  assert.equal(s.getSharedPluginData(METADATA_NAMESPACE, "record_0"), "");
  assert.equal(read(s, "direct"), "old direct");
});
test("legacy empty chunk and deletion semantics stay compatible", () => {
  const s = store();
  s.setSharedPluginData(METADATA_NAMESPACE, "record_parts", "1");
  assert.equal(read(s, "record"), "");
  write(s, "record", "");
  assert.equal(read(s, "record"), "");
});
test("cleanup failure cannot roll back a committed record", () => {
  const s = store();
  write(s, "record", "old".repeat(10000));
  s.setReject((key, value) => value === "" && key !== "record__fs_head");
  write(s, "record", "new");
  assert.equal(read(s, "record"), "new");
});
test("small Unicode and JSON-special records use exactly one atomic inline head write", () => {
  const s = store();
  const value = '😀é中文"\\\n\t\ud800';
  write(s, "inline", value);
  assert.equal(s.sizes.length, 1);
  assert.ok(s.sizes[0] <= METADATA_CHUNK_BYTES);
  const head = JSON.parse(
    s.getSharedPluginData(METADATA_NAMESPACE, "inline__fs_head"),
  );
  assert.equal(head.parts, 0);
  assert.equal(head.inline, value);
  assert.equal(head.bytes, Buffer.byteLength(value));
  assert.equal(read(s, "inline"), value);
});
test("unchanged inline, chunked, absent-empty and legacy values cause zero native writes", () => {
  const s = store();
  write(s, "inline", "same");
  write(s, "chunked", "large😀".repeat(10000));
  s.setSharedPluginData(METADATA_NAMESPACE, "legacy", "same legacy");
  const count = s.sizes.length;
  write(s, "inline", "same");
  write(s, "chunked", "large😀".repeat(10000));
  write(s, "absent", "");
  write(s, "legacy", "same legacy");
  assert.equal(s.sizes.length, count);
});
test("inline head failure preserves the previous complete inline value", () => {
  const s = store();
  write(s, "record", "before😀");
  const old = s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head");
  s.setReject((key) => key === "record__fs_head");
  assert.throws(() => write(s, "record", "after中文"), /Simulated/);
  assert.equal(
    s.getSharedPluginData(METADATA_NAMESPACE, "record__fs_head"),
    old,
  );
  assert.equal(read(s, "record"), "before😀");
});
test("inline payload corruption is detected by checksum and bytes", () => {
  const s = store();
  write(s, "record", "before");
  const key = METADATA_NAMESPACE + ":record__fs_head";
  const head = JSON.parse(s.values.get(key)!);
  head.inline = "broken";
  s.values.set(key, JSON.stringify(head));
  assert.throws(() => read(s, "record"), /integrity mismatch/);
});
test("inline decision includes JSON escaping and UTF8 namespace/key/head overhead", () => {
  const s = store();
  const escaped = "\ud800".repeat(5000);
  write(s, "escaped", escaped);
  const head = JSON.parse(
    s.getSharedPluginData(METADATA_NAMESPACE, "escaped__fs_head"),
  );
  assert.ok(head.parts > 0);
  assert.ok(!Object.prototype.hasOwnProperty.call(head, "inline"));
  assert.equal(read(s, "escaped"), escaped);
  const plain = "a".repeat(23000);
  write(s, "plain", plain);
  const inline = JSON.parse(
    s.getSharedPluginData(METADATA_NAMESPACE, "plain__fs_head"),
  );
  assert.equal(inline.inline, plain);
  assert.ok(s.sizes.every((size) => size < 100000));
});
