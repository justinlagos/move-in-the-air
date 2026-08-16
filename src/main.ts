import { createPoseTracker, type PoseTracker } from "./pose";
import {
  DEFAULT_STYLE,
  clearCanvas,
  drawPose,
  poseConfidence,
  resizeCanvas,
  type RenderStyle,
} from "./render";
import { EmaSmoother } from "./smoothing";

// --- DOM ---
const video = document.getElementById("video") as HTMLVideoElement;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const fpsEl = document.getElementById("fps") as HTMLElement;
const latencyEl = document.getElementById("latency") as HTMLElement;
const confidenceEl = document.getElementById("confidence") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const trackingStatusEl = document.getElementById("trackingStatus") as HTMLElement;
const hudEl = document.getElementById("hud") as HTMLElement;
const fullscreenBtn = document.getElementById("fullscreenBtn") as HTMLButtonElement;
const mirrorBtn = document.getElementById("mirrorBtn") as HTMLButtonElement;
const smoothingBtn = document.getElementById("smoothingBtn") as HTMLButtonElement;
const hudBtn = document.getElementById("hudBtn") as HTMLButtonElement;

// --- State ---
const style: RenderStyle = { ...DEFAULT_STYLE };
let smoothingOn = true;
let hudOn = true;
const smoother = new EmaSmoother(0.5);

// --- Controls ---
function updateMirrorBtn(): void {
  mirrorBtn.textContent = `Mirror: ${style.mirror ? "On" : "Off"}`;
}
function updateSmoothingBtn(): void {
  smoothingBtn.textContent = `Smoothing: ${smoothingOn ? "On" : "Off"}`;
}
function updateHudBtn(): void {
  hudBtn.textContent = `HUD: ${hudOn ? "On" : "Off"}`;
  hudEl.style.display = hudOn ? "" : "none";
}

mirrorBtn.addEventListener("click", () => {
  style.mirror = !style.mirror;
  updateMirrorBtn();
});
smoothingBtn.addEventListener("click", () => {
  smoothingOn = !smoothingOn;
  smoother.reset();
  updateSmoothingBtn();
});
hudBtn.addEventListener("click", () => {
  hudOn = !hudOn;
  updateHudBtn();
});
fullscreenBtn.addEventListener("click", async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  if (e.key === "f") fullscreenBtn.click();
  if (e.key === "m") mirrorBtn.click();
  if (e.key === "s") smoothingBtn.click();
  if (e.key === "h") hudBtn.click();
});

window.addEventListener("resize", () => resizeCanvas(canvas));
resizeCanvas(canvas);

// --- Wake lock (keep the screen on while tracking) ---
let wakeLock: WakeLockSentinel | null = null;
async function requestWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch (err) {
    console.warn("[wakeLock] failed:", err);
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wakeLock === null) {
    requestWakeLock();
  }
});

// --- Camera ---
async function startCamera(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise<void>((resolve) => {
    if (video.readyState >= 1) {
      video.play();
      resolve();
      return;
    }
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

// --- Main loop ---
async function main(): Promise<void> {
  let tracker: PoseTracker | null = null;
  try {
    statusEl.textContent = "Requesting camera permission…";
    await startCamera();

    statusEl.textContent = "Loading pose model… (first load takes a few seconds)";
    tracker = await createPoseTracker();

    statusEl.style.display = "none";
    requestWakeLock();
    updateMirrorBtn();
    updateSmoothingBtn();
    updateHudBtn();

    let lastVideoTime = -1;
    let lastFrameAt = performance.now();
    let fpsAvg = 0;
    let latencyAvg = 0;

    const frame = () => {
      const now = performance.now();
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      if (dt > 0) {
        const fps = 1000 / dt;
        fpsAvg = fpsAvg * 0.9 + fps * 0.1;
        fpsEl.textContent = fpsAvg.toFixed(0);
      }

      if (tracker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        const t0 = performance.now();
        const pose = tracker.detect(video, now);
        const detectMs = performance.now() - t0;
        latencyAvg = latencyAvg * 0.85 + detectMs * 0.15;
        latencyEl.textContent = latencyAvg.toFixed(0);

        clearCanvas(canvas);
        if (pose) {
          const drawn = smoothingOn ? smoother.smooth(pose) : pose;
          drawPose(canvas, drawn, style);

          const confidence = poseConfidence(drawn);
          confidenceEl.textContent = confidence.toFixed(2);
          if (confidence > 0.6) {
            trackingStatusEl.textContent = "tracking";
            trackingStatusEl.style.color = "#86efac";
          } else if (confidence > 0.3) {
            trackingStatusEl.textContent = "weak — move closer or improve light";
            trackingStatusEl.style.color = "#fcd34d";
          } else {
            trackingStatusEl.textContent = "very weak";
            trackingStatusEl.style.color = "#fca5a5";
          }
        } else {
          smoother.reset();
          confidenceEl.textContent = "--";
          trackingStatusEl.textContent = "no person detected";
          trackingStatusEl.style.color = "#fca5a5";
        }
      }

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (err) {
    statusEl.textContent =
      "Couldn't start: " +
      (err instanceof Error ? err.message : String(err)) +
      "\n\nMake sure you allowed camera access, then refresh.";
    console.error(err);
  }
}

main();
