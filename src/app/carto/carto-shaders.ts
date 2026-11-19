export const terrainVertex = `#version 300 es
precision highp float;

// Map uv, 0..1.
layout(location = 0) in vec2 aVertex;

uniform mat4 uMvp;

out vec2 vUv;

void main() {
  vUv = aVertex;
  gl_Position = uMvp * vec4((aVertex.x - 0.5) * 2.0, 0.0, (aVertex.y - 0.5) * 2.0, 1.0);
}
`;

export const terrainFragment = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;

uniform sampler2D uHeight;
uniform float uSegments;
uniform float uPx;
uniform float uLevels;
uniform float uIndex;
uniform float uWeight;
uniform int uContourStyle;
// 0 none, 1 dots, 2 lines, 3 zoned, 4 plus, 5 hachure, 6 a different pattern per level band.
uniform int uPattern;
uniform float uDensity;
uniform float uPatternWeight;
uniform float uSplit;
// Pattern grid angle in radians.
uniform float uAngle;
// 0 off, 1 stepped bands, 2 smooth.
uniform int uTint;
uniform float uBands;
uniform float uTonal;
uniform vec3 uTintLow;
uniform vec3 uTintMid;
uniform vec3 uTintHigh;
uniform vec3 uSurface;
uniform vec3 uLine;
uniform vec3 uPatternInk;

out vec4 outColor;

float heightAt(vec2 uv) {
  vec2 p = clamp(uv, 0.0, 1.0) * uSegments;
  vec2 base = min(floor(p), uSegments - 1.0);
  vec2 f = p - base;
  ivec2 i = ivec2(base);
  float a = texelFetch(uHeight, i, 0).r;
  float b = texelFetch(uHeight, i + ivec2(1, 0), 0).r;
  float c = texelFetch(uHeight, i + ivec2(0, 1), 0).r;
  float d = texelFetch(uHeight, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Height change per map unit, east and north.
vec2 slopeAt(vec2 uv) {
  float e = 1.5 / uSegments;
  return vec2(
    heightAt(uv + vec2(e, 0.0)) - heightAt(uv - vec2(e, 0.0)),
    heightAt(uv + vec2(0.0, e)) - heightAt(uv - vec2(0.0, e))
  ) / (2.0 * e);
}

float contourMask(float h, vec2 slope) {
  float f = h * uLevels;
  float level = floor(f + 0.5);
  if (level < 0.5) return 0.0;
  float across = abs(f - level) / max(fwidth(f), 1e-5);
  bool isIndex = uIndex > 0.5 && mod(level, uIndex) < 0.5;
  float halfWidth = 0.5 * uWeight * uPx * (isIndex ? 2.0 : 1.0);
  if (uContourStyle == 0) return 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, across);

  // Dashes and dots run along whichever map axis the contour follows more closely.
  float along = abs(slope.y) > abs(slope.x) ? vUv.x : vUv.y;
  float period = (uContourStyle == 1 ? 14.0 : 7.0) * max(1.0, uWeight) / 1000.0;
  float phase = fract(along / period);
  if (uContourStyle == 1) {
    return (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, across)) * step(phase, 0.62);
  }
  float alongPx = (phase - 0.5) * period / max(fwidth(along), 1e-6);
  float radius = halfWidth * 1.7;
  return 1.0 - smoothstep(radius - 0.6, radius + 0.6, length(vec2(alongPx, across)));
}

// Pattern grid coordinates: one cell per unit, turned about the map centre.
vec2 gridAt(vec2 uv, vec2 turn) {
  vec2 p = (uv - 0.5) * uDensity;
  return vec2(turn.x * p.x - turn.y * p.y, turn.y * p.x + turn.x * p.y);
}

float dotPattern(vec2 q, float aa, float h) {
  float radius = uPatternWeight * 0.46 * mix(0.35, 1.0, h);
  return 1.0 - smoothstep(radius - aa, radius + aa, length(fract(q) - 0.5));
}

float linePattern(vec2 q, float aa) {
  float halfWidth = uPatternWeight * 0.3;
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(fract(q.y) - 0.5));
}

float plusPattern(vec2 q, float aa) {
  vec2 p = abs(fract(q) - 0.5);
  float halfWidth = uPatternWeight * 0.1;
  float d = min(max(p.x - 0.3, p.y - halfWidth), max(p.y - 0.3, p.x - halfWidth));
  return 1.0 - smoothstep(-aa, aa, d);
}

// One short stroke per cell, pointing downhill and longer where the ground is steeper.
float hachurePattern(vec2 q, float aa, vec2 turn) {
  vec2 cell = floor(q) + 0.5;
  vec2 center = vec2(turn.x * cell.x + turn.y * cell.y, -turn.y * cell.x + turn.x * cell.y) / uDensity + 0.5;
  vec2 slope = slopeAt(center);
  float steep = length(slope);
  vec2 dir = steep > 1e-4 ? slope / steep : vec2(1.0, 0.0);
  dir = vec2(turn.x * dir.x - turn.y * dir.y, turn.y * dir.x + turn.x * dir.y);
  float reach = 0.42 * clamp(steep * 0.3, 0.08, 1.0);
  vec2 p = q - cell;
  float d = length(p - dir * clamp(dot(p, dir), -reach, reach));
  float halfWidth = uPatternWeight * 0.14;
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, d);
}

// Index of the level band this height falls in.
float bandOf(float h) {
  return min(floor(h * uBands), uBands - 1.0);
}

float patternMask(float h) {
  if (uPattern == 0) return 0.0;
  int kind = uPattern;
  float angle = uAngle;
  if (uPattern == 6) {
    // Each band takes the next pattern in the cycle and turns its grid a little further.
    float band = bandOf(h);
    kind = int(mod(band, 4.0));
    kind = kind == 0 ? 1 : kind == 1 ? 2 : kind == 2 ? 4 : 5;
    angle += band * 0.5236;
  }
  vec2 turn = vec2(cos(angle), sin(angle));
  vec2 q = gridAt(vUv, turn);
  float aa = max(0.75 * max(fwidth(q.x), fwidth(q.y)), 1e-4);
  if (kind == 1) return dotPattern(q, aa, uPattern == 6 ? 0.6 : h);
  if (kind == 2) return linePattern(q, aa);
  if (kind == 3) return h < uSplit ? dotPattern(q, aa, h / max(uSplit, 0.01)) : linePattern(q, aa);
  if (kind == 4) return plusPattern(q, aa);
  return hachurePattern(q, aa, turn);
}

// Low, mid and high colours across the height range, stepped per band or smooth.
vec3 tintAt(float h) {
  if (uTint == 0) return uSurface;
  float t = uTint == 1 ? bandOf(h) / max(uBands - 1.0, 1.0) : h;
  return t < 0.5 ? mix(uTintLow, uTintMid, t * 2.0) : mix(uTintMid, uTintHigh, t * 2.0 - 1.0);
}

float rimMask() {
  float edge = min(min(vUv.x, vUv.y), min(1.0 - vUv.x, 1.0 - vUv.y));
  float px = edge / max(fwidth(edge), 1e-6);
  return 1.0 - smoothstep(uPx * 1.2, uPx * 1.2 + 1.0, px);
}

void main() {
  float h = heightAt(vUv);
  vec2 slope = slopeAt(vUv);
  vec3 color = tintAt(h);
  // A tonal pattern is a darker shade of the colour under it.
  vec3 patternInk = mix(uPatternInk, mix(color, uLine, 0.38), uTonal);
  color = mix(color, patternInk, patternMask(h));
  color = mix(color, uLine, contourMask(h, slope));
  color = mix(color, uLine, rimMask());
  outColor = vec4(color, 1.0);
}
`;

export const lineVertex = `#version 300 es
precision highp float;

// Map-plane position of this end of the segment and of the other end.
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aNeighbour;
// x = side to widen towards, y = distance along the line, z = across (-1..1).
layout(location = 2) in vec3 aLine;

uniform mat4 uMvp;
uniform vec2 uViewport;
uniform float uHalfWidth;

out float vAcross;
out float vDistance;
out float vPxPerUnit;

void main() {
  vec4 p = uMvp * vec4(aPosition.x, 0.0, aPosition.y, 1.0);
  vec4 q = uMvp * vec4(aNeighbour.x, 0.0, aNeighbour.y, 1.0);
  vec2 d = (q.xy - p.xy) * uViewport * 0.5;
  float len = max(length(d), 1e-4);
  vec2 normal = vec2(-d.y, d.x) / len;
  p.xy += normal * aLine.x * uHalfWidth / (uViewport * 0.5);
  vAcross = aLine.z;
  vDistance = aLine.y;
  vPxPerUnit = len / max(distance(aPosition, aNeighbour), 1e-6);
  gl_Position = p;
}
`;

export const lineFragment = `#version 300 es
precision highp float;

in float vAcross;
in float vDistance;
in float vPxPerUnit;

// 0 solid, 1 dashed, 2 dotted, 3 double.
uniform int uStyle;
uniform float uHalfWidth;
uniform float uPeriod;
uniform vec3 uInk;

// Premultiplied alpha.
out vec4 outColor;

void main() {
  float phase = fract(vDistance / uPeriod);
  float alpha = 1.0;
  if (uStyle == 1 && phase > 0.58) discard;
  if (uStyle == 2) {
    float along = (phase - 0.5) * uPeriod * vPxPerUnit;
    alpha = clamp(uHalfWidth - length(vec2(along, vAcross * uHalfWidth)) + 0.5, 0.0, 1.0);
  }
  if (uStyle == 3 && abs(vAcross) < 0.42) discard;
  if (alpha < 0.004) discard;
  outColor = vec4(uInk * alpha, alpha);
}
`;

export const nodeVertex = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;

uniform mat4 uMvp;
// Map-plane centre of the node.
uniform vec2 uCenter;
uniform float uRadius;
// Half-size of the drawn quad in node radii; leaves room for the motion.
uniform float uExtent;

out vec2 vPoint;

void main() {
  vPoint = (aCorner * 2.0 - 1.0) * uExtent;
  vec2 position = uCenter + vPoint * uRadius;
  gl_Position = uMvp * vec4(position.x, 0.0, position.y, 1.0);
}
`;

export const nodeFragment = `#version 300 es
precision highp float;

// Node radii from the node centre.
in vec2 vPoint;

// 0 square, 1 corner brackets, 2 brackets around a square.
uniform int uShape;
// 0 still, 1 pulse, 2 ping, 3 spin.
uniform int uMotion;
// Cycles since the start, offset per node.
uniform float uCycle;
// Stroke width in node radii.
uniform float uEdge;
uniform float uExtent;
uniform vec3 uInk;

// Premultiplied alpha.
out vec4 outColor;

float boxDistance(vec2 p, float size) {
  return max(abs(p.x), abs(p.y)) - size;
}

void main() {
  float aa = max(0.75 * fwidth(vPoint.x), 1e-4);
  float turn = fract(uCycle);
  float outerSize = 0.9;
  vec2 outer = vPoint;
  if (uMotion == 1) outerSize *= 1.0 + 0.14 * sin(turn * 6.2831853);
  if (uMotion == 3) {
    float angle = smoothstep(0.0, 0.55, turn) * 1.5707963;
    outer = vec2(cos(angle) * vPoint.x - sin(angle) * vPoint.y, sin(angle) * vPoint.x + cos(angle) * vPoint.y);
    aa *= 1.4;
  }

  float outerD = boxDistance(outer, outerSize);
  float frame = 1.0 - smoothstep(uEdge * 0.5 - aa, uEdge * 0.5 + aa, abs(outerD));
  vec2 folded = abs(outer);
  float corners = smoothstep(-aa, aa, min(folded.x, folded.y) - outerSize * 0.5);
  float brackets = frame * corners;

  float alpha = 0.0;
  if (uShape == 0) {
    float core = 1.0 - smoothstep(-aa, aa, boxDistance(vPoint, 0.2));
    alpha = max(frame, core);
  } else if (uShape == 1) {
    alpha = brackets;
  } else {
    float core = 1.0 - smoothstep(-aa, aa, boxDistance(vPoint, 0.36));
    alpha = max(brackets, core);
  }

  if (uMotion == 2) {
    // A thin square outline that grows out of the node and fades.
    float ringD = boxDistance(vPoint, mix(0.9, uExtent - uEdge, turn));
    float ring = 1.0 - smoothstep(uEdge * 0.5 - aa, uEdge * 0.5 + aa, abs(ringD));
    alpha = max(alpha, ring * (1.0 - turn) * (1.0 - turn));
  }

  if (alpha < 0.004) discard;
  outColor = vec4(uInk * alpha, alpha);
}
`;
