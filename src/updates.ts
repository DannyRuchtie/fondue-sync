export type UpdateResult = {
  name: string;
  current: string;
  latest?: string;
  state: "current" | "available" | "unavailable";
  url: string;
};

// Only stable releases are eligible; compare numeric parts, never strings.
export function stableVersion(value: unknown): number[] | null {
  if (typeof value !== "string") return null;
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 4).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function isNewer(latest: unknown, current: string): boolean {
  const a = stableVersion(latest);
  const b = stableVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export async function checkUpdates(
  pluginVersion: string,
  fondueVersion: string,
  request: typeof fetch = fetch,
): Promise<UpdateResult[]> {
  const targets = [
    {
      name: "Fondue Sync",
      current: pluginVersion,
      endpoint:
        "https://api.github.com/repos/DannyRuchtie/fondue-sync/releases/latest",
      url: "https://github.com/DannyRuchtie/fondue-sync/releases/latest",
      version: (data: any) =>
        data.draft === false && data.prerelease === false
          ? data.tag_name
          : null,
    },
    {
      name: "Fondue",
      current: fondueVersion,
      endpoint: "https://registry.npmjs.org/@frontify%2Ffondue/latest",
      url: "https://github.com/Frontify/fondue/releases",
      version: (data: any) =>
        data.name === "@frontify/fondue" ? data.version : null,
    },
  ];
  return Promise.all(
    targets.map(async (target): Promise<UpdateResult> => {
      const result: UpdateResult = {
        name: target.name,
        current: target.current,
        state: "unavailable",
        url: target.url,
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await request(target.endpoint, {
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
        });
        if (!response.ok) return result;
        const latest = target.version(await response.json());
        if (!stableVersion(latest) || !stableVersion(target.current))
          return result;
        return {
          ...result,
          latest,
          state: isNewer(latest, target.current) ? "available" : "current",
        };
      } catch {
        return result;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}
