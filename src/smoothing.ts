import { KEYPOINT_NAMES, type Pose } from "./types";

/**
 * Exponential moving average smoother for pose keypoints.
 * alpha = weight of the NEW frame (1 = no smoothing, 0 = frozen).
 */
export class EmaSmoother {
  private prev: Pose | null = null;
  private alpha: number;

  constructor(alpha = 0.5) {
    this.alpha = alpha;
  }

  setAlpha(alpha: number): void {
    this.alpha = alpha;
  }

  smooth(pose: Pose): Pose {
    if (!this.prev) {
      this.prev = { ...pose };
      return this.prev;
    }
    const a = this.alpha;
    const out: Pose = {};
    for (const name of KEYPOINT_NAMES) {
      const curr = pose[name];
      const prev = this.prev[name];
      if (curr && prev) {
        out[name] = {
          x: a * curr.x + (1 - a) * prev.x,
          y: a * curr.y + (1 - a) * prev.y,
          score: curr.score,
        };
      } else if (curr) {
        out[name] = curr;
      }
    }
    this.prev = out;
    return out;
  }

  reset(): void {
    this.prev = null;
  }
}
