(() => {
  const byId = (id) => document.getElementById(id);
  const endpoint = "http://localhost:3848";
  let report = null,
    preview = null,
    paired = false,
    working = false,
    generation = 0;
  let tokenCatalog = [];
  let sourceChoices = {};
  const pending = new Map();
  let sequence = 0;
  const text = (id, value) => {
    byId(id).textContent = value;
  };
  const selectedIds = () =>
    [...document.querySelectorAll("[data-change-id]:checked")].map(
      (el) => el.dataset.changeId,
    );
  const names = () =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-token-id]")].map((el) => [
        el.dataset.tokenId,
        el.value.trim(),
      ]),
    );
  const mappingChoices = () => ({
    ...sourceChoices,
    ...Object.fromEntries(
      [...document.querySelectorAll("[data-mapping-id]")]
        .filter((el) => el.value)
        .map((el) => [el.dataset.mappingId, el.value]),
    ),
  });
  function controls() {
    byId("push-scan").disabled = working;
    byId("push-connect").disabled = working;
    byId("push-preview").disabled =
      working || !paired || !report || !selectedIds().length;
    byId("push-create").disabled =
      working ||
      !preview ||
      (preview.blockers ?? []).length > 0 ||
      !byId("push-ack").checked;
  }
  function invalidate(message) {
    generation++;
    preview = null;
    byId("push-review").hidden = true;
    byId("push-ack").checked = false;
    text("push-result", "");
    if (message) text("push-progress", message);
    controls();
  }
  function ask(type) {
    return new Promise((resolve, reject) => {
      const requestId = "push-" + ++sequence;
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(Error("Selection scan timed out. Try again."));
      }, 60000);
      pending.set(requestId, { resolve, reject, timeout });
      parent.postMessage({ pluginMessage: { type, requestId } }, "*");
    });
  }
  async function service(path, body) {
    const response = await fetch(endpoint + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + byId("push-secret").value.trim(),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(
        result.error ?? result.message ?? "PR service rejected the request.",
      );
    return result;
  }
  async function run(action) {
    working = true;
    controls();
    try {
      await action();
    } catch (error) {
      text("push-progress", error.message);
    } finally {
      working = false;
      controls();
    }
  }
  function listItem(parent, value) {
    const p = document.createElement("p");
    p.textContent = value;
    parent.append(p);
    return p;
  }
  function renderReport(next) {
    report = next;
    sourceChoices = {};
    invalidate();
    const components = next.components ?? [];
    text(
      "push-selection",
      components.length
        ? [...new Set(components.map((c) => c.componentName))].join(", ")
        : "No mapped Fondue component selected.",
    );
    const issues = byId("push-issues");
    issues.replaceChildren();
    for (const issue of next.issues ?? []) listItem(issues, issue.message);
    for (const warning of next.warnings ?? []) listItem(issues, warning);
    const changes = byId("push-change-list");
    changes.replaceChildren();
    for (const change of next.changes ?? []) {
      const label = document.createElement("label");
      label.className = "push-change";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = true;
      input.dataset.changeId = change.id;
      input.addEventListener("change", () => invalidate());
      label.append(
        input,
        document.createTextNode(
          " " + change.componentName + " · " + change.property,
        ),
      );
      const detail = document.createElement("pre");
      detail.textContent =
        JSON.stringify(change.before) + " → " + JSON.stringify(change.after);
      label.append(detail);
      changes.append(label);
    }
    byId("push-changes").hidden = !(next.changes ?? []).length;
    byId("push-scope").hidden = !components.length;
    const tokens = byId("push-tokens");
    tokens.replaceChildren();
    for (const token of (next.tokens ?? []).filter((t) => !t.existing)) {
      const label = document.createElement("label");
      label.textContent =
        "Token for " +
        (token.name || token.provenance?.role || "changed value");
      const choice = document.createElement("select");
      choice.dataset.tokenChoiceId = token.id;
      const newOption = document.createElement("option");
      newOption.value = "";
      newOption.textContent = "Create a new token";
      choice.append(newOption);
      for (const existing of tokenCatalog.filter(
        (t) => t.type === token.type,
      )) {
        const option = document.createElement("option");
        option.value = existing.id;
        option.textContent = existing.id;
        choice.append(option);
      }
      const input = document.createElement("input");
      input.dataset.tokenId = token.id;
      input.setAttribute("aria-label", "New CSS token name");
      const role = token.provenance?.role;
      const property =
        next.changes.find((change) => change.tokenIds?.includes(token.id))
          ?.property ?? "";
      const prefix =
        token.type === "COLOR"
          ? "color"
          : role === "radius"
            ? "border-radius"
            : role === "typography"
              ? "typography-" +
                ({ lineHeight: "line-height", letterSpacing: "letter-spacing" }[
                  property
                ] || "font-size")
              : role || "size";
      input.value = (token.name || prefix + "-custom")
        .replace(/\//g, "-")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      choice.addEventListener("change", () => {
        input.hidden = !!choice.value;
        invalidate();
      });
      input.addEventListener("input", () => invalidate());
      label.append(choice, input);
      tokens.append(label);
    }
    text(
      "push-progress",
      next.changes?.length
        ? next.changes.length + " changes found in the selection."
        : "No changed properties found in the selection.",
    );
    controls();
  }
  function renderPreview(result) {
    preview = result;
    byId("push-review").hidden = false;
    text(
      "push-base",
      "Target: Frontify/fondue · base " + (result.baseSha ?? "").slice(0, 12),
    );
    text(
      "push-diff",
      result.diff || "No source diff available yet. Resolve the items below.",
    );
    const checks = byId("push-checks");
    checks.replaceChildren();
    for (const blocker of result.blockers ?? []) {
      listItem(checks, typeof blocker === "string" ? blocker : blocker.message);
      if (blocker.candidates?.length && blocker.changeId) {
        const label = document.createElement("label");
        label.textContent = "Source declaration to change";
        const select = document.createElement("select");
        select.dataset.mappingId = blocker.changeId;
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Choose the matching source declaration";
        select.append(empty);
        for (const candidate of blocker.candidates) {
          const option = document.createElement("option");
          option.value = candidate.id ?? candidate.candidateId ?? "";
          option.textContent =
            candidate.path +
            " · " +
            candidate.selector +
            " · " +
            candidate.property +
            ": " +
            candidate.expectedValue;
          select.append(option);
        }
        // Keep choices visible for the next preview while disabling creation.
        select.addEventListener("change", () => {
          if (select.value) sourceChoices[blocker.changeId] = select.value;
          else delete sourceChoices[blocker.changeId];
          generation++;
          preview = null;
          byId("push-ack").checked = false;
          controls();
        });
        label.append(select);
        checks.append(label);
      }
    }
    for (const warning of result.warnings ?? []) listItem(checks, warning);
    for (const check of result.checks ?? [])
      listItem(
        checks,
        typeof check === "string"
          ? check + ": pending"
          : (check.name ?? check.id) + ": " + check.status,
      );
    listItem(
      checks,
      "Browser accessibility and visual review must pass before merge. Creating a draft PR does not certify those checks.",
    );
    controls();
  }
  byId("push-scan").onclick = () =>
    run(async () => {
      text("push-progress", "Reading the selected object…");
      renderReport(await ask("push-scan"));
    });
  byId("push-connect").onclick = () =>
    run(async () => {
      const status = await service("/status");
      paired = true;
      text(
        "push-connection",
        "Connected · " + (status.repository ?? "Frontify/fondue"),
      );
      text(
        "push-progress",
        "PR service connected. Review your selection to continue.",
      );
    });
  byId("push-secret").addEventListener("input", () => {
    paired = false;
    invalidate();
  });
  for (const id of ["push-title", "push-description"])
    byId(id).addEventListener("input", () => invalidate());
  byId("push-ack").onchange = controls;
  byId("push-preview").onclick = () =>
    run(async () => {
      const selectedChangeIds = selectedIds(),
        tokenNames = names(),
        choices = mappingChoices();
      text(
        "push-progress",
        "Checking the selection and preparing the source diff…",
      );
      const current = await ask("push-scan");
      if (JSON.stringify(current) !== JSON.stringify(report)) {
        renderReport(current);
        throw Error(
          "The selection changed. Review the refreshed changes and preview again.",
        );
      }
      const revision = generation;
      const replacements = new Map(
        [...document.querySelectorAll("[data-token-choice-id]")]
          .filter((el) => el.value)
          .map((el) => [el.dataset.tokenChoiceId, el.value]),
      );
      const outgoing = {
        ...current,
        changes: current.changes.map((change) => {
          const chosen =
            change.tokenIds?.length === 1 &&
            replacements.get(change.tokenIds[0]);
          return chosen
            ? { ...change, after: { tokenId: chosen }, tokenIds: [chosen] }
            : change;
        }),
        tokens: [
          ...current.tokens.filter((token) => !replacements.has(token.id)),
          ...tokenCatalog
            .filter((token) => [...replacements.values()].includes(token.id))
            .map((token) => ({ ...token, existing: true })),
        ],
      };
      const result = await service("/preview", {
        report: outgoing,
        selectedChangeIds,
        title: byId("push-title").value.trim(),
        description: byId("push-description").value.trim(),
        tokenNames,
        mappingChoices: choices,
      });
      if (revision !== generation)
        throw Error(
          "The selection or proposal changed while preparing the diff. Preview again.",
        );
      renderPreview(result);
      text(
        "push-progress",
        result.blockers?.length
          ? "Resolve the source mapping or token issues, then preview again."
          : "Source diff ready for review.",
      );
    });
  byId("push-create").onclick = () =>
    run(async () => {
      const reviewed = preview,
        revision = generation;
      if (!reviewed || !byId("push-ack").checked)
        throw Error("Review the source diff first.");
      const current = await ask("push-scan");
      if (
        revision !== generation ||
        JSON.stringify(current) !== JSON.stringify(report)
      ) {
        renderReport(current);
        throw Error(
          "The selection changed. Preview the updated diff before creating a PR.",
        );
      }
      text("push-progress", "Creating the reviewed draft PR…");
      const result = await service("/pull-request", {
        previewId: reviewed.previewId,
        fingerprint: reviewed.fingerprint,
      });
      const url = result.url ?? result.pullRequest?.html_url ?? result.html_url;
      const target = byId("push-result");
      target.replaceChildren();
      if (
        url &&
        /^https:\/\/github\.com\/Frontify\/fondue\/pull\/\d+$/i.test(url)
      ) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open draft PR";
        target.append(link);
      } else
        target.textContent =
          "Draft PR created. Check the PR service for its link.";
      preview = null;
      text(
        "push-progress",
        "Draft PR created. Your sync baseline is preserved.",
      );
    });
  window.addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const message = event.data?.pluginMessage;
    if (!message) return;
    if (message.type === "status") tokenCatalog = message.tokenChoices ?? [];
    if (message.type === "push-invalidated") {
      report = null;
      invalidate(
        "Selection or document changed. Review the selected object again.",
      );
    }
    if (message.type === "push-report" || message.type === "push-error") {
      const request = pending.get(message.requestId);
      if (!request) return;
      clearTimeout(request.timeout);
      pending.delete(message.requestId);
      if (message.type === "push-error") request.reject(Error(message.message));
      else request.resolve(message.report);
    }
  });
  const tabs = [byId("sync-tab"), byId("push-tab")];
  function activate(tab) {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      byId(item.getAttribute("aria-controls")).hidden = !active;
    }
  }
  for (const tab of tabs) {
    tab.onclick = () => activate(tab);
    tab.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const target =
        event.key === "Home"
          ? tabs[0]
          : event.key === "End"
            ? tabs[1]
            : tabs[1 - tabs.indexOf(tab)];
      activate(target);
      target.focus();
    };
  }
  controls();
})();
