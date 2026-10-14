import { describe, expect, it } from "vitest";
import {
  chooseOutcome,
  nearestRestAngle,
  Physics,
  STEP,
  validateRate,
  vertices,
} from "../src/physics";

describe("probability contract", () => {
  it("guarantees both endpoints, without consulting randomness", () => {
    const forbidden = () => {
      throw new Error("Unexpected random");
    };
    expect(chooseOutcome(0, forbidden)).toBe(false);
    expect(chooseOutcome(1, forbidden)).toBe(true);
  });
  it("compares independent samples to rate", () => {
    expect(chooseOutcome(0.4, () => 0.399)).toBe(true);
    expect(chooseOutcome(0.4, () => 0.4)).toBe(false);
  });
  it("rejects invalid rates", () => {
    for (const rate of [-1, 1.01, NaN, Infinity])
      expect(() => validateRate(rate)).toThrow(RangeError);
  });
});

describe("triangle geometry and rigid body", () => {
  it("has equal sides", () => {
    const v = vertices(80, 0.43);
    const lengths = v.map((a, i) => Math.hypot(a[0] - v[(i + 1) % 3][0], a[1] - v[(i + 1) % 3][1]));
    expect(lengths[0]).toBeCloseTo(lengths[1], 9);
    expect(lengths[1]).toBeCloseTo(lengths[2], 9);
  });
  it("selects the closest equivalent final orientation", () => {
    for (let a = -30; a < 30; a += 0.2) {
      for (const success of [true, false])
        expect(Math.abs(nearestRestAngle(a, success) - a)).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
    }
  });
  for (const success of [true, false]) {
    it(`always settles ${success ? "on a vertex" : "on an edge"} across sizes and velocities`, () => {
      for (const [width, height] of [
        [180, 300],
        [320, 300],
        [600, 400],
        [1200, 400],
      ]) {
        for (let trial = 0; trial < 30; trial++) {
          const p = new Physics();
          p.resize(width, height);
          p.launch(success, (trial - 15) * 20, 0.85 + trial / 100);
          for (let step = 0; step < 400 && p.active; step++) p.step(STEP);
          expect(p.active).toBe(false);
          expect(Number.isFinite(p.x + p.y + p.angle)).toBe(true);
          const bottom = vertices(p.radius, p.angle)
            .map((v) => v[1])
            .sort((a, b) => b - a);
          expect(p.y + bottom[0]).toBeCloseTo(p.floor, 8);
          if (success) expect(bottom[0] - bottom[1]).toBeGreaterThan(p.radius);
          else expect(bottom[0]).toBeCloseTo(bottom[1], 8);
        }
      }
    });
  }
  it("preserves final vertex orientation when resized", () => {
    const p = new Physics();
    p.resize(600, 400);
    p.launch(true);
    for (let i = 0; i < 400; i++) p.step(STEP);
    const angle = p.angle;
    p.resize(320, 300);
    expect(p.angle).toBe(angle);
    expect(p.y).toBeCloseTo(p.floor - p.radius, 8);
  });
});
