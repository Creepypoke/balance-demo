import { vertices, type Physics } from "./physics";

export const CONFETTI_COLORS = [
  [0.47, 0.84, 0.64],
  [0.96, 0.81, 0.44],
  [0.92, 0.57, 0.49],
  [0.58, 0.73, 0.93],
  [0.76, 0.63, 0.87],
];
export const MAX_CONFETTI = 180;

export interface Paper {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  phase: number;
  age: number;
  restTime: number;
  color: number;
  surface: "air" | "floor" | "triangle";
  localX: number;
  localY: number;
  localAngle: number;
}

/** Lightweight 2D paper simulation, independent of WebGL and the outcome RNG. */
export class Confetti {
  particles: Paper[] = [];

  get active(): boolean {
    return this.particles.length > 0;
  }

  clear(): void {
    this.particles = [];
  }

  burst(body: Physics, random = Math.random): void {
    this.particles = this.particles.slice(-(MAX_CONFETTI - 72));
    for (let i = 0; i < 72; i++) {
      this.particles.push({
        x: body.x + (random() - 0.5) * body.radius * 1.6,
        y: body.y - body.radius - 8 - random() * 12,
        vx: (random() - 0.5) * 350,
        vy: -160 - random() * 250,
        angle: random() * Math.PI,
        spin: (random() - 0.5) * 16,
        phase: random() * Math.PI * 2,
        age: 0,
        restTime: 0,
        color: i % CONFETTI_COLORS.length,
        surface: "air",
        localX: 0,
        localY: 0,
        localAngle: 0,
      });
    }
  }

  /** Attached paper is shed with the body's velocity on the next toss. */
  release(body: Physics): void {
    for (const p of this.particles) {
      if (p.surface !== "triangle") continue;
      p.surface = "air";
      p.vx = body.vx - body.omega * (p.y - body.y);
      p.vy = body.vy + body.omega * (p.x - body.x) - 25;
      p.spin = body.omega;
    }
  }

  step(dt: number, body: Physics): void {
    const points = vertices(body.radius, body.angle);
    for (const p of this.particles) {
      p.age += dt;
      if (p.surface !== "air") {
        p.restTime += dt;
        if (p.surface === "triangle") {
          const c = Math.cos(body.angle),
            s = Math.sin(body.angle);
          p.x = body.x + body.radius * (c * p.localX - s * p.localY);
          p.y = body.y + body.radius * (s * p.localX + c * p.localY);
          p.angle = body.angle + p.localAngle;
        } else p.y = body.floor - 2;
        continue;
      }
      const oldX = p.x,
        oldY = p.y;
      // Drag limits terminal velocity; flutter gives paper a gentle lateral drift.
      p.vx += (Math.sin(p.age * 7 + p.phase) * 45 - p.vx * 1.3) * dt;
      p.vy += (420 - p.vy * 1.8) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.spin *= Math.exp(-0.35 * dt);
      if (p.x < 3 || p.x > body.width - 3) {
        p.x = Math.max(3, Math.min(body.width - 3, p.x));
        p.vx *= -0.25;
      }
      // Only outward-facing upper edges can catch falling paper. Swept contact
      // avoids tunnelling; do not glue paper to a fast-moving triangle.
      if (!body.active)
        for (let i = 0; i < 3; i++) {
          const a = points[i],
            b = points[(i + 1) % 3];
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const length = Math.hypot(dx, dy);
          const nx = dy / length,
            ny = -dx / length;
          if (ny >= -0.05) continue;
          const ax = body.x + a[0],
            ay = body.y + a[1];
          const before = (oldX - ax) * nx + (oldY - ay) * ny - 3;
          const after = (p.x - ax) * nx + (p.y - ay) * ny - 3;
          if (before < -0.01 || after > 0) continue;
          const t = before / (before - after);
          const hitX = oldX + (p.x - oldX) * t;
          const hitY = oldY + (p.y - oldY) * t;
          const along = ((hitX - ax) * dx + (hitY - ay) * dy) / (length * length);
          if (along < 0 || along > 1) continue;
          p.x = hitX + nx * 0.02;
          p.y = hitY + ny * 0.02;
          const speed = p.vx * nx + p.vy * ny;
          if (speed < -90) {
            p.vx = (p.vx - 1.18 * speed * nx) * 0.55;
            p.vy = (p.vy - 1.18 * speed * ny) * 0.55;
            p.spin *= 0.4;
          } else {
            p.surface = "triangle";
            p.angle = Math.atan2(dy, dx);
            const c = Math.cos(body.angle),
              s = Math.sin(body.angle);
            p.localX = ((p.x - body.x) * c + (p.y - body.y) * s) / body.radius;
            p.localY = (-(p.x - body.x) * s + (p.y - body.y) * c) / body.radius;
            p.localAngle = p.angle - body.angle;
            p.vx = p.vy = p.spin = 0;
          }
          break;
        }
      if (p.surface === "air" && p.y >= body.floor - 2) {
        p.y = body.floor - 2;
        if (p.vy > 65) {
          p.vy *= -0.16;
          p.vx *= 0.45;
          p.spin *= 0.3;
        } else {
          p.surface = "floor";
          p.angle = 0;
          p.vx = p.vy = p.spin = 0;
        }
      }
    }
    this.particles = this.particles.filter((p) => p.age < 10 && p.restTime < 5);
  }
}
