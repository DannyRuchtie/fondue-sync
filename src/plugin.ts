import { organizeComponentNames } from "./organization";
import { bundleProblems } from "./preflight";
import { SyncEngine } from "./engine";
import releaseBundle from "../bundles/fondue-13.11.1.json";
import type { Bundle } from "./schema";
import { inspectSelection } from "./push-selection";
import { withCheckpoint } from "./checkpoint";
import { compose } from "./composer";
declare const __html__: string;
declare const __pluginVersion__: string;
const bundle = releaseBundle as unknown as Bundle;
figma.showUI(__html__, { width: 480, height: 720, themeColors: true });
let busy = false;
const post = (type: string, payload: any) =>
  figma.ui.postMessage({ type, ...payload });
function compact(report: any) {
  return {
    ...report,
    actions: report.actions.map(({ definition, ...action }: any) => action),
  };
}
const invalidatePush = () => post("push-invalidated", {});
// The active page is already loaded. A documentchange listener would require
// loading the entire file first when using dynamic-page document access.
let watchedPage = figma.currentPage;
watchedPage.on("nodechange", invalidatePush);
figma.on("currentpagechange", () => {
  if (!watchedPage.removed) watchedPage.off("nodechange", invalidatePush);
  watchedPage = figma.currentPage;
  watchedPage.on("nodechange", invalidatePush);
  invalidatePush();
});
figma.on("selectionchange", invalidatePush);
figma.on("stylechange", invalidatePush);
figma.ui.onmessage = async (message: {
  type: string;
  requestId?: string;
  amount?: number;
}) => {
  if (busy) {
    if (message.type === "push-scan")
      post("push-error", {
        requestId: message.requestId,
        message:
          "Wait for the current operation to finish, then review the selection again.",
      });
    return;
  }
  busy = true;
  try {
    if (message.type === "push-scan") {
      post("push-report", {
        requestId: message.requestId,
        report: await inspectSelection(figma, bundle),
      });
      return;
    }
    const engine = new SyncEngine(figma, bundle);
    if (message.type.startsWith("compose-")) {
      post(
        "composition-result",
        await compose(
          figma,
          engine.index.assets,
          message.type.slice(8),
          message.amount,
        ),
      );
      return;
    }
    if (message.type === "status")
      post("status", {
        release: bundle.release,
        pluginVersion: __pluginVersion__,
        applied: engine.index.release ?? null,
        appliedFingerprint: engine.index.fingerprint ?? null,
        hasManagedAssets: Object.keys(engine.index.assets).length > 0,
        fingerprint: bundle.fingerprint,
        lastErrors: engine.index.lastErrors ?? [],
        counts: {
          tokens: bundle.tokens.length,
          styles: bundle.styles.length,
          icons: bundle.icons.length,
          recipes: bundle.recipes.length,
        },
        gaps: bundle.gaps,
        composition: bundle.composition ?? [],
        tokenChoices: bundle.tokens.filter((token) =>
          /^var\(--[a-z0-9-]+\)$/.test(token.css),
        ),
        publication: "Publishing and consumer acceptance are managed in Figma.",
      });
    else if (message.type === "compare" || message.type === "validate") {
      const report = await engine.inspect((text) => post("progress", { text }));
      const problems = bundleProblems(bundle);
      report.errors.push(...problems.map((p) => p.message));
      report.complete = report.complete && !problems.length;
      post("report", {
        report: compact(report),
        validation: message.type === "validate",
      });
    } else if (message.type === "organize") {
      post("progress", {
        text: "Saving a recovery version before organizing components…",
      });
      const report = await withCheckpoint(
        figma,
        "update",
        bundle.release,
        async (checkpoint) => {
          post("checkpoint", { checkpoint });
          return organizeComponentNames(figma, bundle, engine.index);
        },
      );
      post("organization-report", { report });
    } else if (message.type === "import" || message.type === "update") {
      if (message.type === "import" && Object.keys(engine.index.assets).length)
        throw Error(
          "This file already has managed Fondue assets. Choose Compare and Update library.",
        );
      post("progress", {
        text: "Saving a recovery version before making changes…",
      });
      const report = await withCheckpoint(
        figma,
        message.type,
        bundle.release,
        async (checkpoint) => {
          post("checkpoint", { checkpoint });
          return engine.sync((text) => post("progress", { text }));
        },
      );
      post("report", { report: compact(report) });
    }
  } catch (error) {
    post(message.type === "push-scan" ? "push-error" : "error", {
      requestId: message.requestId,
      message: String(error),
    });
  } finally {
    busy = false;
    post("idle", {});
  }
};
