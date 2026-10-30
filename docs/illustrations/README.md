# README illustrations

These conceptual illustrations explain the repository-to-library workflow, its manual update boundaries and explicitly planned future paths. They are not screenshots or evidence of Figma runtime acceptance.

## Assets

- `repository-to-figma.png`: released source → bundled definitions → native Figma library → connected design projects.
- `repository-to-figma-roadmap.png`: the README overview, extending the original with dashed future paths from design projects to exported/published high-fidelity prototypes using Fondue modules and real-time API data, and from library edits through a proposed PR back to Fondue.
- `release-update-flow.png`: rebuild → compare/update/review → publish → designer acceptance.

The assets were generated with the built-in image-generation tool on 2026-10-30 and visually reviewed for label accuracy, direction, readability and consistency with [the architecture](../architecture.md). The original overview is retained; the roadmap was edited from it using the same tool. Their white backgrounds are intentional.

## Direction and source

Martin's [concept-visuals](https://github.com/mkovacovsky-frontify/concept-visuals/tree/671cf2adf2c7581476c23d2ad99d0606322475ae) informed the conceptual structure: one point per visual, short labels, attached directional connections and explicit human decisions. The repository is a tool-neutral Claude skill; it does not contain a fixed perspective line-art renderer, image examples or an illustration preset. The isometric line-art treatment follows the user's requested visual direction. The latest roadmap adds a pink accent for real Fondue code imports. Its prompt uses `#F14394`, found in a Fondue Badge story; this is a source-example color reference, not a verified brand-pink token.

The diagrams summarize these separate boundaries:

1. The released upstream Fondue source and this repository's reviewed recipes are packaged into a bundle.
2. A maintainer runs the plugin in the dedicated library file.
3. The maintainer reviews and publishes in Figma.
4. A designer enables the library or accepts updates in a consumer file.

Solid black arrows show the current library workflow. The pink dashed package-to-prototype path shows actual released `@frontify/fondue` code components used to recreate the design project. Composition, code components and API data are three distinct inputs to the future running prototype. Dashed grey arrows in the roadmap show planned prototype export/publication, a real-time API feeding the running prototype, and a proposed PR return loop originating in the Figma library. Consumer design projects do not originate the PR loop. The API supplies runtime data and does not define library assets. PRs require review and merge before a later release re-enters the current workflow. No live repository polling, automatic library publishing, forced consumer acceptance, implemented prototype export or implemented reverse code sync is implied. A check mark represents the indicated review/publication step, not full production acceptance. Compatible updates preserve supported identities; arbitrary structural changes may need migration.

## Generation prompts

### Real Fondue components edit (current)

Input/output: `repository-to-figma-roadmap.png`, edited using the built-in image-generation tool. Visually reviewed for the three prototype inputs and the library-origin PR loop.

```text
Edit the supplied Fondue Sync roadmap illustration, retaining its existing black isometric line art, white background, current four stations and arrows, grey dashed library-origin PR loop, grey dashed design-project-to-prototype "Export + publish" path, and grey dashed API-to-prototype real-time-data connection. Preserve those meanings and labels. Expand or reflow canvas to allow generous spacing if necessary.

Main correction: clearly show that exporting a Figma design project rebuilds it using ACTUAL FONDUE CODE COMPONENTS. The native Figma shapes supply design intent, but the running prototype uses real Fondue React modules. Add a separate visible source-to-runtime component path in vivid Fondue-style pink #F14394, with dashed arrows since prototype export is future scope.

At the top-middle of the illustration add a small isometric group of three code-module blocks, one with a code-brace mark, one with a button and one with an input. Use pink outlines and minimal pale pink detail. Label it "Fondue code components" in pink and below that "@frontify/fondue". Route a PINK DASHED arrow FROM the existing Fondue repository stack UP to these modules, labeled "Released package". Route a second PINK DASHED arrow FROM these modules across to the existing high-fidelity prototype browser, labeled "Import real components". These two arrows must visibly attach to their respective source/target objects. No arrow from code components into the Figma library or design projects. Do not conflate the release-bundle-to-Figma-library path with code imports.

The prototype must have THREE distinct inputs: (1) design projects via grey dashed "Export + publish" supplying screen composition, (2) actual released Fondue code components via pink dashed "Import real components", (3) API via grey dashed arrow supplying "Future · Real-time data". Give the browser output a simple visible button and input alongside its play marker, with only these component outlines pink to reinforce that they use the same real components as the pink modules. This is a high-fidelity running prototype, not an image export.

Keep labels "High-fidelity prototypes" and "Future · Fondue modules". Preserve library → proposed PR → repository return path, labelled "Library edits", "Proposed PR", "Future · Review + merge". No PR path from design projects. Preserve repository→release bundle→Figma library→design projects solid current flow. Keep the legend "Solid: current workflow" and "Dashed: planned", add a small pink legend entry "Pink: real Fondue code". All text horizontal clean sans serif, large enough to read. Avoid overlap of routes, text and objects. Pink is used ONLY for released real-code supply and corresponding rendered prototype components; all other current elements black, future elements neutral grey. Clean architectural diagram, no shadows or gradients or additional decoration.
```

### Roadmap overview edit

Output: `repository-to-figma-roadmap.png`. Edited from the preceding roadmap with the built-in image-generation tool. The final revision moves the PR origin to the library and adds the future runtime API connection.

```text
Edit the supplied Fondue Sync roadmap image, preserving its crisp black isometric line-art style, pure white background, horizontal typography, current four stations, all solid black current-flow arrows, and its future grey prototype output.

Make precisely these conceptual corrections, reflowing the canvas if needed for readable spacing:

1. The future PR return loop MUST originate from the bottom of the "Figma library" stack, NOT from "Design projects". Delete the entire dashed descending connector below Design projects and its "Figma edits" label. Start a dotted/dashed medium-grey line at the bottom of the Figma library stack, routed down beneath the existing current flow and then LEFT through a small isometric diff sheet labeled "Proposed PR", secondary label "Future · Review + merge", continuing left and up to an arrowhead at the Fondue repository. Put the readable label "Library edits" by the start near Figma library. Move the PR sheet leftward if necessary so it fits between the library's downward line and the repository return. Direction must be library → proposed PR → repository. There must be NO return PR line originating at or touching Design projects.

2. Keep the planned "Export + publish" dashed arrow from Design projects to "High-fidelity prototypes", secondary label "Future · Fondue modules". Add a distinct grey isometric API/server icon BELOW the prototype in the now-free lower-right area, labeled "API", secondary label "Future · Real-time data". Connect this API icon directly TO the prototype browser screen with a dotted/dashed grey upward arrow, indicating that the published running prototype pulls real-time data from an API. This API is a runtime data source, not a source for library definitions; no API line to repository, bundle, library or design projects. Give the API and connecting arrow plenty of space, don't overlap other objects or labels. All future connectors, including both the PR loop and API connection, use the same dotted/dashed grey line treatment.

Retain current labels: "Fondue repository", "Source of truth", "Release bundle", "Pinned source + recipes", "Figma library", "Run Fondue Sync", "Import / update", "Publish + enable", "Design projects", "Connected instances". Retain the key "Solid: current workflow" and "Dashed: planned". Keep future labels readable medium grey with lighter grey objects, current flow black. No extra body copy, no colors, gradients or shadows. The result should clearly show that library changes propose code PRs, while design projects export into future published real Fondue prototypes with live API data.
```

### Repository to Figma

```text
Use case: infographic-diagram
Asset type: wide GitHub README explanatory illustration, landscape 3:2, high resolution.
Primary request: Explain Fondue Sync as a repository-defined design system becoming native Figma assets and connected product designs.
Style/medium: exceptionally clean architectural isometric line art, thin precise black ink outlines on pure white, parallel perspective at consistent 30-degree angles, no vanishing point. White surfaces, sparse pale grey secondary edges, no colored fills, no gradients, no photorealism, no shadows, no decorative objects. Technical editorial illustration, elegant and restrained. Objects in perspective but ALL labels upright horizontal black sans serif, large, perfectly legible. No overall title.
Composition: a spacious single left-to-right flow occupying the canvas with generous safe margins, four distinct stations. Only three large arrows, each pointing from one station to the next, so direction is unmistakable.
Station 1 on left: a small isometric layered repository stack, top sheet has tiny code braces, a token swatch row and three geometric icons. Label ABOVE verbatim "Fondue repository"; smaller line BELOW verbatim "Source of truth".
Station 2 left-center: small isometric package cube with a simple JSON braces mark on its face. Label ABOVE verbatim "Release bundle"; line BELOW verbatim "Pinned source + recipes".
Station 3 right-center: the largest assembly, an isometric exploded stack of three native design-system sheets: bottom foundation sheet with simple token circles and type glyph A, middle sheet with a button and input, top sheet with a composed component pattern. Connect the stacked sheets with short vertical dotted guide lines to show construction. Label ABOVE verbatim "Figma library"; line BELOW verbatim "Run Fondue Sync". The arrow from station 2 to station 3 is labeled "Import / update".
Station 4 on right: two isometric product screen sheets arranged as a small fan, composed using the SAME small button and input shapes shown at station 3, with a fine connector from library stack to these sheets. Label ABOVE verbatim "Design projects"; line BELOW verbatim "Connected instances". The arrow from station 3 to station 4 is labeled "Publish + enable".
Constraints: Show repository -> bundle -> Figma library -> design projects only. No reverse arrows, no live server, no autonomous background sync, no code-export implication. Visuals are conceptual, not actual UI screenshots. No invented logos or Figma brand mark. Exact labels only as given; no extra body copy. Ensure no overlap between labels, arrows or objects. The four stations must have enough space and have consistent illustration scale.
```

### Release update flow

```text
Use case: infographic-diagram
Asset type: companion wide GitHub README illustration for Fondue Sync release updates, landscape 3:2 high resolution.
Primary request: illustrate the manual path by which a new repository release becomes updated components in designers' existing Figma projects. One clear left-to-right path, four stations, no loop.
Style: crisp architectural isometric line art, consistent parallel 30-degree perspective, thin black ink on pure white with sparse pale grey secondary edges. White unfilled surfaces, no gradients, no color, no photorealism, no shadows. Spacious, restrained technical editorial illustration. All text must remain horizontal and upright, clean black sans serif, readable large labels, no overall title.
Layout: four evenly spaced stations, joined by exactly three prominent outlined right-pointing arrows. Align primary objects on one horizontal baseline. Above each object its main label; below it its action label. Preserve generous outer margins.
Station 1: an isometric code-repository stack next to a compact package cube with braces, a new top sheet visibly added. Main label exactly "New release". Action label exactly "Rebuild bundle + plugin".
Station 2: exploded isometric Figma component stack with simple button and input and small check mark. Make one button visibly change by using a second outline offset behind it, representing compatible in-place update. Main label exactly "Sync library". Action label exactly "Compare → Update library". Tiny secondary label below exactly "Validate + visually review".
Station 3: two isometric library sheets with a small publication check stamp. Main label exactly "Publish in Figma". Action label exactly "Maintainer publishes".
Station 4: two upright isometric product screen planes with the same button and input as station 2. A small connected-chain symbol near the button indicates an instance link. Main label exactly "Update projects". Action label exactly "Designer accepts updates".
Constraints: no reverse arrows, no automatic updates, no live polling, no code generation, no check mark meaning full production readiness. Existing native instances remain visibly connected to the library. Do not add extra text, steps or logos. Keep labels and arrows separate with no overlap. This is a conceptual illustration, not an actual UI screenshot. Match an illustration vocabulary of repository sheet stacks, simple JSON package cubes, exploded design-system sheets and upright isometric product screen sheets.
```
