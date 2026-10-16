import { describe, expect, it } from "vitest";
import { Confetti, MAX_CONFETTI, type Paper } from "../src/confetti";
import { Physics, STEP } from "../src/physics";

function setup() {
  const body = new Physics();
  body.resize(600, 400);
  body.launch(true);
  body.complete();
  return { body, confetti: new Confetti() };
}

function paper(x: number, y: number): Paper {
  return {
    x,
    y,
    vx: 0,
    vy: 30,
    angle: 0,
    spin: 0,
    phase: 0,
    age: 0,
    restTime: 0,
    color: 0,
    surface: "air",
    localX: 0,
    localY: 0,
    localAngle: 0,
  };
}

describe("WebGL confetti physics", () => {
  it("bounds repeated bursts and eventually stops the animation", () => {
    const { body, confetti } = setup();
    for (let i = 0; i < 10; i++) confetti.burst(body, () => 0.5);
    expect(confetti.particles).toHaveLength(MAX_CONFETTI);
    for (let i = 0; i < 1300; i++) confetti.step(STEP, body);
    expect(confetti.active).toBe(false);
  });

  it("bounces, settles on the floor and remains still before fading", () => {
    const { body, confetti } = setup();
    const p = paper(40, body.floor - 20);
    p.vy = 150;
    confetti.particles.push(p);
    let bounced = false;
    for (let i = 0; i < 240; i++) {
      confetti.step(STEP, body);
      if (p.vy < 0) bounced = true;
      expect(p.y).toBeLessThanOrEqual(body.floor - 2);
    }
    expect(bounced).toBe(true);
    expect(p.surface).toBe("floor");
    const x = p.x;
    confetti.step(STEP, body);
    expect(p.x).toBe(x);
    expect(p.restTime).toBeGreaterThan(0);
  });

  it("catches paper on the upper triangle edge, follows resize and sheds it on toss", () => {
    const { body, confetti } = setup();
    // Successful orientation has a horizontal upper edge at y - radius / 2.
    const p = paper(body.x, body.y - body.radius / 2 - 4);
    confetti.particles.push(p);
    for (let i = 0; i < 30; i++) confetti.step(STEP, body);
    expect(p.surface).toBe("triangle");
    expect(p.y).toBeCloseTo(body.y - body.radius / 2 - 3.02, 1);
    body.resize(320, 300);
    confetti.step(STEP, body);
    expect(p.y).toBeLessThan(body.y - body.radius / 2);
    body.launch(false);
    confetti.release(body);
    expect(p.surface).toBe("air");
    expect(p.vy).toBeLessThan(0);
  });

  it("does not attach to a moving triangle and can be cleared", () => {
    const { body, confetti } = setup();
    const p = paper(body.x, body.y - body.radius / 2 - 4);
    confetti.particles.push(p);
    body.active = true;
    for (let i = 0; i < 30; i++) confetti.step(STEP, body);
    expect(p.surface).toBe("air");
    confetti.clear();
    expect(confetti.active).toBe(false);
  });
});
