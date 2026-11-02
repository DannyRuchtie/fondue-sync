# Remaining gaps and acceptance boundaries

The generated [coverage report](coverage.json) is the exact inventory and source-profile contract. A catalog entry means a source-specific native representation exists; it does not certify every visible combination or runtime behavior.

## Released source data

- Three released SCSS color names are absent from committed token outputs. Browser verification proves their computed color inherits arbitrary ancestor color. No universal fixed value can be imported honestly. **27 reviewed profiles are excluded** (220 combinations in the larger Cartesian inventory); exact source lines and affected properties are in [source-token-defects.md](source-token-defects.md).
- The public `Heading` color `x-weak` has no matching released SCSS rule. It remains an inherited-color gap.
- All 2,099 released optical icon SVGs are included. `apps` has no 12px source asset. An unavailable/arbitrary requested size uses the explicitly reported 24px fallback; it is not represented as an authored optical drawing.

## Adapter coverage

- Finite reviewed profiles expose the source's visible enum values and meaningful coupled states. Several families deliberately use a subset of combinations. These are explicit profile limits rather than claims of an exhaustive Cartesian matrix; see [controls](control-coverage.json), [foundations](foundation-coverage.json) and [patterns](pattern-coverage.json).
- CSS layout features such as responsive rules, wrapping/grid algorithms, viewport collision and automatic placement need additional native adaptations or manual composition. Concrete source dimensions and sample layouts do not implement those browser algorithms.
- Charts include editable sample geometry and current design primitives. Arbitrary data transformations, stacking, treemap layout, pie layout, continuous gauge values and tooltip behavior are not a native data renderer.
- Published RTE representations include the editor surface and selected public chrome. Arbitrary Plate content, selection-dependent toolbars, embedded blocks and the full editor primitive surface are not fully represented.
- The report records 102 compound source symbols independently. It does not count a parent recipe as proof that every compound symbol has an independent native asset/property contract.

Text, Boolean visibility, icon swaps, exposed nested component properties and shared token/style bindings should be used before inventing additional visual permutations. Source-driven profile counts and native usability must be reviewed together.

## Native acceptance not yet performed

The user selected [PD Figma Sync](https://www.figma.com/design/O5xq8vIIlxUCYXscYcNVww/PD-Figma-Sync?node-id=0-1) for manual installation/testing in Figma desktop. No automated test-file team selection is needed. Native execution has not yet been reported back. A read-only MCP session attempt was rejected because the connected account lacks edit access; no automated generation ran. Desktop Figma may use a different account, and its permissions must be assessed there. The connected account has multiple possible teams. Both Full-seat choices are Starter teams: they are potential basic development-plugin test destinations, not proof of paid library publishing/consuming or remote write-to-canvas entitlement. An eligible intended Frontify workspace has not been verified, and the configured upstream token file lacks edit access. The existing upstream token file was not used as an output target. Consequently **native Plugin API execution, visual parity, runtime timing/memory, publication, and consumer-file update acceptance are not verified**.

The local model checks identity preservation, source updates, drift, properties, metadata, native instance selection and recovery. It cannot prove Figma's default/override propagation, published metadata visibility or library permissions. Follow [verification.md](verification.md) in a new file after the target team is chosen.

## Recovery boundary

Metadata entries use bounded chunks and generation commits. Completed assets can be compared and resumed without being duplicated. A recoverable construction exception has a regression-tested retry path. A hard process termination during canvas mutation can still leave a tracked asset that differs from its last committed baseline; the updater preserves it and requires review. Import/Update now require a named Figma version before sync starts, and stop if no saved version ID is returned. Recovery is manual through Version History; native restoration of nodes, variables, styles and managed metadata together remains unverified. Figma does not provide a transaction spanning canvas nodes, variables and document metadata. Do not treat an incomplete managed object as permission to delete or rebuild arbitrary content.
