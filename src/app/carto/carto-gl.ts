import { getCartoView, type CartoView } from "./carto-camera";
import { buildLineGeometry, getGraph, LINE_STRIDE, type Graph } from "./carto-graph";
import {
  lineFragment,
  lineVertex,
  nodeFragment,
  nodeVertex,
  terrainFragment,
  terrainVertex,
} from "./carto-shaders";
import { getHeightfield, TERRAIN_SIZE, type Heightfield } from "./carto-terrain";
import {
  contourStyles,
  hexToRgb,
  lineStyles,
  nodeMotions,
  nodeShapes,
  patternModes,
  tintModes,
  type CartoSettings,
} from "./carto-values";

export type CartoFrameInput = Readonly<{
  frameHeight: number;
  frameWidth: number;
  /** Backing pixels. */
  height: number;
  settings: CartoSettings;
  /** Seconds on the node motion clock. */
  time: number;
  width: number;
}>;

/** The map is static; the network is cheap and redrawn every frame while nodes move. */
export type CartoLayer = "all" | "map" | "network";

type Program = Readonly<{
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}>;

type Mesh = Readonly<{ count: number; vao: WebGLVertexArrayObject }>;

const SEGMENTS = TERRAIN_SIZE - 1;
const MAX_BACKING = 8192;
/** Outer edge of every node shape, in node radii; links stop here. */
const NODE_OUTER = 0.9;
/** Phase step between neighbouring nodes, so they do not move in unison. */
const PHASE_STEP = 0.618;
/** Half-width multiplier per line style: solid, dashed, dotted, double. */
const STYLE_WIDTH = [1, 1, 2, 2.6] as const;
/** Dash period in line widths per line style. */
const STYLE_PERIOD = [1, 7, 3.2, 1] as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Cartography: shader allocation failed.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "unknown";
    gl.deleteShader(shader);
    throw new Error(`Cartography shader compile failed: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  const program = gl.createProgram();
  if (!program) throw new Error("Cartography: program allocation failed.");
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Cartography program link failed: ${gl.getProgramInfoLog(program) ?? "unknown"}`);
  }
  return { program, uniforms: {} };
}

export class CartoEngine {
  readonly gl: WebGL2RenderingContext;
  private readonly terrain: Program;
  private readonly line: Program;
  private readonly node: Program;
  private readonly quadMesh: Mesh;
  private readonly heightTexture: WebGLTexture;
  private readonly lineVao: WebGLVertexArrayObject;
  private readonly lineVertices: WebGLBuffer;
  private readonly lineIndices: WebGLBuffer;
  private lineCount = 0;
  private heightKey = "";
  private lineKey = "";

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      stencil: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error("WebGL2 is unavailable.");
    this.gl = gl;
    this.terrain = link(gl, terrainVertex, terrainFragment);
    this.line = link(gl, lineVertex, lineFragment);
    this.node = link(gl, nodeVertex, nodeFragment);
    this.quadMesh = this.mesh(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2, new Uint32Array([0, 1, 2, 1, 3, 2]));
    this.heightTexture = this.texture();
    this.lineVao = gl.createVertexArray()!;
    this.lineVertices = gl.createBuffer()!;
    this.lineIndices = gl.createBuffer()!;
    this.bindLineLayout();
  }

  get isLost(): boolean {
    return this.gl.isContextLost();
  }

  private bindLineLayout(): void {
    const gl = this.gl;
    const stride = LINE_STRIDE * 4;
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVertices);
    // Position xz, neighbour xz, then side / distance / across.
    [2, 2, 3].forEach((size, location) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, location * 8);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndices);
    gl.bindVertexArray(null);
  }

  private mesh(vertices: Float32Array, size: number, indices: Uint32Array): Mesh {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, size, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { count: indices.length, vao };
  }

  /** Creates a nearest-sampled, clamped texture and leaves it bound. */
  private texture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private location(program: Program, name: string) {
    if (!(name in program.uniforms)) {
      program.uniforms[name] = this.gl.getUniformLocation(program.program, name);
    }
    return program.uniforms[name];
  }

  private float(program: Program, name: string, value: number) {
    this.gl.uniform1f(this.location(program, name), value);
  }

  private int(program: Program, name: string, value: number) {
    this.gl.uniform1i(this.location(program, name), value);
  }

  private vec(program: Program, name: string, value: readonly number[]) {
    const location = this.location(program, name);
    if (value.length === 2) this.gl.uniform2f(location, value[0], value[1]);
    else this.gl.uniform3f(location, value[0], value[1], value[2]);
  }

  private uploadHeight(field: Heightfield): void {
    const gl = this.gl;
    if (field.key === this.heightKey) return;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, field.size, field.size, 0, gl.RED, gl.FLOAT, field.data);
    this.heightKey = field.key;
  }

  /** Rebuilds the link ribbons only when the graph, the path type or the node size changes. */
  private uploadLines(graph: Graph, s: CartoSettings): void {
    const gl = this.gl;
    // Node radius is in map units (-1..1); the graph is laid out in uv (0..1).
    const trim = (s.nodeSize * NODE_OUTER) / 2;
    const key = [graph.key, s.linePath, trim].join("|");
    if (key === this.lineKey) return;
    const geometry = buildLineGeometry(graph, s.linePath, trim);
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.vertices), gl.DYNAMIC_DRAW);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geometry.indices), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    this.lineCount = geometry.indices.length;
    this.lineKey = key;
  }

  private drawTerrain(input: CartoFrameInput, view: CartoView, px: number): void {
    const gl = this.gl;
    const s = input.settings;
    const p = this.terrain;
    this.uploadHeight(getHeightfield(s));
    gl.useProgram(p.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    this.int(p, "uHeight", 0);
    gl.uniformMatrix4fv(this.location(p, "uMvp"), false, view.mvp);
    this.float(p, "uSegments", SEGMENTS);
    this.float(p, "uPx", px);
    this.float(p, "uLevels", s.levels);
    this.float(p, "uIndex", s.index);
    this.float(p, "uWeight", s.contourWeight);
    this.int(p, "uContourStyle", contourStyles.indexOf(s.contourStyle));
    this.int(p, "uPattern", patternModes.indexOf(s.pattern));
    this.float(p, "uDensity", s.patternDensity);
    this.float(p, "uPatternWeight", s.patternWeight);
    this.float(p, "uSplit", s.patternSplit);
    this.float(p, "uAngle", (s.patternAngle * Math.PI) / 180);
    this.int(p, "uTint", tintModes.indexOf(s.tint));
    this.float(p, "uBands", s.tintBands);
    this.float(p, "uTonal", s.tint !== "off" && s.tintTonal ? 1 : 0);
    this.vec(p, "uTintLow", hexToRgb(s.tintLow));
    this.vec(p, "uTintMid", hexToRgb(s.tintMid));
    this.vec(p, "uTintHigh", hexToRgb(s.tintHigh));
    this.vec(p, "uPatternInk", hexToRgb(s.inkPattern));
    this.vec(p, "uSurface", hexToRgb(s.inkSurface));
    this.vec(p, "uLine", hexToRgb(s.inkLine));
    gl.bindVertexArray(this.quadMesh.vao);
    gl.drawElements(gl.TRIANGLES, this.quadMesh.count, gl.UNSIGNED_INT, 0);
  }

  /** Links between nodes, widened to a constant weight on screen. */
  private drawLines(s: CartoSettings, view: CartoView, px: number, pxPerUnit: number, viewport: readonly number[]): void {
    if (this.lineCount === 0) return;
    const gl = this.gl;
    const p = this.line;
    const style = lineStyles.indexOf(s.lineStyle);
    const halfWidth = 0.5 * s.lineWeight * px * STYLE_WIDTH[style];
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(this.location(p, "uMvp"), false, view.mvp);
    this.vec(p, "uViewport", viewport);
    this.float(p, "uPeriod", (2 * halfWidth * STYLE_PERIOD[style]) / pxPerUnit);
    gl.bindVertexArray(this.lineVao);
    // A surface-coloured casing first, so links stay legible where they cross contours; thin links get a thin one.
    const passes = [
      { halfWidth: halfWidth + Math.min(1.5, s.lineWeight * 0.5) * px, ink: s.inkSurface, style: 0 },
      { halfWidth, ink: s.inkNetwork, style },
    ];
    for (const pass of passes) {
      this.float(p, "uHalfWidth", pass.halfWidth);
      this.int(p, "uStyle", pass.style);
      this.vec(p, "uInk", hexToRgb(pass.ink));
      gl.drawElements(gl.TRIANGLES, this.lineCount, gl.UNSIGNED_INT, 0);
    }
  }

  /** Nodes are flat marks sized in map units; `time` drives their motion. */
  private drawNodes(input: CartoFrameInput, view: CartoView, graph: Graph, edge: number): void {
    const gl = this.gl;
    const s = input.settings;
    const p = this.node;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(this.location(p, "uMvp"), false, view.mvp);
    this.float(p, "uRadius", s.nodeSize);
    this.float(p, "uExtent", s.nodeMotion === "ping" ? 2.6 : 1.5);
    this.float(p, "uEdge", edge);
    this.int(p, "uShape", nodeShapes.indexOf(s.nodeShape));
    this.int(p, "uMotion", nodeMotions.indexOf(s.nodeMotion));
    this.vec(p, "uInk", hexToRgb(s.inkNode));
    gl.bindVertexArray(this.quadMesh.vao);
    graph.nodes.forEach(([u, v], index) => {
      this.vec(p, "uCenter", [(u - 0.5) * 2, (v - 0.5) * 2]);
      this.float(p, "uCycle", input.time * s.nodeSpeed + index * PHASE_STEP);
      gl.drawElements(gl.TRIANGLES, this.quadMesh.count, gl.UNSIGNED_INT, 0);
    });
  }

  render(input: CartoFrameInput, layer: CartoLayer = "all"): void {
    const gl = this.gl;
    const limit = Math.min(MAX_BACKING, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    const width = Math.min(limit, Math.max(1, Math.round(input.width)));
    const height = Math.min(limit, Math.max(1, Math.round(input.height)));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const s = input.settings;
    const view = getCartoView(input.frameWidth / input.frameHeight, s.fit);
    // Backing pixels per frame pixel, and per map unit.
    const px = width / input.frameWidth;
    const pxPerUnit = (height / 2) * view.scale;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    // Premultiplied alpha: ONE, ONE_MINUS_SRC_ALPHA.
    gl.blendFunc(1, 0x0303);
    if (layer !== "network") this.drawTerrain(input, view, px);
    if (layer !== "map") {
      const graph = getGraph(s);
      this.uploadLines(graph, s);
      this.drawLines(s, view, px, pxPerUnit, [width, height]);
      this.drawNodes(input, view, graph, (s.nodeEdge * px) / (s.nodeSize * pxPerUnit));
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.heightTexture);
    gl.deleteBuffer(this.lineVertices);
    gl.deleteBuffer(this.lineIndices);
    gl.deleteVertexArray(this.lineVao);
    gl.deleteVertexArray(this.quadMesh.vao);
    for (const program of [this.terrain, this.line, this.node]) gl.deleteProgram(program.program);
  }
}
