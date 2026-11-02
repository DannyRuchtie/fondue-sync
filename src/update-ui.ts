import { checkUpdates } from "./updates";

const container = document.getElementById("updates")!;
const status = document.getElementById("update-status")!;
const retry = document.getElementById("check-updates") as HTMLButtonElement;
let versions: { plugin: string; fondue: string } | undefined;
let started = false;
async function check() {
  if (!versions || retry.disabled) return;
  retry.disabled = true;
  status.textContent = "Checking for newer versions…";
  try {
    const results = await checkUpdates(versions.plugin, versions.fondue);
    status.replaceChildren();
    for (const result of results) {
      const line = document.createElement("p");
      if (result.state === "available") {
        line.textContent = `${result.name} ${result.latest} is available (installed: ${result.current}). `;
        const link = document.createElement("a");
        link.href = result.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent =
          result.name === "Fondue Sync"
            ? "Get plugin update"
            : "View Fondue release";
        line.appendChild(link);
        const instruction = document.createElement("span");
        instruction.textContent =
          result.name === "Fondue Sync"
            ? " Install the new plugin build, then Compare before updating the library."
            : " A maintainer must package this release before it can be synced.";
        line.appendChild(instruction);
      } else {
        line.textContent =
          result.state === "current"
            ? `${result.name} ${result.current}: no newer stable release found.`
            : `${result.name} ${result.current}: update check unavailable. You can keep working.`;
      }
      status.appendChild(line);
    }
  } finally {
    retry.disabled = false;
  }
}
retry.addEventListener("click", () => void check());
window.addEventListener("message", (event) => {
  if (event.source !== parent) return;
  const message = event.data?.pluginMessage;
  if (message?.type !== "status" || started) return;
  started = true;
  versions = { plugin: message.pluginVersion, fondue: message.release };
  container.hidden = false;
  void check();
});
