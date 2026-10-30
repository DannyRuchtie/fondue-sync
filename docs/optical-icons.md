# Released optical icon assets

The 13.11.1 source contains **420 public outline/filled icon families** and **2,099 optical SVG assets**. These are independently authored source paths at 12, 16, 20, 24 and 32px, rather than one 24px path scaled to every size.

Each bundle icon retains its stable `id`, `name`, canonical 24px `svg` and `source`. Its `sizes` array adds the exact available optical definitions:

```json
{
  "id": "icon:check-mark",
  "sizes": [
    {"size": 12, "svg": "<svg …>", "source": "packages/icons/icons/check-mark/check-mark-12.svg"},
    {"size": 16, "svg": "<svg …>", "source": "packages/icons/icons/check-mark/check-mark-16.svg"}
  ]
}
```

The example omits the remaining entries for brevity. All stored SVG strings are verified against the source-input SHA256 recorded in provenance. The builder rejects a source SVG that cannot be associated with a public canonical family, so a successful build accounts for every current source SVG.

The source `apps` family has 16/20/24/32px assets and **no 12px asset**. The importer must retain that distinction; a fallback at a requested unavailable size is not an exact optical source definition. Arbitrary geometry such as a 40px content slot may use a documented source-size fallback and resize it, but must not claim that the repository supplied a 40px optical asset.

Native Figma import and visual comparison remain separate acceptance steps. Counts and source hashes prove source completeness; they do not establish that the runtime importer selected the intended variant or that publication/consumer acceptance succeeded.
