import type { CartoSettings, TerrainKind } from "./carto-values";

/** Heightfield samples per side; the surface mesh has one vertex per sample. */
export const TERRAIN_SIZE = 257;

export type Heightfield = Readonly<{
  /** Row-major heights normalised to 0..1; row = map north (v), column = map east (u). */
  data: Float32Array;
  key: string;
  size: number;
}>;

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves: number, ridged: boolean): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    const n = valueNoise(x * frequency, y * frequency, seed + octave * 17);
    sum += amplitude * (ridged ? 1 - Math.abs(n * 2 - 1) : n);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

function sampleTerrain(kind: TerrainKind, u: number, v: number, s: CartoSettings): number {
  const x = u * 3 * s.scale;
  const y = v * 3 * s.scale;
  if (kind === "ridges") return fbm(x, y, s.seed, s.detail, true) ** 2;
  if (kind === "dunes") {
    const warp = fbm(x * 0.6, y * 0.6, s.seed + 5, Math.min(3, s.detail), false);
    const wave = 0.5 + 0.5 * Math.sin((x * 1.4 + y * 0.5 + warp * 3.2) * Math.PI);
    return wave * 0.8 + fbm(x * 2, y * 2, s.seed, s.detail, false) * 0.2;
  }
  const base = fbm(x, y, s.seed, s.detail, false);
  if (kind === "island") {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    return base * Math.max(0, 1 - r * r) ** 0.8;
  }
  return base ** 1.7;
}

let cached: Heightfield | null = null;

/** The single source of height for the surface mesh, the contour shader and the network lines. */
export function getHeightfield(s: CartoSettings): Heightfield {
  const key = [s.terrain, s.seed, s.scale, s.detail].join("|");
  if (cached?.key === key) return cached;
  const size = TERRAIN_SIZE;
  const data = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = sampleTerrain(s.terrain, col / (size - 1), row / (size - 1), s);
      data[row * size + col] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  // Rescale so the lowest point sits at 0 and the summit at 1.
  const range = max - min || 1;
  for (let i = 0; i < data.length; i += 1) data[i] = (data[i] - min) / range;
  cached = { data, key, size };
  return cached;
}

/** Bilinear height at map coordinates u, v in 0..1. */
export function sampleHeight(field: Heightfield, u: number, v: number): number {
  const max = field.size - 1;
  const x = Math.min(max, Math.max(0, u * max));
  const y = Math.min(max, Math.max(0, v * max));
  const x0 = Math.min(max - 1, Math.floor(x));
  const y0 = Math.min(max - 1, Math.floor(y));
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * field.size + x0;
  const top = field.data[i] + (field.data[i + 1] - field.data[i]) * fx;
  const bottom = field.data[i + field.size] + (field.data[i + field.size + 1] - field.data[i + field.size]) * fx;
  return top + (bottom - top) * fy;
}
