import type { ToolcraftControlSchema } from "@/toolcraft/runtime";

import { cartoDefaults as d, cartoTargets as t } from "./carto-values";

type Section = {
  controls: Record<string, ToolcraftControlSchema>;
  description?: string;
  id: string;
  title: string;
};

type SliderInput = {
  applicability?: ToolcraftControlSchema["applicability"];
  defaultValue: number;
  description?: string;
  discrete?: boolean;
  label: string;
  max: number;
  min: number;
  reason?: string;
  step: number;
  target: string;
  workload?: boolean;
};

const always = { mode: "always" } as const;
const anyPattern = { all: [{ notOneOf: ["none"], target: t.pattern }], mode: "conditional" } as const;
const onlyZoned = { all: [{ oneOf: ["zoned"], target: t.pattern }], mode: "conditional" } as const;

const tinted = { all: [{ notOneOf: ["off"], target: t.tint }], mode: "conditional" } as const;
const nodesMove = { all: [{ notOneOf: ["still"], target: t.nodeMotion }], mode: "conditional" } as const;

const uniformOnly = "Uniform-only change in the surface shader.";
const terrainRebuild = "Rebuilds the heightfield once, then redraws.";
const networkRebuild = "Rebuilds the graph or its link ribbons once, then redraws.";

function slider(input: SliderInput): ToolcraftControlSchema {
  return {
    applicability: input.applicability ?? always,
    defaultValue: input.defaultValue,
    ...(input.description ? { description: input.description } : {}),
    label: input.label,
    max: input.max,
    min: input.min,
    performanceReason: input.reason ?? uniformOnly,
    performanceRole: input.workload ? "workload" : "responsiveness",
    sliderValueKind: input.discrete ? "discrete" : "continuous",
    step: input.step,
    target: input.target,
    type: "slider",
  };
}

function ink(label: string, target: string, defaultValue: string, description: string): ToolcraftControlSchema {
  return {
    applicability: always,
    defaultValue,
    description,
    label,
    performanceReason: uniformOnly,
    performanceRole: "responsiveness",
    target,
    type: "color",
  };
}

export const backgroundSection: Section = {
  controls: {
    includeBackground: {
      applicability: always,
      defaultValue: d.includeBackground,
      label: "Background",
      performanceReason: "Only toggles the runtime-owned background fill.",
      performanceRole: "responsiveness",
      target: t.includeBackground,
      type: "switch",
    },
    background: {
      applicability: always,
      defaultValue: d.background,
      label: "Background color",
      performanceReason: "Only changes the runtime-owned background fill.",
      performanceRole: "responsiveness",
      target: t.background,
      type: "color",
    },
  },
  id: "background",
  title: "Background",
};

export const viewSection: Section = {
  controls: {
    fit: slider({
      defaultValue: d.fit,
      description: "Size of the map inside the frame.",
      label: "Map size",
      max: 1.6,
      min: 0.4,
      reason: "Only changes the view matrix.",
      step: 0.01,
      target: t.fit,
    }),
  },
  id: "view",
  title: "View",
};

export const terrainSection: Section = {
  controls: {
    kind: {
      applicability: always,
      defaultValue: d.terrain,
      label: "Landform",
      options: [
        { label: "Peaks", value: "peaks" },
        { label: "Ridges", value: "ridges" },
        { label: "Dunes", value: "dunes" },
        { label: "Island", value: "island" },
      ],
      performanceReason: terrainRebuild,
      performanceRole: "responsiveness",
      target: t.terrain,
      type: "segmented",
    },
    seed: slider({ defaultValue: d.seed, discrete: true, label: "Seed", max: 99, min: 1, reason: terrainRebuild, step: 1, target: t.seed }),
    scale: slider({
      defaultValue: d.scale,
      description: "How many landforms fit across the map.",
      label: "Feature scale",
      max: 3,
      min: 0.3,
      reason: terrainRebuild,
      step: 0.01,
      target: t.scale,
    }),
    detail: slider({
      defaultValue: d.detail,
      description: "Noise octaves: more detail adds smaller wiggles to every contour.",
      discrete: true,
      label: "Detail",
      max: 8,
      min: 1,
      reason: "Heightfield build cost grows with the octave count.",
      step: 1,
      target: t.detail,
      workload: true,
    }),
  },
  id: "terrain",
  title: "Terrain",
};

export const contoursSection: Section = {
  controls: {
    style: {
      applicability: always,
      defaultValue: d.contourStyle,
      label: "Line style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
      performanceReason: "Selects a branch in the surface shader.",
      performanceRole: "responsiveness",
      target: t.contourStyle,
      type: "segmented",
    },
    levels: slider({
      defaultValue: d.levels,
      description: "Number of elevation levels between the lowest and highest point.",
      discrete: true,
      label: "Levels",
      max: 80,
      min: 4,
      step: 1,
      target: t.levels,
    }),
    index: slider({
      defaultValue: d.index,
      description: "Every nth contour is drawn heavier. 0 turns index contours off.",
      discrete: true,
      label: "Index every",
      max: 10,
      min: 0,
      step: 1,
      target: t.index,
    }),
    weight: slider({ defaultValue: d.contourWeight, label: "Weight", max: 4, min: 0.4, step: 0.1, target: t.contourWeight }),
  },
  id: "contours",
  title: "Contours",
};

export const patternSection: Section = {
  controls: {
    mode: {
      applicability: always,
      defaultValue: d.pattern,
      description:
        "By level gives each level band its own pattern. Hachures are short strokes that point downhill. Zoned prints dots on the lowlands and lines on the highlands.",
      label: "Pattern",
      options: [
        { label: "None", value: "none" },
        { label: "Dots", value: "dots" },
        { label: "Lines", value: "lines" },
        { label: "Plus marks", value: "plus" },
        { label: "Hachures", value: "hachure" },
        { label: "Zoned", value: "zoned" },
        { label: "By level", value: "banded" },
      ],
      performanceReason: "Selects a branch in the surface shader.",
      performanceRole: "responsiveness",
      target: t.pattern,
      type: "select",
    },
    density: slider({
      applicability: anyPattern,
      defaultValue: d.patternDensity,
      description: "Pattern cells across the map.",
      discrete: true,
      label: "Density",
      max: 140,
      min: 12,
      step: 1,
      target: t.patternDensity,
    }),
    weight: slider({
      applicability: anyPattern,
      defaultValue: d.patternWeight,
      description: "Dot size and stroke thickness. Dots also grow with elevation.",
      label: "Weight",
      max: 1,
      min: 0.1,
      step: 0.01,
      target: t.patternWeight,
    }),
    angle: slider({
      applicability: anyPattern,
      defaultValue: d.patternAngle,
      description: "Turns the pattern grid about the map centre.",
      label: "Angle",
      max: 90,
      min: -90,
      step: 1,
      target: t.patternAngle,
    }),
    split: slider({
      applicability: onlyZoned,
      defaultValue: d.patternSplit,
      description: "Elevation where dots give way to lines.",
      label: "Zone split",
      max: 0.9,
      min: 0.1,
      step: 0.01,
      target: t.patternSplit,
    }),
  },
  id: "pattern",
  title: "Pattern",
};

function tintColor(label: string, target: string, defaultValue: string, description: string): ToolcraftControlSchema {
  return { ...ink(label, target, defaultValue, description), applicability: tinted };
}

export const tintSection: Section = {
  controls: {
    mode: {
      applicability: always,
      defaultValue: d.tint,
      description: "Bands gives each level band one flat colour; smooth blends across the whole height range.",
      label: "Level colors",
      options: [
        { label: "Off", value: "off" },
        { label: "Bands", value: "bands" },
        { label: "Smooth", value: "smooth" },
      ],
      performanceReason: "Selects a branch in the surface shader.",
      performanceRole: "responsiveness",
      target: t.tint,
      type: "segmented",
    },
    bands: slider({
      applicability: tinted,
      defaultValue: d.tintBands,
      description: "Number of level bands. Bands line up with contours when Levels is a multiple of this.",
      discrete: true,
      label: "Bands",
      max: 12,
      min: 2,
      step: 1,
      target: t.tintBands,
    }),
    low: tintColor("Low", t.tintLow, d.tintLow, "Colour of the lowest ground."),
    mid: tintColor("Middle", t.tintMid, d.tintMid, "Colour halfway up."),
    high: tintColor("High", t.tintHigh, d.tintHigh, "Colour of the highest ground."),
    tonal: {
      applicability: tinted,
      defaultValue: d.tintTonal,
      description: "Prints the pattern in a darker shade of the colour under it instead of the Pattern color.",
      label: "Tonal pattern",
      performanceReason: uniformOnly,
      performanceRole: "responsiveness",
      target: t.tintTonal,
      type: "switch",
    },
  },
  description: "Colours the map by elevation.",
  id: "tint",
  title: "Level colors",
};

function choiceControl(
  label: string,
  target: string,
  defaultValue: string,
  options: readonly string[],
  description?: string,
): ToolcraftControlSchema {
  return {
    applicability: always,
    defaultValue,
    ...(description ? { description } : {}),
    label,
    options: options.map((value) => ({ label: value[0].toUpperCase() + value.slice(1), value })),
    performanceReason: "Selects a shader branch or rebuilds the link ribbons once.",
    performanceRole: "responsiveness",
    target,
    type: "segmented",
  };
}

export const networkSection: Section = {
  controls: {
    nodes: slider({
      defaultValue: d.nodes,
      discrete: true,
      label: "Nodes",
      max: 60,
      min: 2,
      reason: "Link ordering compares every node pair; ribbon vertices grow with the link count.",
      step: 1,
      target: t.nodes,
      workload: true,
    }),
    links: slider({
      defaultValue: d.links,
      description: "0 leaves nodes unlinked, about half joins them into one tree, 1 adds loops between neighbours.",
      label: "Connectedness",
      max: 1,
      min: 0,
      reason: networkRebuild,
      step: 0.01,
      target: t.links,
    }),
    seed: slider({
      defaultValue: d.networkSeed,
      description: "Reshuffles where the nodes sit on the map.",
      discrete: true,
      label: "Layout seed",
      max: 99,
      min: 1,
      reason: networkRebuild,
      step: 1,
      target: t.networkSeed,
    }),
    nodeShape: choiceControl(
      "Node",
      t.nodeShape,
      d.nodeShape,
      ["square", "brackets", "bracketed"],
      "Bracketed draws corner brackets around a square.",
    ),
    nodeEdge: slider({
      defaultValue: d.nodeEdge,
      description: "Stroke thickness of the node outline and brackets.",
      label: "Node edge",
      max: 4,
      min: 0.5,
      reason: "Uniform-only change in the node shader.",
      step: 0.1,
      target: t.nodeEdge,
    }),
    nodeSize: slider({
      defaultValue: d.nodeSize,
      description: "Node size relative to the map.",
      label: "Node size",
      max: 0.15,
      min: 0.015,
      reason: networkRebuild,
      step: 0.005,
      target: t.nodeSize,
    }),
    nodeMotion: choiceControl(
      "Node motion",
      t.nodeMotion,
      d.nodeMotion,
      ["still", "pulse", "ping", "spin"],
      "Pulse breathes the outline, ping sends out a fading outline, spin turns the outline a quarter turn. Exports show the first frame.",
    ),
    nodeSpeed: slider({
      applicability: nodesMove,
      defaultValue: d.nodeSpeed,
      description: "Motion cycles per second.",
      label: "Motion speed",
      max: 2,
      min: 0.1,
      reason: "Only changes the clock of the node shader.",
      step: 0.05,
      target: t.nodeSpeed,
    }),
    lineStyle: choiceControl("Line", t.lineStyle, d.lineStyle, ["solid", "dashed", "dotted", "double"]),
    linePath: choiceControl(
      "Line path",
      t.linePath,
      d.linePath,
      ["straight", "elbow", "arc"],
      "Elbow links turn one right angle; arcs bow to one side.",
    ),
    lineWeight: slider({ defaultValue: d.lineWeight, label: "Line weight", max: 6, min: 0.5, step: 0.1, target: t.lineWeight }),
  },
  description: "A graph of nodes joined by lines, laid over the map.",
  id: "network",
  title: "Network",
};

export const inkSection: Section = {
  controls: {
    surface: ink("Surface", t.inkSurface, d.inkSurface, "Paper colour of the map when level colors are off."),
    line: ink("Contours", t.inkLine, d.inkLine, "Contour lines and the map outline."),
    pattern: ink("Pattern", t.inkPattern, d.inkPattern, "Dot and line pattern printed under the contours."),
    network: ink("Links", t.inkNetwork, d.inkNetwork, "Lines between the nodes."),
    node: ink("Nodes", t.inkNode, d.inkNode, "Node outlines, brackets and squares."),
  },
  id: "ink",
  title: "Colors",
};

export const cartoControlSections = [
  backgroundSection,
  viewSection,
  terrainSection,
  contoursSection,
  tintSection,
  patternSection,
  networkSection,
  inkSection,
];
