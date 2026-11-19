import type {
  ToolcraftComponentAcceptance,
  ToolcraftControlSectionInventoryEntry,
  ToolcraftProductReadiness,
  ToolcraftTransferMode,
} from "./acceptance/types";
import { appSchema } from "./app-schema";

const starterPersistenceSlices =
  appSchema.persistence.storage === "localStorage"
    ? appSchema.persistence.include
    : [];

export const appTransferMode: ToolcraftTransferMode = {
  animationIntent: {
    behaviorCoverage: [
      "no-user-facing-transport",
      "no-play-pause",
      "no-scrub",
      "no-duration-control",
      "no-loop-control",
      "no-export-at-time",
    ],
    mode: "autonomous",
    reason:
      "Node motion is a decorative self-running loop on the network layer; there is no video export and stills show the first frame.",
  },
  mode: "new-toolcraft-app",
  referenceInputs: [],
};

export const appProductReadiness: ToolcraftProductReadiness = {
  exportIntent: {
    image: { mode: "toolcraft-default" },
    svg: { mode: "not-requested" },
    video: { mode: "not-requested" },
  },
  interactionOwnership: [],
  mode: "product",
  productName: "Cartography Studio",
  productSummary:
    "A flat contour map with dot, line and hachure patterns, and an animated network of nodes joined by lines.",
  requestedBehavior:
    "Experiment with cartography, simplified to 2D: contour maps, dotted and line patterns, and animated thin-edged dots connected by lines with square or bracket nodes, different line types, and node count and connectedness as parameters.",
  viewInteraction: {
    authority: { kind: "explicit-user-request", requestQuote: "Okay let's simplify it to 2D." },
    mode: "fixed-camera",
  },
};

export const appAcceptance: readonly ToolcraftComponentAcceptance[] = [
  {
    automated: true,
    automatedTestName:
      "declares production reload coverage for the starter schema",
    browser: {
      budget: "extended-io",
      file: "e2e/app-persistence.spec.ts",
      testName: "browser: app restores exact canvas, values, and panel workspace slices after reload",
    },
    componentType: "persistence",
    evidence: "persistence-state",
    expectedObservable:
      "Canvas size and zoom, their runtime values, and the moved and collapsed Controls workspace remain visibly restored after a real browser reload.",
    fixture: "starter runtime persisted workspace",
    id: "persistence.reload",
    kind: "runtime",
    persistenceCoverage: "reload",
    persistenceSlices: starterPersistenceSlices,
    target: "canvas.size.width",
    userAction: "Edit Canvas width and zoom, move and collapse Controls, wait for persistence, and reload the page.",
  },
];

// Product entries use the same explicit stable section IDs as appSchema.
export const appControlSectionInventory: readonly ToolcraftControlSectionInventoryEntry[] = [
  {
    entity: "Background",
    entityId: "background",
    finiteSelectors: [],
    groupingReason: "Both controls edit the runtime-owned background fill.",
    id: "background",
    targets: ["export.includeBackground", "appearance.background"],
    title: "Background",
  },
  {
    entity: "Map view",
    entityId: "view",
    finiteSelectors: [],
    groupingReason: "Map size frames the flat map in the output.",
    id: "view",
    targets: ["view.fit"],
    title: "View",
  },
  {
    entity: "Terrain",
    entityId: "terrain",
    finiteSelectors: [
      {
        reason: "Landform swaps the height function without changing which terrain settings apply.",
        role: "parameter",
        target: "terrain.kind",
      },
    ],
    groupingReason: "These controls shape the one heightfield every other layer is drawn on.",
    id: "terrain",
    targets: ["terrain.kind", "terrain.seed", "terrain.scale", "terrain.detail"],
    title: "Terrain",
  },
  {
    entity: "Contour lines",
    entityId: "contours",
    finiteSelectors: [
      {
        reason: "Line style changes how contours are stroked; levels, index and weight apply to every style.",
        role: "parameter",
        target: "contours.style",
      },
    ],
    groupingReason: "These controls edit the contour lines drawn at each elevation level.",
    id: "contours",
    targets: ["contours.style", "contours.levels", "contours.index", "contours.weight"],
    title: "Contours",
  },
  {
    entity: "Level colors",
    entityId: "tint",
    finiteSelectors: [
      {
        affectedTargets: [],
        reason: "Level color mode decides whether bands, the three colors and the tonal pattern are relevant.",
        role: "branch",
        target: "tint.mode",
      },
    ],
    groupingReason: "These controls colour the map by elevation.",
    id: "tint",
    targets: ["tint.mode", "tint.bands", "tint.low", "tint.mid", "tint.high", "tint.tonalPattern"],
    title: "Level colors",
  },
  {
    entity: "Surface pattern",
    entityId: "pattern",
    finiteSelectors: [
      {
        affectedTargets: [],
        reason: "Pattern mode decides whether density, weight, angle and the zone split are relevant.",
        role: "branch",
        target: "pattern.mode",
      },
    ],
    groupingReason: "These controls edit the pattern printed between contours.",
    id: "pattern",
    targets: ["pattern.mode", "pattern.density", "pattern.weight", "pattern.angle", "pattern.split"],
    title: "Pattern",
  },
  {
    entity: "Network",
    entityId: "network",
    finiteSelectors: [
      {
        reason: "Node shape changes only how each node is drawn.",
        role: "parameter",
        target: "network.node.shape",
      },
      {
        affectedTargets: [],
        reason: "Node motion decides whether the motion speed is relevant.",
        role: "branch",
        target: "network.node.motion",
      },
      {
        reason: "Line style changes only how each link is stroked.",
        role: "parameter",
        target: "network.line.style",
      },
      {
        reason: "Line path changes only how each link travels between its two nodes.",
        role: "parameter",
        target: "network.line.path",
      },
    ],
    groupingReason: "These controls build one graph and style its nodes and links.",
    id: "network",
    targets: [
      "network.nodes",
      "network.links",
      "network.seed",
      "network.node.shape",
      "network.node.size",
      "network.node.edge",
      "network.node.motion",
      "network.node.speed",
      "network.line.style",
      "network.line.path",
      "network.line.weight",
    ],
    title: "Network",
  },
  {
    entity: "Colors",
    entityId: "ink",
    finiteSelectors: [],
    groupingReason: "One palette: each color inks one layer of the map.",
    id: "ink",
    targets: ["ink.surface", "ink.line", "ink.pattern", "ink.network", "ink.node"],
    title: "Colors",
  },
];
