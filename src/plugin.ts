import { bundleProblems } from "./preflight";
import { SyncEngine } from "./engine";
import releaseBundle from "../bundles/fondue-13.11.1.json";
import type { Bundle } from "./schema";
declare const __html__: string;
const bundle = releaseBundle as unknown as Bundle;
figma.showUI(__html__, { width: 440, height: 620, themeColors: true });
let busy = false;
const post = (type: string, payload: any) =>
  figma.ui.postMessage({ type, ...payload });
function compact(report: any) {
  return {
    ...report,
    actions: report.actions.map(({ definition, ...action }: any) => action),
  };
}
figma.ui.onmessage = async (message: { type: string }) => {
  if (busy) return;
  busy = true;
  try {
    const engine = new SyncEngine(figma, bundle);
    if (message.type === "status")
      post("status", {
        release: bundle.release,
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
        publication: "Publishing and consumer acceptance are managed in Figma.",
      });
    else if (message.type === "compare" || message.type === "validate") {
      const report = await engine.inspect();
      const problems = bundleProblems(bundle);
      report.errors.push(...problems.map((p) => p.message));
      report.complete = report.complete && !problems.length;
      post("report", {
        report: compact(report),
        validation: message.type === "validate",
      });
    } else if (message.type === "import" || message.type === "update") {
      if (message.type === "import" && Object.keys(engine.index.assets).length)
        throw Error(
          "This file already has managed Fondue assets. Choose Compare and Update library.",
        );
      const report = await engine.sync((text) => post("progress", { text }));
      post("report", { report: compact(report) });
    }
  } catch (error) {
    post("error", { message: String(error) });
  } finally {
    busy = false;
    post("idle", {});
  }
};
