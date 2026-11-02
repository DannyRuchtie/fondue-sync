import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [new URL("../src/plugin.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2017",
  define: { __html__: '"test"', __pluginVersion__: '"test"' },
});

const page = () => {
  const listeners = new Map<string, () => void>();
  return {
    removed: false,
    listeners,
    on: (event: string, callback: () => void) => listeners.set(event, callback),
    off: (event: string, callback: () => void) => {
      assert.equal(listeners.get(event), callback);
      listeners.delete(event);
    },
  };
};

function launch() {
  const events = new Map<string, () => void>();
  const messages: any[] = [];
  const api = {
    currentPage: page(),
    showUI: () => {},
    ui: {
      onmessage: undefined as undefined | ((message: any) => Promise<void>),
      postMessage: (message: any) => messages.push(message),
    },
    on: (event: string, callback: () => void) => {
      // Reproduce Figma's incremental-loading startup restriction.
      if (event === "documentchange")
        throw Error("Cannot register documentchange before loading all pages");
      events.set(event, callback);
    },
    loadAllPagesAsync: () => {
      throw Error("Startup must preserve incremental page loading");
    },
  };
  runInNewContext(compiled.outputFiles[0].text, { figma: api });
  return { api, events, messages };
}

test("plugin starts in incremental mode and invalidates reviews on edits, selection and styles", () => {
  const { api, events, messages } = launch();
  assert.equal(typeof api.ui.onmessage, "function");
  api.currentPage.listeners.get("nodechange")!();
  events.get("selectionchange")!();
  events.get("stylechange")!();
  assert.equal(messages.length, 3);
  assert.ok(messages.every((message) => message.type === "push-invalidated"));
});

test("page switches move the edit listener and invalidate the previous review", () => {
  const { api, events, messages } = launch();
  const previous = api.currentPage;
  api.currentPage = page();
  events.get("currentpagechange")!();
  assert.equal(previous.listeners.size, 0);
  assert.equal(api.currentPage.listeners.size, 1);
  api.currentPage.listeners.get("nodechange")!();
  assert.equal(messages.length, 2);
  // Switching back must not accumulate duplicate listeners.
  api.currentPage = previous;
  events.get("currentpagechange")!();
  assert.equal(previous.listeners.size, 1);
});
