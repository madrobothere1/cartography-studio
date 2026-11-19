# Toolcraft App Agent Worklog

## Status

Mode: product

Active change: carto-004

Cartography Studio is an experiment: a flat contour map with dot, line, plus and hachure patterns, and an animated network of nodes joined by lines. Entries carto-001 and carto-002 describe the earlier three-dimensional version; carto-003 supersedes their statements about orbit, relief, walls and depth. The first working version exists. The first-delivery gate (`npm run verify:delivery`) has not been run; see Risks.

## Decision Trail

### carto-001: first working version

- Change ID: carto-001
- Entry type: first delivery (in progress)
- Request: "Please setup a new folder in here to expriment using https://toolcraft.sh/. The target of the experiment should be 3d cartography with countour maps, dotted and line patterns and pixel art paths from point a to b."
- Task type: new Toolcraft app, custom WebGL renderer.
- User-visible result: an orbitable map block. Controls for terrain, contours, surface pattern, route and colors. PNG export.
- Source/reference checked: no visual reference supplied. `../contour-studio` (same Toolcraft version) was read for renderer and schema patterns.
- Docs/contracts read: `AGENTS.md`, `workflow.md`, `schema-reference.md`; the orbit sections of `component-rules.md` and `renderer-technique.md`; `vector-controls.md`. The remaining routed documents were not read in full.
- View interaction: `orbit`, target `view.orbit` (`orientationGizmo` plus `useToolcraftModelOrbitInteraction` with a hit test against the projected map block).
- Interaction ownership: none declared.
- Decision: one CPU heightfield (257 × 257) is the single source of height. It is uploaded as a float texture for the surface mesh and the contour shader, and it is searched on the CPU for the route.
- Alternatives rejected: Canvas 2D with projected contour polylines (no hidden-line removal under free orbit); height computed in the shader only (the route search could not read it); Vector pads for A and B (the pad must move the feature in the gesture direction on screen, which a rotated map breaks).
- State/output mapping: `terrain.*` rebuild the heightfield; `route.*` re-run the search on the pixel grid; `contours.*`, `pattern.*`, `ink.*` are shader uniforms; `view.orbit` and `view.fit` build the camera matrix. Preview and export use the same engine.
- Verification: `npm run ai:check` passed, `tsc --noEmit` passed, and the default composition was inspected in a browser at 1500 × 950. `npm run test` fails; see Risks.
- Risks: see Risks.

### carto-002: network replaces the pixel route

- Change ID: carto-002
- Entry type: focused
- Request: "I'd like you to change the path. Instead I'd like to have dots connected by the line and make variations of those. nodes should be rectangular or bracken or bracken around square and lines can be of different types. number of dots and connectedness of a graph is also a parameter."
- Changed owner: `src/app/carto/carto-graph.ts` (new), `carto-gl.ts`, `carto-shaders.ts`, `carto-values.ts`, the Network section in `carto-schema-sections.ts`. `carto-route.ts` and `carto-sprites.ts` were removed, with every `route.*` target.
- User-visible result: a seeded graph on the terrain. Node shapes: square, corner brackets, brackets around a square ("bracken" was read as "bracket"). Line styles: solid, dashed, dotted, double. Line paths: straight, elbow, arc. Node count, connectedness, layout seed, node size and line weight are sliders.
- Decision: links are screen-facing ribbons sampled along the terrain, drawn after the surface with a small depth bias and a surface-coloured casing; nodes are billboards sized in map units. Connectedness orders links as spanning tree first, then nearest-neighbour loops, and draws that share of the list.
- Verification: `npm run ai:check` passed, `tsc --noEmit` passed, `npm run build` passed; default plus five style combinations inspected in a browser, no page errors.
- Risks: route-era statements below about A and B no longer apply; the acceptance matrix is still unwritten.

### carto-003: flat map, new patterns, animated nodes

- Change ID: carto-003
- Entry type: focused
- Request: "Okay let's simplify it to 2D. Play around with the pattern. I think nothing really changes. Just add some animation to the dots and maybe make them a bit more refined, with thinner edges, and change the colour of the dots."
- Changed owner: every file in `src/app/carto`, `app-schema.ts` (`spatialViewModule()` removed), `app-acceptance-data.ts`.
- User-visible result: a top-down map with no orbit, relief or block walls. Pattern gains plus marks, hachures (strokes pointing downhill, longer on steep ground) and a grid angle. Nodes are thin-stroked (Node edge slider), have their own colour (`ink.node`, default #2447F9) and a motion: still, pulse, ping or spin, with a speed slider.
- View interaction: `fixed-camera`, authority is the request quote "Okay let's simplify it to 2D."
- Animation: autonomous loop, no timeline. Node motion redraws only a second, transparent network canvas; the map canvas redraws on setting changes. Motion pauses during viewport gestures and under `prefers-reduced-motion`. PNG export shows the first frame.
- Verification: `npm run ai:check`, `tsc --noEmit` and `npm run build` passed; default, hachure + pulse + brackets and plus + spin + square inspected in a browser; the network canvas changes between frames while moving and is static when still. `vitest run src/app`: the same seven acceptance-matrix, worklog-format, performance and starter-schema tests fail as before.
- Risks: elbow links have no join at the corner; the acceptance matrix is still unwritten.

### carto-004: level colours and per-level patterns

- Change ID: carto-004
- Entry type: focused
- Request: "I want more play with colors and patterns - like maybe different level could be of different color, and different pattern over the color. We don't need relief param, and set some default params to the nodes like 16 nodes, 0.6 connectedness, brackets, node size 0.015, line solid, line weight 0.6 and path straight."
- Changed owner: `carto-values.ts`, `carto-shaders.ts`, `carto-gl.ts`, `carto-schema-sections.ts` (new Level colors section), `app-acceptance-data.ts`.
- User-visible result: the map is coloured by elevation (off, bands, smooth) from low, middle and high colours with a band count; pattern mode "By level" gives each band the next pattern (dots, lines, plus marks, hachures) at a further-turned angle; "Tonal pattern" prints the pattern in a darker shade of the band colour. Node defaults: 16 nodes, connectedness 0.6, brackets, size 0.015, solid straight links of weight 0.6. Index contour default is every 3rd so heavy contours bound the six colour bands. Relief was already removed in carto-003.
- Verification: `npm run ai:check`, `tsc --noEmit`, `npm run build` passed; default composition inspected in a browser.
- Risks: bands line up with contours only when Levels is a multiple of Bands.

## Decisions

### Renderer

- Decision: raw WebGL2, two programs. The terrain program draws the surface grid and four walls; contours, patterns, the block outline and the route are computed in its fragment shader. The marker program draws two billboard pixel sprites.
- Reason: depth testing gives correct hidden lines at any orbit angle, and screen-space derivatives keep line weights constant under perspective.
- Evidence: `src/app/carto/carto-gl.ts`, `carto-shaders.ts`.

### View Interaction

- Decision: orbit through the runtime orientation gizmo and direct drag on the map block.
- Reason: a visible editable 3D scene defaults to orbit.
- Evidence: `view.orbit` in `carto-schema-sections.ts`; overlay canvas with `data-toolcraft-canvas-handle="map-orbit"` in `carto-renderer.tsx`.

### Interaction Ownership

- Decision: no canvas editing of the network; node positions come from the layout seed.
- Reason: simplest reachable control for an experiment.
- Evidence: Network section. Dragging nodes on the map is a candidate follow-up and would need an ownership entry.

### Timeline

- Decision: no timeline.
- Reason: the request describes a still map; no animation was asked for.
- Evidence: `animationIntent: { mode: "none" }`.

### Layers

- Decision: no layers.
- Reason: no layer workflow was requested.
- Evidence: `layersModule()` is absent.

### Controls

- Decision: seven sections: Background, View, Terrain, Contours, Pattern, Network, Colors.
- Reason: one section per drawn layer of the map, plus framing and palette.
- Evidence: `appControlSectionInventory` in `app-acceptance-data.ts`.

### Export

- Decision: PNG only, through `imageExportModule()` and one shared `rasterFrameRenderer`.
- Reason: image export is the default; SVG and video were not requested.
- Evidence: `carto-export.ts`.

### Performance

- Decision: not assessed. `app-performance.ts` is still the starter config.
- Reason: experiment stage.
- Evidence: none. Known costs: heightfield rebuild is 66 049 samples × up to 8 octaves; route search is Dijkstra over at most 128 × 128 cells; both are cached by settings key.

## Evidence

- Source reviewed: `../contour-studio/src/app/contour/*` for the engine, export and schema-section patterns.
- Contract applied: schema controls only, product output in `scene.canvasContent`, runtime-owned background and export.

## Verification

- `npm run ai:check`: passed (20 files).
- `tsc -p tsconfig.json --noEmit`: passed after pinning `csstype` to 3.2.3 through `overrides` in `package.json`; with 3.2.4 two framework timeline files fail to typecheck.
- Browser: default composition renders, no console errors apart from a missing favicon.
- `npm run test`: fails. See Risks.

## Risks

- Risk: the acceptance matrix is not written. `appAcceptance` has no rows for the product controls and there are no product Playwright specs, so acceptance-coverage tests fail and `npm run verify:delivery` has not been run.
- Risk: `app-performance.ts` does not declare the custom renderer, its pipeline or workload dimensions.
- Risk: no app cover (`app-cover.json`) exists yet.
- Risk: four of 1315 framework script tests fail. Two expect `pnpm` in command text while this folder was installed with npm; one is an Infinity-canvas evidence recipe test; one (`toolcraft-module-absence-inventory`) reports `old-product-definition` for `src/app/app-schema.ts` and is not diagnosed.
- Risk: dashed and dotted contours choose their dash axis per fragment, so dash length varies by up to about 40 % with contour direction.
