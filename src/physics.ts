const TAU = Math.PI * 2;
export const STEP = 1 / 120;
export const FLIGHT_TIME = 1.65;
const SETTLE_TIME = 0.5;

export function validateRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError("successRate должен быть числом от 0 до 1.");
  }
  return rate;
}

export function chooseOutcome(rate: number, random = Math.random): boolean {
  return rate === 1 || (rate !== 0 && random() < rate);
}

export function vertices(radius: number, angle: number): [number, number][] {
  return [0, 1, 2].map((i) => {
    const a = angle - Math.PI / 2 + (i * TAU) / 3;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

export function nearestRestAngle(angle: number, success: boolean): number {
  const base = success ? Math.PI / 3 : 0;
  const period = TAU / 3;
  return base + Math.round((angle - base) / period) * period;
}

/** Small 2D rigid-body solver. Assisted settlement deliberately overrides passive physics. */
export class Physics {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  omega = 0;
  elapsed = 0;
  active = false;
  success = false;
  width = 0;
  floor = 0;
  radius = 0;
  private settle: { x: number; y: number; angle: number; target: number } | null = null;

  resize(width: number, height: number): void {
    this.width = width;
    this.floor = height - 42;
    this.radius = Math.min(78, width * 0.19, height * 0.2);
    if (!this.active) this.rest();
    else {
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
      this.y = Math.min(this.y, this.floor - this.radius);
      if (this.settle)
        this.settle = {
          x: this.x,
          y: this.y,
          angle: this.angle,
          target: nearestRestAngle(this.angle, this.success),
        };
    }
  }

  private rest(): void {
    const maxY = Math.max(...vertices(this.radius, this.angle).map((v) => v[1]));
    this.x = this.width / 2;
    this.y = this.floor - maxY;
  }

  launch(success: boolean, horizontal = 0, power = 1, random = Math.random): void {
    this.active = true;
    this.success = success;
    this.elapsed = 0;
    this.settle = null;
    this.vx = horizontal + (random() - 0.5) * 110;
    this.vy =
      -Math.min(620, Math.sqrt(2 * 1050 * Math.max(40, this.floor - this.radius * 2.5))) * power;
    this.omega = (random() > 0.5 ? 1 : -1) * (5 + random() * 6);
  }

  /** Returns collision strength; caller owns sound/haptics. */
  step(dt: number): number {
    if (!this.active) return 0;
    this.elapsed += dt;
    let impact = 0;
    if (this.elapsed < FLIGHT_TIME) {
      this.vy += 1050 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += this.omega * dt;
      for (let pass = 0; pass < 3; pass++) {
        for (const [rx, ry] of vertices(this.radius, this.angle)) {
          const px = this.x + rx;
          const py = this.y + ry;
          let nx = 0,
            ny = 0,
            penetration = 0;
          if (py > this.floor) {
            ny = -1;
            penetration = py - this.floor;
          } else if (py < 10) {
            ny = 1;
            penetration = 10 - py;
          } else if (px < 12) {
            nx = 1;
            penetration = 12 - px;
          } else if (px > this.width - 12) {
            nx = -1;
            penetration = px - this.width + 12;
          }
          if (!penetration) continue;
          this.x += nx * penetration;
          this.y += ny * penetration;
          const vn = (this.vx - this.omega * ry) * nx + (this.vy + this.omega * rx) * ny;
          if (vn >= 0) continue;
          impact = Math.max(impact, -vn);
          const cross = rx * ny - ry * nx;
          const inertia = (this.radius * this.radius) / 4;
          const impulse = (-(1 + 0.43) * vn) / (1 + (cross * cross) / inertia);
          this.vx += impulse * nx;
          this.vy += impulse * ny;
          this.omega += (cross * impulse) / inertia;
          this.vx *= 0.94;
          this.omega *= 0.97;
        }
      }
    } else {
      this.settle ??= {
        x: this.x,
        y: this.y,
        angle: this.angle,
        target: nearestRestAngle(this.angle, this.success),
      };
      const t = Math.min(1, (this.elapsed - FLIGHT_TIME) / SETTLE_TIME);
      const eased = t * t * (3 - 2 * t);
      this.angle = this.settle.angle + (this.settle.target - this.settle.angle) * eased;
      this.x = this.settle.x + (this.width / 2 - this.settle.x) * eased;
      const maxY = Math.max(...vertices(this.radius, this.angle).map((v) => v[1]));
      const targetY = this.floor - maxY;
      this.y = Math.min(targetY, this.settle.y + (targetY - this.settle.y) * eased);
      if (t === 1) {
        this.active = false;
        this.vx = this.vy = this.omega = 0;
        this.rest();
      }
    }
    return impact;
  }
}
