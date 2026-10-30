import { createHash } from "node:crypto";

export const REPOSITORY = "Frontify/fondue";
export function digest(value) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}
export function validPath(path) {
  return (
    typeof path === "string" &&
    !path.includes("\\") &&
    !path.split("/").some((part) => !part || part === "." || part === "..") &&
    (/^packages\/(components|tokens|charts|rte|rich-text-editor|fondue)\//.test(
      path,
    ) ||
      /^\.changeset\/[a-z0-9-]+\.md$/.test(path))
  );
}
export function createGitHubClient({
  token,
  fetchImpl = fetch,
  repository = REPOSITORY,
  base = "main",
}) {
  if (repository !== REPOSITORY)
    throw Error("Only Frontify/fondue is supported.");
  if (!token)
    throw Error(
      "Set FONDUE_GITHUB_TOKEN or GITHUB_TOKEN on the companion service.",
    );
  if (!/^[a-zA-Z0-9._/-]+$/.test(base) || base.includes(".."))
    throw Error("Invalid base branch.");
  const prefix = `https://api.github.com/repos/${repository}`;
  async function request(path, method = "GET", body, allow404 = false) {
    const response = await fetchImpl(prefix + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allow404 && response.status === 404) return null;
    if (!response.ok)
      throw Error(
        `GitHub ${method} ${path.split("?")[0]} failed (${response.status}).`,
      );
    return response.status === 204 ? null : response.json();
  }
  return {
    base,
    async head() {
      return (await request(`/git/ref/heads/${encodeURIComponent(base)}`))
        .object.sha;
    },
    async read(path, sha) {
      if (!validPath(path)) throw Error(`Disallowed path: ${path}`);
      const result = await request(
        `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(sha)}`,
        "GET",
        undefined,
        true,
      );
      if (!result) return null;
      if (result.type !== "file" || result.encoding !== "base64")
        throw Error(`Unsupported source file: ${path}`);
      return Buffer.from(result.content, "base64").toString("utf8");
    },
    async createDraft(review) {
      const branch = `fondue-sync/${review.fingerprint.slice(0, 24)}`;
      const existing = await request(
        `/pulls?head=Frontify:${encodeURIComponent(branch)}&base=${encodeURIComponent(base)}&state=open`,
      );
      const baseSha = await this.head();
      if (existing.length) {
        const comparison = await request(
          `/compare/${review.baseSha}...${encodeURIComponent(branch)}`,
        );
        const names = (comparison.files ?? [])
          .map((file) => file.filename)
          .sort();
        if (
          JSON.stringify(names) !==
          JSON.stringify(review.files.map((file) => file.path).sort())
        )
          throw Error(
            "Existing PR was changed externally. Review it in GitHub.",
          );
        for (const file of review.files)
          if ((await this.read(file.path, branch)) !== file.after)
            throw Error(
              "Existing PR was changed externally. Review it in GitHub.",
            );
        return {
          number: existing[0].number,
          url: existing[0].html_url,
          branch,
          reused: true,
        };
      }
      if (baseSha !== review.baseSha)
        throw Error("The target branch changed. Preview the proposal again.");
      for (const file of review.files) {
        if (!validPath(file.path)) throw Error(`Disallowed path: ${file.path}`);
        if ((await this.read(file.path, baseSha)) !== file.before)
          throw Error(
            `Source conflict in ${file.path}. Preview again against the current source.`,
          );
      }
      let ref = await request(
        `/git/ref/heads/${encodeURIComponent(branch)}`,
        "GET",
        undefined,
        true,
      );
      if (!ref) {
        const parent = await request(`/git/commits/${baseSha}`);
        const tree = [];
        for (const file of review.files) {
          const blob = await request("/git/blobs", "POST", {
            content: file.after,
            encoding: "utf-8",
          });
          tree.push({
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blob.sha,
          });
        }
        const result = await request("/git/trees", "POST", {
          base_tree: parent.tree.sha,
          tree,
        });
        const commit = await request("/git/commits", "POST", {
          message: review.title,
          tree: result.sha,
          parents: [baseSha],
        });
        ref = await request("/git/refs", "POST", {
          ref: `refs/heads/${branch}`,
          sha: commit.sha,
        });
      } else {
        // A failed PR request can leave the proposal branch behind. Only reuse an exact match.
        const branchCommit = await request(`/git/commits/${ref.object.sha}`);
        if (
          branchCommit.parents?.length !== 1 ||
          branchCommit.parents[0].sha !== baseSha
        )
          throw Error(
            "Proposal branch was changed externally. Create a new preview.",
          );
        const comparison = await request(
          `/compare/${baseSha}...${encodeURIComponent(branch)}`,
        );
        if (
          JSON.stringify(
            (comparison.files ?? []).map((file) => file.filename).sort(),
          ) !== JSON.stringify(review.files.map((file) => file.path).sort())
        )
          throw Error(
            "Proposal branch contains unexpected changes. Create a new preview.",
          );
        for (const file of review.files) {
          if ((await this.read(file.path, ref.object.sha)) !== file.after)
            throw Error(
              "Proposal branch was changed externally. Create a new preview.",
            );
        }
      }
      if ((await this.head()) !== baseSha)
        throw Error(
          "The target branch changed during submission. Preview again.",
        );
      const pr = await request("/pulls", "POST", {
        title: review.title,
        body: review.body,
        head: branch,
        base,
        draft: true,
        maintainer_can_modify: true,
      });
      return { number: pr.number, url: pr.html_url, branch, reused: false };
    },
  };
}
