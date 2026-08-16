# Move in the Air — Spike

Full-body movement tracking in the browser: webcam → MediaPipe Pose Landmarker → stylised skeleton on a canvas. A spike exploring whole-body interaction (the "Draw in the Air" idea, but for the whole body).

Live: https://move-in-the-air-spike.vercel.app

> Note: this source tree was reconstructed from the production deployment bundle
> (the original source folder went missing). Behavior matches the deployed spike 1:1.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
```

Deploy: `vercel` from the project root (static Vite build, no config needed).

## How it works

- `src/pose.ts` — loads MediaPipe `pose_landmarker_lite` (wasm from jsDelivr, model from Google storage), GPU delegate with CPU fallback, maps the 33 landmarks to 17 named keypoints.
- `src/render.ts` — draws the skeleton: cyan bones + spine, pink joints, yellow head circle sized from ear distance. Mirror mode flips x.
- `src/smoothing.ts` — per-keypoint exponential moving average (alpha 0.5), reset when tracking drops.
- `src/main.ts` — camera setup (1280×720 user-facing), render loop with FPS + detect-latency EMAs, HUD, screen wake-lock, controls.

## Controls

`f` fullscreen · `m` mirror · `s` smoothing · `h` HUD (also on-screen buttons).

HUD shows FPS, detect latency (ms), confidence (mean score over core keypoints), and a status line: tracking (>0.6), weak (>0.3), very weak, or no person detected.
