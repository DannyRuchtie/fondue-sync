# Verification and release acceptance

Local checks establish bundle integrity and implemented sync behavior. A Figma runtime run establishes native API behavior. A publication/consumer run establishes that designers can use the result as a shared library. Keep these evidence levels separate.

## Local verification

Run from the repository root:

```sh
npm ci
# Prepare the pinned source cache once before bundle regeneration:
node scripts/prepare-source.mjs
npm run verify
```

Review the generated bundle and `docs/coverage.json` after generation. Check that:

- The release tag, source commit and provenance match the intended released snapshot.
- Input hashes and bundle fingerprints are deterministic on a second generation.
- Public current exports are reconciled with metadata, including Card.
- Providers are mapped as nonvisual; legacy and the private rich-text revamp are excluded.
- Token aliases resolve, source modes are preserved and numeric conversion is explicit.
- Every represented recipe has source paths, stable IDs and honest limitations.
- Every missing or partial representation appears in the coverage report.

Sync tests should exercise first import, repeated import without duplication, compatible updates, local-drift detection, preservation of unchanged managed identities, and retained removals. Passing tests cover their modeled behavior; they do not replace native Figma execution.

## Native Figma acceptance checklist

Use a **new dedicated Figma Design test file**. Do not use the upstream token-authoring file. Record the file URL, account/workspace permissions, plugin commit, bundle fingerprint and time of testing.

1. Build and import `dist/manifest.json` in Figma desktop.
2. Run Import Fondue. Record generated collection, variable, style, icon, component-set and variant counts, plus every warning or error.
3. Inspect variable values and alias targets in both supported light/dark modes. Check spacing/radius values against their CSS units.
4. Inspect text and effect styles, including actual loaded fonts. A fallback warning requires explicit typography review.
5. Confirm each component family has one native Section containing all of its profile sets and the matching usage guides beside them. Confirm example screens each have their own section and source-backed caption, and icons share an Icons section. Re-run organization and confirm the section, main-component, variant, guide, instance and child IDs are unchanged.
6. Inspect icon vectors at their intended size. Verify that components are native assets rather than image captures.
7. Visually compare each recipe family and its represented states with the released source/stories. Check text clipping, Auto Layout, fill/stroke bindings, contrast, property semantics and variant arrangement.
8. Run Validate and inspect any gap/partial status. Resolve failures or record the exact accepted limitations.
9. Run Import/Compare again without edits. Confirm no duplicate managed assets and no unexpected differences.
10. Make a small local edit to a managed definition. Run Compare and Update. Confirm drift is reported and the local edit is preserved.
11. In a disposable test bundle, change a supported definition while keeping stable identities. Apply an update and confirm in-place IDs and supported instance overrides survive.
12. Remove a definition in the disposable bundle. Confirm it is retained and reported for migration.
13. Close and reopen the plugin. Confirm the ledger can resume and compare the same file correctly.

A preview screenshot is useful for appearance but cannot prove bindings, identity preservation or update correctness. Capture those structural results separately.

## Version-history recovery acceptance

Before production use, test the following in a disposable file using the intended workspace:

1. Wait for the file to finish saving. Run Import/Update and confirm the named **Before Fondue** version appears before sync changes.
2. Confirm a rejected save or missing version ID prevents sync from starting (covered locally by checkpoint tests; verify applicable native failure conditions).
3. Interrupt a sync after it has made partial changes. Close the plugin and restore its checkpoint through Figma Version History.
4. Verify pre-operation nodes, variables, aliases/modes, shared styles, component/child identities, instance overrides and the complete shared-plugin-data ledger are restored consistently. Reopen the plugin and Compare; no stale post-checkpoint ledger may remain.
5. Retry the operation and check for duplicates and unexpected drift.
6. Confirm collaborators understand that restoration affects the entire file. Published library versions and consumer files require separate recovery review.

The plugin waits one second before requesting a version and awaits a nonempty version ID before invoking sync. This follows Figma's timing guidance but does not verify checkpoint completeness. Neither local mocks nor a successful version ID prove native restoration or coverage of unsynced edits. Record this acceptance separately; it has not yet been performed.

## Publication and consumer acceptance

This step needs the intended eligible workspace where the account can publish and consume the library. A successful local development-plugin run in a personal Starter file does not establish these permissions or entitlements, or remote write-to-canvas access. Verify the Frontify workspace independently.

1. Publish the reviewed test library through Figma's normal publishing UI.
2. Open a second Design file and enable the published library.
3. Place native instances, change exposed variants/properties, and add supported overrides.
4. Apply a compatible managed update in the source file, validate it and publish again.
5. In the consumer file, review and accept that library update.
6. Confirm instance connections, supported overrides and the expected visual changes remain correct.

Do not report this as verified if account access or plan restrictions prevent it. Record the exact missing capability and the successful checks completed before it.

## Evidence record

For each delivery, record:

| Evidence | Result to record |
| --- | --- |
| Source | Release/tag, commit, provenance hashes |
| Generation | Commands, deterministic comparison result, coverage totals |
| Type checking/build | Exact commands and pass/fail |
| Sync tests | Cases executed and pass/fail |
| Native runtime | File link, actual imported counts, API errors/warnings |
| Visual review | Families/states reviewed and unresolved parity gaps |
| Publication/consumer | Published version, acceptance result, retained override evidence |

An unexecuted check should say **not run** and why. Do not use a passing build as evidence that a library was published or that physical consumer instances retained overrides.
