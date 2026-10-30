// Reviewed brand adaptation over the pinned Fondue release, not an upstream change.
export const chartColorGuidelines =
  "https://weare.frontify.com/document/2906#/design/color";
export const chartColorAliases = {
  "color-charts-primary-default": ["color-marker-60", "color-marker-40"],
  "color-charts-primary-hover": ["color-marker-70", "color-marker-30"],
  "color-charts-secondary-default": ["color-neutral-80", "color-neutral-35"],
  "color-charts-secondary-hover": ["color-neutral-70", "color-neutral-25"],
  "color-charts-tertiary-default": ["color-neutral-60", "color-neutral-60"],
  "color-charts-tertiary-hover": ["color-neutral-50", "color-neutral-50"],
  "color-charts-missing-default": ["color-neutral-35", "color-neutral-70"],
  "color-charts-dim-default": ["color-neutral-05", "color-neutral-90"],
};
export function applyChartBrandColors(tokens) {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const set = (id, values) => {
    const token = byId.get(id);
    if (!token) throw Error(`Missing chart token ${id}`);
    token.values = values;
    token.provenance = {
      kind: "brand-adaptation",
      source: chartColorGuidelines,
    };
  };
  for (const [id, [light, dark]] of Object.entries(chartColorAliases)) {
    for (const target of [light, dark])
      if (!byId.has(target)) throw Error(`Missing brand primitive ${target}`);
    set(id, { Light: { alias: light }, Dark: { alias: dark } });
  }
  for (const role of ["primary", "secondary", "tertiary"]) {
    const [light, dark] = chartColorAliases[`color-charts-${role}-default`];
    const subtle = (id) => ({ ...byId.get(id).values.Value, a: 0.1 });
    set(`color-charts-${role}-subtle`, {
      Light: subtle(light),
      Dark: subtle(dark),
    });
  }
}
