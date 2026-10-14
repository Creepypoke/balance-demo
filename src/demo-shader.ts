/** Pearlescent liquid finish for the demo, with slow idle and faster toss animation. */
export const demoFragmentShader = `
precision mediump float;
uniform vec4 u_color;
uniform float u_time;
varying vec2 v_local;

void main() {
  vec2 p = v_local;
  float t = u_time * 1.15;

  // Moving eddies and layered domain warping make the pigment flow like liquid.
  vec2 center = vec2(sin(t * 0.8), cos(t * 0.65)) * 0.22;
  vec2 q = p - center;
  float swirl = exp(-dot(q, q) * 2.2) * sin(t * 0.9) * 1.4;
  q = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl)) * q;
  q += center;
  vec2 waves = vec2(
    sin(q.y * 5.0 + t * 1.3) + sin(q.x * 3.0 - t * 0.8),
    cos(q.x * 4.5 - t) + sin(q.y * 3.5 + t * 0.7)
  );
  q += waves * 0.18;
  float wave = sin(q.x * 4.0 + q.y * 2.5 + t);
  float flow = q.x * 1.8 - q.y * 2.2 + wave * 0.85;
  float pearl = 0.5 + 0.5 * sin(flow * 2.4 - t * 1.2);
  vec3 cool = mix(u_color.rgb, vec3(0.48, 0.70, 0.98), 0.32);
  vec3 warm = mix(u_color.rgb, vec3(1.0, 0.77, 0.85), 0.38);
  vec3 color = mix(cool, warm, pearl);
  color *= 0.82 + 0.18 * (0.5 - p.y * 0.5);

  // Refraction-like highlights travel through the warped liquid, not the rim.
  float reflection = exp(-pow((flow + sin(t) * 0.6) * 1.8, 2.0));
  float ribbon = pow(0.5 + 0.5 * sin(flow * 4.0 + t), 18.0);
  color = mix(color, vec3(1.0, 0.98, 0.94), reflection * 0.48);
  color += ribbon * 0.10;
  float ripple = sin(q.x * 9.0 + q.y * 6.0 - t * 1.6)
    + sin(q.y * 8.0 - q.x * 5.0 + t * 1.2);
  float caustic = pow(1.0 - abs(ripple) * 0.5, 8.0);
  color += caustic * vec3(0.10, 0.13, 0.12);

  // Inward distance to the three edges of the unit equilateral triangle.
  float edge = min(0.5 - p.y, 0.5 + p.y * 0.5 - abs(p.x) * 0.8660254);
  float rim = 1.0 - smoothstep(0.008, 0.055, edge);
  color = mix(color, mix(u_color.rgb, vec3(1.0), 0.72), rim * 0.7);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), u_color.a);
}
`;
