import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Pose, KeypointName } from "./types";

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** MediaPipe pose landmark indices → our keypoint names. */
const LANDMARK_INDEX: Record<KeypointName, number> = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

interface MpLandmark {
  x: number;
  y: number;
  visibility?: number;
}

function toPose(landmarks: MpLandmark[]): Pose {
  const pose: Pose = {};
  for (const [name, index] of Object.entries(LANDMARK_INDEX)) {
    const lm = landmarks[index];
    if (lm) {
      pose[name as KeypointName] = { x: lm.x, y: lm.y, score: lm.visibility ?? 1 };
    }
  }
  return pose;
}

export interface PoseTracker {
  /** Detect the pose in the current video frame. Returns null when no person is found. */
  detect(video: HTMLVideoElement, timestampMs: number): Pose | null;
  dispose(): void;
}

/**
 * Create a MediaPipe PoseLandmarker-backed tracker.
 * Tries the GPU delegate first and falls back to CPU.
 */
export async function createPoseTracker(): Promise<PoseTracker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);

  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  let landmarker: PoseLandmarker;
  try {
    landmarker = await create("GPU");
  } catch (err) {
    console.warn("[pose] GPU delegate failed, falling back to CPU:", err);
    landmarker = await create("CPU");
  }

  return {
    detect(video, timestampMs) {
      const result = landmarker.detectForVideo(video, timestampMs);
      return result.landmarks?.length ? toPose(result.landmarks[0]) : null;
    },
    dispose() {
      try {
        landmarker.close();
      } catch (err) {
        console.warn("[pose] close failed:", err);
      }
    },
  };
}
