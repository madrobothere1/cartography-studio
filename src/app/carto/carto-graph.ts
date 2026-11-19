import type { CartoSettings } from "./carto-values";

type Point = readonly [number, number];

export type Graph = Readonly<{
  /** Node index pairs. */
  edges: readonly (readonly [number, number])[];
  key: string;
  /** Node positions in map coordinates, 0..1. */
  nodes: readonly Point[];
}>;

export type LineGeometry = {
  indices: number[];
  /** Per vertex: position xz, neighbour xz, side, distance along the line, across. */
  vertices: number[];
};

/** Floats per line vertex. */
export const LINE_STRIDE = 7;

const NEIGHBOURS = 3;
const CANDIDATES = 14;
/** Segments in one arc link. */
const ARC_STEPS = 28;
/** How far an arc bows sideways, as a share of the link length. */
const ARC_BOW = 0.22;

function random(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Best-candidate placement: each new node lands far from the ones before it. */
function placeNodes(count: number, seed: number): Point[] {
  const next = random(seed);
  const nodes: Point[] = [];
  while (nodes.length < count) {
    let best: Point = [0.5, 0.5];
    let bestGap = -1;
    for (let i = 0; i < CANDIDATES; i += 1) {
      const candidate: Point = [0.08 + next() * 0.84, 0.08 + next() * 0.84];
      const gap = Math.min(1, ...nodes.map((node) => distance(node, candidate)));
      if (gap > bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    nodes.push(best);
  }
  return nodes;
}

type Link = readonly [number, number, number];

/** Shortest links that join every node into one tree. */
function spanningTree(count: number, links: readonly Link[]): Link[] {
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const tree: Link[] = [];
  for (const link of links) {
    const a = find(link[0]);
    const b = find(link[1]);
    if (a === b) continue;
    parent[a] = b;
    tree.push(link);
  }
  return tree;
}

/** Tree links first, then each node's remaining nearest-neighbour links, shortest first. */
function orderLinks(nodes: readonly Point[]): Link[] {
  const all: Link[] = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) all.push([a, b, distance(nodes[a], nodes[b])]);
  }
  all.sort((x, y) => x[2] - y[2]);
  const tree = spanningTree(nodes.length, all);
  const near: Link[] = [];
  nodes.forEach((_, node) => {
    near.push(...all.filter((link) => link[0] === node || link[1] === node).slice(0, NEIGHBOURS));
  });
  const loops = all.filter((link) => near.includes(link) && !tree.includes(link));
  return [...tree, ...loops];
}

let cachedGraph: Graph | null = null;

/** Seeded nodes; `links` 0 leaves them apart, about half joins one tree, 1 adds every loop. */
export function getGraph(s: CartoSettings): Graph {
  const key = [s.nodes, s.networkSeed, s.links].join("|");
  if (cachedGraph?.key === key) return cachedGraph;
  const nodes = placeNodes(s.nodes, s.networkSeed);
  const ordered = orderLinks(nodes);
  const edges = ordered.slice(0, Math.round(s.links * ordered.length)).map((link) => [link[0], link[1]] as const);
  cachedGraph = { edges, key, nodes };
  return cachedGraph;
}

/** Point at a given distance along a polyline in map coordinates. */
function pointAlong(path: readonly Point[], target: number): Point {
  let walked = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const span = distance(path[i], path[i + 1]);
    if (walked + span >= target && span > 0) {
      const t = (target - walked) / span;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
    }
    walked += span;
  }
  return path[path.length - 1];
}

/** The route one link takes between its two nodes. */
function linkPath(linePath: string, a: Point, b: Point): Point[] {
  if (linePath === "elbow") return [a, [b[0], a[1]], b];
  if (linePath !== "arc") return [a, b];
  const path: Point[] = [];
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const t = i / ARC_STEPS;
    const bow = Math.sin(Math.PI * t) * ARC_BOW;
    path.push([a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) * bow, a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) * bow]);
  }
  return path;
}

/** Cuts `inset` off both ends of a polyline so a link stops at the edge of its nodes. */
function trimPath(path: readonly Point[], inset: number): Point[] {
  const total = path.slice(1).reduce((sum, point, i) => sum + distance(path[i], point), 0);
  if (total <= inset * 2) return [];
  const trimmed: Point[] = [pointAlong(path, inset)];
  let walked = 0;
  for (let i = 1; i < path.length - 1; i += 1) {
    walked += distance(path[i - 1], path[i]);
    if (walked > inset && walked < total - inset) trimmed.push(path[i]);
  }
  trimmed.push(pointAlong(path, total - inset));
  return trimmed;
}

/** Ribbons in map space: every segment becomes one quad that the vertex shader widens on screen. */
export function buildLineGeometry(graph: Graph, linePath: string, trim: number): LineGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [from, to] of graph.edges) {
    const points = trimPath(linkPath(linePath, graph.nodes[from], graph.nodes[to]), trim);
    let walked = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const px = (points[i][0] - 0.5) * 2;
      const pz = (points[i][1] - 0.5) * 2;
      const qx = (points[i + 1][0] - 0.5) * 2;
      const qz = (points[i + 1][1] - 0.5) * 2;
      const first = vertices.length / LINE_STRIDE;
      // The far end sees the segment reversed, so its side flips while `across` stays put.
      const far = walked + Math.hypot(qx - px, qz - pz);
      vertices.push(px, pz, qx, qz, 1, walked, 1);
      vertices.push(px, pz, qx, qz, -1, walked, -1);
      vertices.push(qx, qz, px, pz, -1, far, 1);
      vertices.push(qx, qz, px, pz, 1, far, -1);
      indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
      walked = far;
    }
  }
  return { indices, vertices };
}
