import { vertices, type Physics } from "./physics";
import { CONFETTI_COLORS, MAX_CONFETTI, type Confetti } from "./confetti";

const PAPER_VERTEX = `
attribute vec2 a_position;
attribute vec4 a_color;
uniform vec2 u_resolution;
varying vec4 v_color;
void main() {
  vec2 p = a_position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  v_color = a_color;
}`;
const PAPER_FRAGMENT = `precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`;

const VERTEX = `
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_angle;
uniform float u_radius;
varying vec2 v_local;
void main() {
  v_local = a_position;
  float c = cos(u_angle), s = sin(u_angle);
  vec2 p = vec2(c*a_position.x-s*a_position.y, s*a_position.x+c*a_position.y);
  p = (p*u_radius+u_center)/u_resolution*2.0-1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;
const FRAGMENT = `
precision mediump float;
uniform vec4 u_color;
uniform float u_time;
varying vec2 v_local;
void main() {
  float light = 0.97 + 0.07 * (-v_local.y);
  gl_FragColor = vec4(u_color.rgb * light, u_color.a);
}`;
const OUTLINE = `precision mediump float; uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

interface Locations {
  position: number;
  resolution: WebGLUniformLocation | null;
  center: WebGLUniformLocation | null;
  angle: WebGLUniformLocation | null;
  radius: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  color: WebGLUniformLocation | null;
}

function colorToRgba(color: string): Float32Array {
  if (!CSS.supports("color", color)) throw new TypeError(`Неверный цвет: ${color}`);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return new Float32Array(Array.from(ctx.getImageData(0, 0, 1, 1).data, (v) => v / 255));
}

export class Renderer {
  private gl: WebGLRenderingContext;
  private fill: WebGLProgram;
  private line: WebGLProgram;
  private buffer: WebGLBuffer;
  private color: Float32Array;
  private stroke: Float32Array;
  private locations = new Map<WebGLProgram, Locations>();
  private width = 1;
  private height = 1;
  private paper?: WebGLProgram;
  private paperBuffer?: WebGLBuffer;
  private paperColor = -1;
  private paperData?: Float32Array;

  constructor(
    private canvas: HTMLCanvasElement,
    color: string,
    stroke: string,
    fragment?: string,
    confetti = false,
  ) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL недоступен в этом браузере.");
    this.gl = gl;
    this.color = colorToRgba(color);
    this.stroke = colorToRgba(stroke);
    const allocated: WebGLProgram[] = [];
    try {
      this.fill = this.program(fragment ?? FRAGMENT);
      allocated.push(this.fill);
      this.line = this.program(OUTLINE);
      allocated.push(this.line);
      this.buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices(1, 0).flat()), gl.STATIC_DRAW);
      if (confetti) {
        this.paper = this.program(PAPER_FRAGMENT, PAPER_VERTEX);
        allocated.push(this.paper);
        this.paperColor = gl.getAttribLocation(this.paper, "a_color");
        this.paperBuffer = gl.createBuffer()!;
        this.paperData = new Float32Array(MAX_CONFETTI * 6 * 6);
      }
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } catch (error) {
      allocated.forEach((p) => gl.deleteProgram(p));
      throw error;
    }
  }

  private program(fragment: string, vertex = VERTEX): WebGLProgram {
    const gl = this.gl;
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram()!;
    try {
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const) {
        const shader = gl.createShader(type)!;
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(`GLSL: ${gl.getShaderInfoLog(shader)}`);
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(`GLSL: ${gl.getProgramInfoLog(program)}`);
      this.locations.set(program, {
        position: gl.getAttribLocation(program, "a_position"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        center: gl.getUniformLocation(program, "u_center"),
        angle: gl.getUniformLocation(program, "u_angle"),
        radius: gl.getUniformLocation(program, "u_radius"),
        time: gl.getUniformLocation(program, "u_time"),
        color: gl.getUniformLocation(program, "u_color"),
      });
      return program;
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    } finally {
      shaders.forEach((s) => gl.deleteShader(s));
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(body: Physics, time: number, confetti?: Confetti): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    for (const [program, color, primitive] of [
      [this.fill, this.color, gl.TRIANGLES],
      [this.line, this.stroke, gl.LINE_LOOP],
    ] as const) {
      gl.useProgram(program);
      const loc = this.locations.get(program)!;
      gl.enableVertexAttribArray(loc.position);
      gl.vertexAttribPointer(loc.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(loc.resolution, this.width, this.height);
      gl.uniform2f(loc.center, body.x, body.y);
      gl.uniform1f(loc.angle, body.angle);
      gl.uniform1f(loc.radius, body.radius);
      gl.uniform1f(loc.time, time);
      gl.uniform4fv(loc.color, color);
      gl.drawArrays(primitive, 0, 3);
    }
    if (confetti?.active) this.drawConfetti(confetti);
  }

  private drawConfetti(confetti: Confetti): void {
    if (!this.paper || !this.paperBuffer || !this.paperData) return;
    const gl = this.gl,
      data = this.paperData;
    let offset = 0;
    for (const p of confetti.particles) {
      const c = Math.cos(p.angle),
        s = Math.sin(p.angle);
      const h = p.surface === "air" ? 1 + 1.8 * Math.abs(Math.cos(p.age * 9 + p.phase)) : 1;
      const alpha = Math.min(1, (10 - p.age) / 2, (5 - p.restTime) / 2);
      const color = CONFETTI_COLORS[p.color];
      for (const [x, y] of [
        [-3.5, -h],
        [3.5, -h],
        [3.5, h],
        [-3.5, -h],
        [3.5, h],
        [-3.5, h],
      ]) {
        data[offset++] = p.x + c * x - s * y;
        data[offset++] = p.y + s * x + c * y;
        data[offset++] = color[0];
        data[offset++] = color[1];
        data[offset++] = color[2];
        data[offset++] = alpha;
      }
    }
    const loc = this.locations.get(this.paper)!;
    gl.useProgram(this.paper);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.paperBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, offset), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(this.paperColor);
    gl.vertexAttribPointer(this.paperColor, 4, gl.FLOAT, false, 24, 8);
    gl.uniform2f(loc.resolution, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, offset / 6);
    gl.disableVertexAttribArray(this.paperColor);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.fill);
    this.gl.deleteProgram(this.line);
    if (this.paperBuffer) this.gl.deleteBuffer(this.paperBuffer);
    if (this.paper) this.gl.deleteProgram(this.paper);
    this.locations.clear();
  }
}
