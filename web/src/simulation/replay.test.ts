import { describe, it, expect } from "vitest";
import { samples, pose, phase } from "./replay";
import type { Replay } from "./types";
describe("replay presentation", () => {
  it("interpolates angles across the wrap and removes vehicles at the end", () => {
    const r = {
      duration: 1,
      period: 1,
      frames: [[[0, 0, 2, 3.13, 0, 0]], [[0, 2, 4, -3.13, 0.1, 0]]],
    } as Replay;
    const v = samples(r, 0.5)[0];
    expect(v[1]).toBe(1);
    expect(v[2]).toBe(3);
    expect(Math.abs(v[3])).toBeCloseTo(Math.PI);
    expect(samples({ ...r, frames: [r.frames[0], []] }, 0.8)).toEqual([]);
  });
  it("uses the exact exported arc-length measure for the front bumper", () => {
    expect(
      pose(
        {
          path: [
            [0, 0],
            [3, 4],
            [6, 4],
          ],
          prefix: [0, 5, 8],
        },
        6,
      ),
    ).toEqual([4, 4, 0]);
  });
  it("shows the same phase transitions as the vehicle controller", () => {
    expect(
      [0, 29.9, 30, 66.9, 67, 70.9, 71, 80].map((t) => phase(t).color),
    ).toEqual([
      "red",
      "red",
      "green",
      "green",
      "yellow",
      "yellow",
      "red",
      "red",
    ]);
  });
});
