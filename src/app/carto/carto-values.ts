export const cartoTargets = {
  background: "appearance.background",
  contourStyle: "contours.style",
  contourWeight: "contours.weight",
  detail: "terrain.detail",
  fit: "view.fit",
  includeBackground: "export.includeBackground",
  index: "contours.index",
  inkLine: "ink.line",
  inkPattern: "ink.pattern",
  inkNetwork: "ink.network",
  inkNode: "ink.node",
  inkSurface: "ink.surface",
  levels: "contours.levels",
  linePath: "network.line.path",
  lineStyle: "network.line.style",
  lineWeight: "network.line.weight",
  links: "network.links",
  nodeEdge: "network.node.edge",
  nodeMotion: "network.node.motion",
  nodeShape: "network.node.shape",
  nodeSize: "network.node.size",
  nodeSpeed: "network.node.speed",
  nodes: "network.nodes",
  networkSeed: "network.seed",
  pattern: "pattern.mode",
  patternAngle: "pattern.angle",
  patternDensity: "pattern.density",
  patternSplit: "pattern.split",
  patternWeight: "pattern.weight",
  scale: "terrain.scale",
  seed: "terrain.seed",
  terrain: "terrain.kind",
  tint: "tint.mode",
  tintBands: "tint.bands",
  tintHigh: "tint.high",
  tintLow: "tint.low",
  tintMid: "tint.mid",
  tintTonal: "tint.tonalPattern",
} as const;

export const terrainKinds = ["peaks", "ridges", "dunes", "island"] as const;
export const contourStyles = ["solid", "dashed", "dotted"] as const;
export const nodeShapes = ["square", "brackets", "bracketed"] as const;
export const lineStyles = ["solid", "dashed", "dotted", "double"] as const;
export const linePaths = ["straight", "elbow", "arc"] as const;
export const nodeMotions = ["still", "pulse", "ping", "spin"] as const;
/** Order is the shader's pattern index. */
export const patternModes = ["none", "dots", "lines", "zoned", "plus", "hachure", "banded"] as const;
export const tintModes = ["off", "bands", "smooth"] as const;

export type TerrainKind = (typeof terrainKinds)[number];
export type ContourStyle = (typeof contourStyles)[number];
export type NodeMotion = (typeof nodeMotions)[number];
export type NodeShape = (typeof nodeShapes)[number];
export type LineStyle = (typeof lineStyles)[number];
export type LinePath = (typeof linePaths)[number];
export type PatternMode = (typeof patternModes)[number];
export type TintMode = (typeof tintModes)[number];

export const cartoDefaults = {
  background: "#101B2D",
  contourStyle: "solid" as ContourStyle,
  contourWeight: 1.2,
  detail: 4,
  fit: 1,
  includeBackground: true,
  index: 3,
  inkLine: "#24324A",
  inkPattern: "#7C8FB0",
  inkNetwork: "#F2542D",
  inkNode: "#2447F9",
  inkSurface: "#F4F0E6",
  levels: 18,
  linePath: "straight" as LinePath,
  lineStyle: "solid" as LineStyle,
  lineWeight: 0.6,
  links: 0.6,
  nodeEdge: 1.5,
  nodeMotion: "ping" as NodeMotion,
  nodeShape: "brackets" as NodeShape,
  nodeSize: 0.015,
  nodeSpeed: 0.5,
  nodes: 16,
  networkSeed: 3,
  pattern: "banded" as PatternMode,
  patternAngle: 0,
  patternDensity: 56,
  patternSplit: 0.45,
  patternWeight: 0.5,
  scale: 1,
  seed: 7,
  terrain: "peaks" as TerrainKind,
  tint: "bands" as TintMode,
  tintBands: 6,
  tintHigh: "#F7C873",
  tintLow: "#8FBFC4",
  tintMid: "#F4F0E6",
  tintTonal: true,
};

export type CartoSettings = {
  contourStyle: ContourStyle;
  contourWeight: number;
  detail: number;
  fit: number;
  index: number;
  inkLine: string;
  inkPattern: string;
  inkNetwork: string;
  inkNode: string;
  inkSurface: string;
  levels: number;
  linePath: LinePath;
  lineStyle: LineStyle;
  lineWeight: number;
  links: number;
  nodeEdge: number;
  nodeMotion: NodeMotion;
  nodeShape: NodeShape;
  nodeSize: number;
  nodeSpeed: number;
  nodes: number;
  networkSeed: number;
  pattern: PatternMode;
  patternAngle: number;
  patternDensity: number;
  patternSplit: number;
  patternWeight: number;
  scale: number;
  seed: number;
  terrain: TerrainKind;
  tint: TintMode;
  tintBands: number;
  tintHigh: string;
  tintLow: string;
  tintMid: string;
  tintTonal: boolean;
};

type Values = Readonly<Record<string, unknown>>;

function num(values: Values, target: string, fallback: number): number {
  const value = Number(values[target]);
  return Number.isFinite(value) ? value : fallback;
}

function unit(values: Values, target: string, fallback: number): number {
  return Math.min(1, Math.max(0, num(values, target, fallback)));
}

function color(values: Values, target: string, fallback: string): string {
  const value = values[target];
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function choice<T extends string>(values: Values, target: string, options: readonly T[], fallback: T): T {
  const value = values[target];
  return options.includes(value as T) ? (value as T) : fallback;
}

function readNetwork(values: Values) {
  const t = cartoTargets;
  const d = cartoDefaults;
  return {
    linePath: choice(values, t.linePath, linePaths, d.linePath),
    lineStyle: choice(values, t.lineStyle, lineStyles, d.lineStyle),
    lineWeight: num(values, t.lineWeight, d.lineWeight),
    links: unit(values, t.links, d.links),
    networkSeed: Math.round(num(values, t.networkSeed, d.networkSeed)),
    nodeEdge: Math.min(6, Math.max(0.25, num(values, t.nodeEdge, d.nodeEdge))),
    nodeMotion: choice(values, t.nodeMotion, nodeMotions, d.nodeMotion),
    nodeShape: choice(values, t.nodeShape, nodeShapes, d.nodeShape),
    nodeSize: Math.min(0.2, Math.max(0.01, num(values, t.nodeSize, d.nodeSize))),
    nodeSpeed: num(values, t.nodeSpeed, d.nodeSpeed),
    nodes: Math.min(60, Math.max(2, Math.round(num(values, t.nodes, d.nodes)))),
  };
}

function readTint(values: Values) {
  const t = cartoTargets;
  const d = cartoDefaults;
  const tonal = values[t.tintTonal];
  return {
    tint: choice(values, t.tint, tintModes, d.tint),
    tintBands: Math.min(12, Math.max(2, Math.round(num(values, t.tintBands, d.tintBands)))),
    tintHigh: color(values, t.tintHigh, d.tintHigh),
    tintLow: color(values, t.tintLow, d.tintLow),
    tintMid: color(values, t.tintMid, d.tintMid),
    tintTonal: typeof tonal === "boolean" ? tonal : d.tintTonal,
  };
}

function readSurface(values: Values) {
  const t = cartoTargets;
  const d = cartoDefaults;
  return {
    contourStyle: choice(values, t.contourStyle, contourStyles, d.contourStyle),
    contourWeight: num(values, t.contourWeight, d.contourWeight),
    index: Math.round(num(values, t.index, d.index)),
    inkLine: color(values, t.inkLine, d.inkLine),
    inkPattern: color(values, t.inkPattern, d.inkPattern),
    inkNetwork: color(values, t.inkNetwork, d.inkNetwork),
    inkNode: color(values, t.inkNode, d.inkNode),
    inkSurface: color(values, t.inkSurface, d.inkSurface),
    levels: num(values, t.levels, d.levels),
    pattern: choice(values, t.pattern, patternModes, d.pattern),
    patternAngle: num(values, t.patternAngle, d.patternAngle),
    patternDensity: num(values, t.patternDensity, d.patternDensity),
    patternSplit: num(values, t.patternSplit, d.patternSplit),
    patternWeight: num(values, t.patternWeight, d.patternWeight),
  };
}

export function readCartoSettings(values: Values): CartoSettings {
  const t = cartoTargets;
  const d = cartoDefaults;
  return {
    ...readNetwork(values),
    ...readSurface(values),
    ...readTint(values),
    detail: Math.min(8, Math.max(1, Math.round(num(values, t.detail, d.detail)))),
    fit: num(values, t.fit, d.fit),
    scale: num(values, t.scale, d.scale),
    seed: Math.round(num(values, t.seed, d.seed)),
    terrain: choice(values, t.terrain, terrainKinds, d.terrain),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
