type VisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasm: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: unknown
    ) => Promise<{
      detectForVideo: (
        v: HTMLVideoElement,
        ts: number
      ) => { landmarks?: Array<Array<{ x: number; y: number }>> };
      close?: () => void;
    }>;
  };
};

export async function loadMediapipeVision(): Promise<VisionModule> {
  const url = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/+esm";
  const importer = new Function("u", "return import(u)") as (u: string) => Promise<VisionModule>;
  return importer(url);
}
