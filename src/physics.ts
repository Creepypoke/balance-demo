const TAU = Math.PI * 2;
export const STEP = 1 / 120;
const GRAVITY = 1050;
const ROCK_TIME = 0.55;
const PERIOD = TAU / 3;

interface Landing {
  elapsed: number;
  duration: number;
  rotationDuration: number;
  angle: number;
  omega: number;
  target: number;
}

// Hermite rotation preserves the incoming angular velocity and reaches the
// selected contact orientation with zero angular velocity, still in the air.
function rotation(plan: Landing, time: number): [number, number] {
  const t = Math.min(1, time / plan.rotationDuration);
  const delta = plan.target - plan.angle;
  const tangent = plan.omega * plan.rotationDuration;
  return [
    plan.angle + delta * (3 * t * t - 2 * t * t * t) + tangent * (t * t * t - 2 * t * t + t),
    (delta * (6 * t - 6 * t * t) + tangent * (3 * t * t - 4 * t + 1)) / plan.rotationDuration,
  ];
}

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

/** Ballistic flight with airborne guidance; no rotation from an edge to a vertex on the floor. */
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
  private landing: Landing | null = null;
  private contact: { elapsed: number; x: number; angle: number; amplitude: number } | null = null;

  resize(width: number, height: number): void {
    this.width = width;
    this.floor = height - 42;
    this.radius = Math.min(78, width * 0.19, height * 0.2);
    if (!this.active) this.rest();
    else {
      this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
      this.y = Math.min(this.y, this.floor - this.radius);
      // A resize changes the ballistic contact time. Replan from current state.
      this.landing = null;
      if (this.contact) {
        this.contact.x = this.x;
        this.y = this.floor - Math.max(...vertices(this.radius, this.angle).map((v) => v[1]));
      }
    }
  }

  private rest(): void {
    const points = vertices(this.radius, this.angle);
    const maxY = Math.max(...points.map((v) => v[1]));
    this.x = Math.max(
      12 - Math.min(...points.map((v) => v[0])),
      Math.min(this.width - 12 - Math.max(...points.map((v) => v[0])), this.x || this.width / 2),
    );
    this.y = this.floor - maxY;
  }

  launch(success: boolean, horizontal = 0, power = 1, random = Math.random): void {
    this.active = true;
    this.success = success;
    this.elapsed = 0;
    this.landing = null;
    this.contact = null;
    this.vx = horizontal + (random() - 0.5) * 110;
    this.vy =
      -Math.min(620, Math.sqrt(2 * GRAVITY * Math.max(40, this.floor - this.radius * 2.5))) * power;
    this.omega = (random() > 0.5 ? 1 : -1) * (5 + random() * 6);
  }

  /** Used only for reduced-motion preferences, not for animated throws. */
  complete(): void {
    this.angle = nearestRestAngle(this.angle, this.success);
    this.vx = this.vy = this.omega = 0;
    this.active = false;
    this.landing = this.contact = null;
    this.rest();
  }

  private planLanding(): Landing {
    const targetY = this.floor - this.radius * (this.success ? 1 : 0.5);
    const distance = Math.max(0.1, targetY - this.y);
    const duration = Math.max(
      STEP,
      (Math.sqrt(this.vy * this.vy + 2 * GRAVITY * distance) - this.vy) / GRAVITY,
    );
    const direction = Math.sign(this.omega) || 1;
    // Try contact-compatible rotations. Clearance is checked before committing:
    // the final contact must be the first floor contact, even on a narrow scene.
    for (const fraction of [1, 0.85, 0.7, 0.55, 0.4]) {
      const rotationDuration = duration * fraction;
      let target = nearestRestAngle(this.angle + this.omega * rotationDuration * 0.5, this.success);
      while ((target - this.angle) * direction < Math.abs(this.omega * rotationDuration) / 3)
        target += direction * PERIOD;
      const plan: Landing = {
        elapsed: 0,
        duration,
        rotationDuration,
        angle: this.angle,
        omega: this.omega,
        target,
      };
      let clear = true;
      for (let i = 1; i < 80; i++) {
        const t = (duration * i) / 80;
        const angle = rotation(plan, t)[0];
        const y = this.y + this.vy * t + (GRAVITY * t * t) / 2;
        if (y + Math.max(...vertices(this.radius, angle).map((v) => v[1])) > this.floor + 0.001) {
          clear = false;
          break;
        }
      }
      if (clear) return plan;
    }
    // Defensive short-airtime fallback after a resize. Ordinary throws use
    // the clearance-checked path above.
    return {
      elapsed: 0,
      duration,
      rotationDuration: duration * 0.25,
      angle: this.angle,
      omega: this.omega,
      target: nearestRestAngle(this.angle, this.success),
    };
  }

  private rock(dt: number): void {
    const contact = this.contact!;
    contact.elapsed += dt;
    const t = contact.elapsed;
    const offset = contact.amplitude * Math.exp(-10 * t) * Math.sin(19 * t);
    this.angle = contact.angle + offset;
    const points = vertices(this.radius, this.angle);
    const bottom = points.reduce((a, b) => (a[1] > b[1] ? a : b));
    const basePoints = vertices(this.radius, contact.angle);
    const index = points.indexOf(bottom);
    // Rock around the actual contact point, not around the centre of mass.
    this.x = contact.x + basePoints[index][0] - bottom[0];
    this.y = this.floor - bottom[1];
    if (t >= ROCK_TIME) {
      this.angle = contact.angle;
      this.x = contact.x;
      this.vx = this.vy = this.omega = 0;
      this.active = false;
      this.contact = null;
      this.rest();
    }
  }

  /** Returns collision strength; caller owns sound/haptics. */
  step(dt: number): number {
    if (!this.active) return 0;
    this.elapsed += dt;
    let impact = 0;
    if (this.contact) {
      this.rock(dt);
      return 0;
    }
    // Clear the ceiling before planning descent, so a changing orientation
    // cannot make the guided body poke through the upper boundary.
    if (!this.landing && this.vy >= 0 && this.y >= this.radius + 12)
      this.landing = this.planLanding();
    if (this.landing) {
      const plan = this.landing;
      const advance = Math.min(dt, plan.duration - plan.elapsed);
      this.y += this.vy * advance + (GRAVITY * advance * advance) / 2;
      this.vy += GRAVITY * advance;
      this.x += this.vx * advance;
      plan.elapsed += advance;
      [this.angle, this.omega] = rotation(plan, plan.elapsed);
      // Side walls affect translation without resetting the planned spin. No
      // centre-seeking force: the triangle keeps the actual landing location.
      const points = vertices(this.radius, this.angle);
      const minX = Math.min(...points.map((v) => v[0]));
      const maxX = Math.max(...points.map((v) => v[0]));
      if (this.x + minX < 12) {
        this.x = 12 - minX;
        impact = Math.abs(this.vx);
        this.vx = Math.abs(this.vx) * 0.55;
      } else if (this.x + maxX > this.width - 12) {
        this.x = this.width - 12 - maxX;
        impact = Math.abs(this.vx);
        this.vx = -Math.abs(this.vx) * 0.55;
      }
      if (plan.elapsed >= plan.duration - 1e-8) {
        impact = Math.max(impact, this.vy);
        this.angle = plan.target;
        this.y = this.floor - this.radius * (this.success ? 1 : 0.5);
        this.contact = {
          elapsed: 0,
          x: this.x,
          angle: this.angle,
          amplitude: (this.success ? 0.065 : 0.16) * (Math.sign(plan.omega) || 1),
        };
        this.landing = null;
        this.vx = this.vy = this.omega = 0;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt + (GRAVITY * dt * dt) / 2;
      this.vy += GRAVITY * dt;
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
    }
    return impact;
  }
}
