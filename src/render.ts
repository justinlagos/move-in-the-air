import type { Keypoint, KeypointName, Pose } from "./types";

/** Skeleton bones drawn as thick lines. */
const BONES: [KeypointName, KeypointName][] = [
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "rightShoulder"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

/** Joints drawn as filled dots. */
const JOINTS: KeypointName[] = [
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
];

export interface RenderStyle {
  mirror: boolean;
  lineWidth: number;
  lineColor: string;
  jointColor: string;
  headColor: string;
}

export const DEFAULT_STYLE: RenderStyle = {
  mirror: true,
  lineWidth: 10,
  lineColor: "#22d3ee",
  jointColor: "#f0abfc",
  headColor: "#facc15",
};

/** Keypoints below this score are not drawn. */
const MIN_SCORE = 0.3;

/** Size the canvas backing store for the device pixel ratio. */
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth, clientHeight } = canvas;
  canvas.width = Math.round(clientWidth * dpr);
  canvas.height = Math.round(clientHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

export function drawPose(
  canvas: HTMLCanvasElement,
  pose: Pose,
  style: RenderStyle = DEFAULT_STYLE,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const project = (kp: Keypoint) => ({
    px: (style.mirror ? 1 - kp.x : kp.x) * w,
    py: kp.y * h,
  });

  // Bones
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [from, to] of BONES) {
    const a = pose[from];
    const b = pose[to];
    if (!a || !b || a.score < MIN_SCORE || b.score < MIN_SCORE) continue;
    const pa = project(a);
    const pb = project(b);
    ctx.beginPath();
    ctx.moveTo(pa.px, pa.py);
    ctx.lineTo(pb.px, pb.py);
    ctx.stroke();
  }

  // Spine: mid-shoulders to mid-hips
  const midShoulders = midpoint(pose.leftShoulder, pose.rightShoulder);
  const midHips = midpoint(pose.leftHip, pose.rightHip);
  if (midShoulders && midHips) {
    const a = project(midShoulders);
    const b = project(midHips);
    ctx.beginPath();
    ctx.moveTo(a.px, a.py);
    ctx.lineTo(b.px, b.py);
    ctx.stroke();
  }

  // Joints
  ctx.fillStyle = style.jointColor;
  for (const name of JOINTS) {
    const kp = pose[name];
    if (!kp || kp.score < MIN_SCORE) continue;
    const p = project(kp);
    ctx.beginPath();
    ctx.arc(p.px, p.py, style.lineWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head: circle centered between the ears, sized from ear distance
  const nose = pose.nose;
  if (nose && nose.score >= MIN_SCORE) {
    let radius = style.lineWidth * 3;
    if (pose.leftEar && pose.rightEar) {
      const dx = (pose.leftEar.x - pose.rightEar.x) * w;
      const dy = (pose.leftEar.y - pose.rightEar.y) * h;
      radius = Math.max(style.lineWidth * 2, Math.hypot(dx, dy) * 0.9);
    } else if (pose.leftShoulder && pose.rightShoulder) {
      const dx = (pose.leftShoulder.x - pose.rightShoulder.x) * w;
      const dy = (pose.leftShoulder.y - pose.rightShoulder.y) * h;
      radius = Math.hypot(dx, dy) * 0.4;
    }
    const center = midpoint(pose.leftEar, pose.rightEar) ?? nose;
    const p = project(center);
    ctx.fillStyle = style.headColor;
    ctx.beginPath();
    ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function midpoint(a?: Keypoint, b?: Keypoint): Keypoint | null {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    score: Math.min(a.score, b.score),
  };
}

/** Average score across the core body keypoints — the HUD "Confidence" value. */
export function poseConfidence(pose: Pose): number {
  const core: KeypointName[] = [
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftWrist",
    "rightWrist",
  ];
  let sum = 0;
  let count = 0;
  for (const name of core) {
    const kp = pose[name];
    if (kp) {
      sum += kp.score;
      count++;
    }
  }
  return count ? sum / count : 0;
}
