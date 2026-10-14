/** Static procedural wood grain: no textures and no idle animation needed. */
export const demoWoodFragmentShader = `
precision mediump float;
uniform vec4 u_color;
varying vec2 v_local;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 437.5453);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 p = v_local;
  vec2 knot = p - vec2(0.20, -0.15);
  float knotShape = length(knot * vec2(1.0, 0.42));
  float bend = exp(-knotShape * 5.5);
  float fibers = p.x + sin(p.y * 3.0) * 0.035
    + noise(p * vec2(3.0, 1.5)) * 0.12 + bend * 0.22;
  float rings = 0.5 + 0.5 * sin(fibers * 65.0);
  float grain = pow(rings, 7.0);
  float fine = noise(vec2(fibers * 150.0, p.y * 5.0));
  float streaks = smoothstep(0.58, 0.88, fine);

  vec3 honey = vec3(0.76, 0.49, 0.25);
  vec3 heartwood = vec3(0.36, 0.18, 0.075);
  vec3 color = mix(honey, heartwood, grain * 0.48 + streaks * 0.18);
  color *= 0.9 + noise(p * vec2(5.0, 2.0)) * 0.18;
  float knotCore = 1.0 - smoothstep(0.012, 0.07, knotShape);
  color = mix(color, heartwood * 0.7, knotCore * 0.75);
  // A subtle stain preserves the selected swatch without hiding the wood.
  color *= mix(vec3(1.0), u_color.rgb, 0.18);

  float edge = min(0.5 - p.y, 0.5 + p.y * 0.5 - abs(p.x) * 0.8660254);
  float bevel = 1.0 - smoothstep(0.008, 0.045, edge);
  color *= 1.0 - bevel * 0.18;
  float sheen = exp(-pow((p.x + p.y * 0.35 + 0.25) * 2.8, 2.0));
  color += vec3(1.0, 0.85, 0.62) * (sheen * 0.12 + bevel * 0.08);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), u_color.a);
}
`;
