# Independent implementation review

Review date: 2026-10-30. This is a second-pass review of the sync engine, Plugin API usage, snapshots, source definitions, UI and local evidence. The reviewer previously authored the bundle builder, foundations and example compositions; those areas are a self-review, while the engine was implemented by another contributor. No native Figma execution or publishing was performed by this review.

## Findings and disposition

### P1 — inherited instance rendering was mistaken for local drift

The original snapshot recursively serialized instance descendants, including inherited text, fills and geometry, while omitting the native main-component identity. A compatible update to a shared core component could change a pattern/example instance's inherited rendering and make the unchanged pattern appear locally edited. A visually equivalent swap could also escape detection.

**Addressed in this review:** `src/snapshot.ts` now uses an asynchronous native main-component lookup, direct `InstanceNode.overrides` fields and authored binding metadata. It omits inherited rendered descendants and normalizes computed Auto Layout size/position. Explicit text/fill/resize overrides, fixed layout dimensions, absolute positions and main-component swaps remain protected. Five model tests cover these distinctions. All engine snapshot call sites must await the new function.

The installed Plugin API typings describe `InstanceNode.overrides` as direct overrides only, excluding inherited overrides. Native confirmation of Figma's property-reference and override propagation remains necessary, particularly when a direct property value equals its old default and the source default subsequently changes. Model tests are not proof of that platform behavior.

### P1 — source field removals could leave stale native state

The original layer applier assigned several optional fields only when present. Removing a source data binding, stroke, variable binding, effect, style or positioning setting could leave the previous value behind while recording the target definition as applied. A successful final snapshot then proved only consistency with the stale state.

**Addressed and regression-tested:** source removal clears authored data-binding metadata, fills/strokes, numeric variable bindings, effects, opacity/radius and native text/effect style links while retaining managed layer identities. Two new engine tests cover those cases and pass. Specialized text decoration, explicit stroke weight and arc geometry removals now reset to native defaults and pass their targeted regression test.

### P1 — interrupted icon shells were not retryable

Icons were checkpointed before SVG construction. A failed initial SVG construction left a managed pending icon. Subsequent inspection treated it as a normal icon update and required migration, so retry could not finish the initial shell without manual intervention.

**Addressed for recoverable construction failure:** pending icons with unchanged source SVG now resume construction in the existing component shell. A new regression simulates SVG construction throwing once, reopens the engine, completes the same shell with one vector tree and verifies another sync creates no duplicate nodes. Hard process interruption at an arbitrary point remains a separate native acceptance case; recovery must remain conservative rather than treating every incomplete visual state as safe to replace.

### P1/P2 — exposed text defaults need a dedicated update test

The reviewed text-property branch created a TEXT property once and reused its key during later source updates. It did not explicitly edit the existing property definition's default value. A source text change can therefore leave a stale exposed default even when the visible main text is patched. This matters to new native instances and to default property values consumed by the example renderer.

**Addressed and regression-tested:** the engine updates a reused TEXT property default once per set/path during each sync, using the first source variant rather than repeatedly replacing it with later variants. A new regression verifies the new source default on a newly created instance, preserves an existing explicit consumer text override and stops on a locally edited property default. Native per-variant default and override propagation still require runtime confirmation.

### P2 — Validate and UI counts overstated their meaning

The reviewed UI labeled split recipe sets as families. The original Validate handler inspected the ledger without running the bundle dependency preflight.

**Addressed by engine/UI owner:** the count now says component sets, and Compare/Validate runs `bundleProblems` before returning a successful status. Public family counts remain separate in the generated coverage report. Native, visual and publication acceptance remain explicitly separate from these structural checks.

## Source-fidelity spot checks

- Text: released body sizes 12/13/14/16px, line heights 16/16/18/20px, weights 400/500/700, seven direct colors and six `boxColor` precedence mappings match the source SCSS.
- Heading: source sizes and line heights match the finite recipes. Public `x-weak` has no matching released CSS rule; its inherited color remains explicitly partial.
- Divider: medium margin is **28px**, not spacing-medium's 16px. The recipes retain the 4px dash / 3px gap source pattern and separate semantic line colors.
- LoadingCircle: finite sizes 12/16/20/32/64px and the 2px ring are represented natively. Its animation is explicitly a runtime exclusion.
- Button: source references to absent released CSS color variables are recorded as source defects rather than replaced with invented token values. Those exact states remain explicit gaps.
- Arbitrary CSS layout values, wrapping/grid algorithms, responsive behavior, data-driven charts and rich-text runtime semantics remain partial. Catalog inventory and finite variant coverage do not establish complete visual parity.

## Scale and usability evidence

A local model measurement of the reviewed on-disk bundle found **10,579,626 bytes, 202 native sets, 1,992 variants and 10,346 authored recipe-layer definitions**. It excluded child expansion from cloned native instances and documentation nodes. The largest canonical recipe was 96,624 bytes, and each set was capped at 30 variants.

On this machine, one Node run measured approximately 17ms JSON read/parse, 8ms dependency preflight and 15ms recipe canonicalization. These are local JavaScript model costs. They are **not Figma import timings**, memory measurements, usability acceptance or publication evidence. Measured bundle fingerprint: `6462e21d8fd2dd61015e0a151487dfafcfcb2c6def15a6987259fa7330b5c1cd`. Later code/provenance edits can change the fingerprint; the generated `docs/coverage.json` remains authoritative for the delivered artifact.

The full importer creates more nodes than the authored recipe-layer count because of variants, component sets, icon vectors, cloned instances and documentation. Native test acceptance must measure actual created counts, elapsed import/update time, file usability and library browsing. Source-descriptive set names improve browsing over opaque ordinal names, but hundreds of sets still warrant a native consumer review. Do not call the library production ready solely because the local model completes.

## Verification performed during this review

- Installed `@figma/plugin-typings` inspected for async main-component access, direct override semantics, style/property APIs and plugin-data entry limits.
- TypeScript typecheck passed after the asynchronous snapshot change and engine call-site conversion.
- Five new snapshot model tests passed.
- Final re-review: TypeScript typecheck passed and **80 of 80 local tests passed**, including four new engine regressions. The initial mock `setEffectStyleIdAsync` omission was fixed. The complete suite, including the released import/repeat engine model, passed; its timing remains mock execution, not Figma performance.
- Example contract tests validate synthetic fixture ownership and actual component-variant selection. Native prototype execution remains unimplemented.

The remaining native Figma/runtime/publication limitations are deliberate acceptance boundaries, not completed verification. Re-run the full check after any final fixes and retain those boundaries in delivery notes.


## Final storage and recovery review

The delivered icon definitions now include all **2,099 exact optical SVG assets** within 420 families. The strict API model created 21,449 scene/metadata objects and tracked 1,244 managed assets. Those counts include optical icon variants and modeled instance expansion, rather than just authored recipe layers.

The final storage design uses integrity-checked immutable generation chunks for large records and one atomic inline head for small records. Each chunk is bounded to 24,000 UTF-8 bytes; unchanged values cause no writes. The root ledger has a schema-2 header and 16 deterministic asset shards. Its constructor requires every referenced shard. Legacy flat schema-1 ledgers migrate before canvas allocation, and checkpoints persist allocated identities before awaiting native snapshot work. Snapshot metadata uses the same validated reader.

The strict model recorded **34,921 native metadata writes / 51,437,270 bytes** on first import and **zero metadata writes on repeated sync**. The maximum single namespace+key+value write was 24,055 bytes, below Figma's 100,000-byte entry limit. The assembled asset index was 78,515 bytes, the largest shard 5,902 bytes, and the largest logical applied record 409,812 bytes; large logical records are chunked. See `metadata-capacity.json` for the generated evidence. These are modeled API counts and byte measurements, not native import timings or memory measurements.

**Recovery boundary:** metadata commitment is atomic per record, not across all canvas objects, the header and its shards. Initial creation still has a native-allocation-to-identity-save boundary. A process death or failed storage write at that exact point can leave an unindexed orphan page, collection or asset. Arbitrary hard interruption and concurrent writers therefore require conservative manual inspection; this implementation does not claim a global transaction or automatic recovery at every possible interruption point. Covered retries include committed pending shells, failed SVG construction, partial metadata writes and reopening valid sharded ledgers. Native Figma import, override propagation, visual review and publishing remain pending acceptance in an authorized workspace.
