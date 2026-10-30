# Source color and effect bindings

`recipes/paint-bindings.mjs` augments the reviewed release bundle before fingerprinting. It preserves existing semantic color bindings, maps remaining design literals only to **exact** primitive values and assigns native effect styles from released source. It does not use nearest-color or nearest-number matching.

The canonical token shadows retain their original semantic shadow color. The component utility `shadow-md` and `shadow-lg` have different literal colors (`rgba(8,8,8,.15)` and `.2`), so they receive separate source-derived native styles and primitives. Their source is `packages/components/src/utilities/shadow.module.scss`. The standard focus outline and Card's 4px focus outline receive their own exact styles from the corresponding released SCSS. Every style effect's color, radius, spread and X/Y offsets has a typed variable binding. Numeric variables use `EFFECT_FLOAT`; effect color variables include `EFFECT_COLOR`.

Source-derived constants are native library definitions, not newly invented upstream CSS tokens. Their WEB syntax records the original literal value and their provenance identifies the exact released source file and role. Existing token-owned colors continue to alias their original semantic variables and preserve modes.

SVG paint rules bind chart segments to their source chart semantic colors and the Textarea resize mask to `color-line-mid`. The stored SVG markup and vector geometry remain unchanged. `svgFillNone` tells the renderer to clear the resize path's accidental implicit fill in place; SVG container frames are transparent. Exact optical icon assets use primary text as the default `currentColor` role, while consuming instances can select another source color.

Fixture artwork and ColorPicker data gradients remain content values. They are explicitly distinguished in the coverage report rather than falsely assigned a design-system semantic role. ColorPicker's fixed white selection outline can still use the exact white primitive. Unmatched design literals, unsupported composites or missing source roles are reported as exceptions; none are silently approximated.

`color-effect-binding-coverage.json` records the generated binding rules, derived definitions and explicit content exceptions. Model tests verify exact values, roles, source paths, immutable SVG bytes and the absence of nearest-value substitutions. A generated rule is not native acceptance evidence: the renderer must apply it and the resulting Figma file must be audited after sync.
