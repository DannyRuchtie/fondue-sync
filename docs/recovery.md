# Recovering a caught initial import failure

A library that failed during construction may contain native component sets with one incomplete variant. A component name such as `navigation`, `Default` or `State=Default` is not a reliable completion or ownership signal. Fondue Sync's shared stable variant and layer identities are authoritative.

`src/recovery.ts` provides a read-only recovery decision. It accepts only a saved **pending initial** record whose actual snapshot still matches the recorded partial state. It validates that existing native variant/layer IDs form a compatible, tagged subset of the intended recipe. A tagged empty seed component may be completed. Unknown or duplicate tags, unowned children, missing assets/baselines, a changed source release and local drift block automatic recovery. No node is deleted or adopted by this helper.

A renderer fix should resume an eligible partial import in place. The existing set, variant and created child IDs should remain stable. The helper returns those IDs as evidence; the engine still owns the actual construction and final validation. Fully applied assets remain on the ordinary three-way update and migration path.

The original error must be diagnosed before retrying. A partial-tree recovery decision does not establish that fonts, API calls, variable bindings or native property references are valid. Repeatedly retrying an unchanged fatal renderer error only reproduces the failure.

Two baseline details matter:

- The first shell baseline can have `pending: true` and an empty variant list. After a caught failure, the baseline may instead contain the complete target recipe marked pending while the native tree is only partially built. Comparing that full imaginary tree against a renderer fix may incorrectly demand migration for a layer that was never created. A pending repair should validate the actual partial tree as a subset, while retaining the saved-snapshot drift guard.
- If the actual native snapshot changes after the caught failure, the plugin cannot safely distinguish a local designer edit from deferred platform layout or a separate writer. Preserve the file and review the difference; do not force the baseline to match the current canvas automatically.

This helper does not recover arbitrary hard process termination, unindexed allocations, missing metadata or a failed root-ledger commitment. Those cases remain manual inspection boundaries. Native runtime testing is required to establish that a repaired import has usable linked components; model-only recovery tests cannot prove that result.
