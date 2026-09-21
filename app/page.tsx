"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  classifyStroke,
  clamp,
  detectBallColor,
  dist,
  drawCourt,
  drawStick,
  syntheticScene,
  type Landmark
} from "./engine";
import { loadMediapipeVision } from "./loadVision";

type Mode = "idle" | "demo" | "camera" | "video";
type Stroke = { t: number; kind: "forehand" | "backhand"; speedKmh: number; wallX: number; wallY: number };
type PoseAPI = { detectForVideo: (v: HTMLVideoElement, ts: number) => { landmarks?: Landmark[][] }; close?: () => void };

export default function Page() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<PoseAPI | null>(null);
  const rafRef = useRef(0);
  const lastStrokeAt = useRef(0);
  const lastBall = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>("idle");
  const hudTick = useRef(0);
  const distanceRef = useRef(6);
  const handRef = useRef<"right" | "left">("right");

  const [mode, setMode] = useState<Mode>("idle");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Cargando MediaPipe…");
  const [fps, setFps] = useState(0);
  const [ballLock, setBallLock] = useState(false);
  const [poseLock, setPoseLock] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [distanceM, setDistanceM] = useState(6);
  const [handedness, setHandedness] = useState<"right" | "left">("right");

  const stats = useMemo(() => {
    const fh = strokes.filter((s) => s.kind === "forehand").length;
    const bh = strokes.filter((s) => s.kind === "backhand").length;
    const avg = strokes.length ? strokes.reduce((a, s) => a + s.speedKmh, 0) / strokes.length : 0;
    const peak = strokes.reduce((a, s) => Math.max(a, s.speedKmh), 0);
    return { fh, bh, avg, peak, total: strokes.length };
  }, [strokes]);

  function changeMode(next: Mode) {
    modeRef.current = next;
    setMode(next);
  }

  useEffect(() => { distanceRef.current = distanceM; }, [distanceM]);
  useEffect(() => { handRef.current = handedness; }, [handedness]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await loadMediapipeVision();
        const vision = await mod.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
        );
        const landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        if (cancelled) return landmarker.close?.();
        poseRef.current = landmarker;
        setReady(true);
        setStatus("Listo. Elegí Demo, Cámara o un video.");
      } catch (err) {
        console.error(err);
        setReady(true);
        setStatus("MediaPipe no cargó. Igual podés usar Demo.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      poseRef.current?.close?.();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function resetSession() {
    setStrokes([]);
    setSpeed(0);
    lastStrokeAt.current = 0;
    lastBall.current = null;
  }

  async function startCamera() {
    resetSession();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    streamRef.current = stream;
    const video = videoRef.current!;
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    changeMode("camera");
    setStatus("Cámara activa. Pelota amarilla a la vista.");
    loop();
  }

  async function startVideo(file: File) {
    resetSession();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const video = videoRef.current!;
    video.srcObject = null;
    video.src = url;
    video.muted = true;
    await video.play();
    changeMode("video");
    setStatus("Analizando video…");
    loop();
  }

  function startDemo() {
    resetSession();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const video = videoRef.current!;
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
    changeMode("demo");
    setStatus("Demo sintética: rally contra la pared.");
    loop();
  }

  function stopAll() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    videoRef.current?.pause();
    changeMode("idle");
    setStatus("Pausado.");
  }

  function loop() {
    cancelAnimationFrame(rafRef.current);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      hudTick.current += 1;
      if (hudTick.current % 8 === 0 && dt > 0) setFps(Math.round(1 / Math.max(dt, 0.001)));
      drawFrame(now, dt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function maybeStroke(now: number, ball: { x: number; y: number; vx: number; vy: number }, pose: Landmark[] | null) {
    if (now - lastStrokeAt.current < 550) return;
    const prev = lastBall.current;
    if (!prev) return;
    const bounce = prev.vx > 0.08 && ball.vx < -0.04;
    const nearHand = !pose || [pose[15], pose[16]].some((w) => w && dist(w, ball) < 0.16);
    if (!bounce && !nearHand) return;
    if (Math.abs(ball.vx) < 0.05 && Math.abs(prev.vx) < 0.05) return;
    const speedKmh = clamp(Math.hypot(ball.vx, ball.vy) * distanceRef.current * 3.6 * 0.55, 18, 145);
    lastStrokeAt.current = now;
    setStrokes((s) =>
      [...s, {
        t: now,
        kind: classifyStroke(pose, ball, handRef.current),
        speedKmh,
        wallX: clamp(ball.x, 0.05, 0.95),
        wallY: clamp(ball.y, 0.05, 0.95)
      }].slice(-80)
    );
  }

  function drawFrame(now: number, dt: number) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const w = canvas.clientWidth || 960;
    const h = canvas.clientHeight || 600;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, 0, w, h);

    let pose: Landmark[] | null = null;
    let ball: Landmark | null = null;
    const currentMode = modeRef.current;

    if (currentMode === "demo") {
      const scene = syntheticScene(now);
      drawCourt(ctx, w, h);
      drawStick(ctx, scene.pose, w, h);
      ctx.fillStyle = "#d6ff3a";
      ctx.beginPath();
      ctx.arc(scene.ball.x * w, scene.ball.y * h, 9, 0, Math.PI * 2);
      ctx.fill();
      pose = scene.pose;
      ball = scene.ball;
    } else if (video && (currentMode === "camera" || currentMode === "video") && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, w, h);
      ball = detectBallColor(ctx, w, h);
      if (poseRef.current) {
        try { pose = poseRef.current.detectForVideo(video, now).landmarks?.[0] ?? null; } catch { pose = null; }
      }
    } else {
      drawCourt(ctx, w, h);
      ctx.fillStyle = "#8b9bb0";
      ctx.font = "16px IBM Plex Sans";
      ctx.fillText("Esperando fuente de video…", 24, 40);
    }

    if (pose && currentMode !== "demo") drawStick(ctx, pose, w, h);

    if (ball) {
      const prev = lastBall.current;
      const vx = prev ? (ball.x - prev.x) / Math.max(dt, 0.001) : 0;
      const vy = prev ? (ball.y - prev.y) / Math.max(dt, 0.001) : 0;
      const tracked = {
        x: prev ? prev.x * 0.35 + ball.x * 0.65 : ball.x,
        y: prev ? prev.y * 0.35 + ball.y * 0.65 : ball.y,
        vx, vy
      };
      const kmh = clamp(Math.hypot(vx, vy) * distanceRef.current * 3.6 * 0.55, 0, 160);
      maybeStroke(now, tracked, pose);
      lastBall.current = tracked;
      if (hudTick.current % 8 === 0) {
        setSpeed(kmh);
        setBallLock(true);
        setPoseLock(Boolean(pose));
      }
      ctx.strokeStyle = "#c8f542";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tracked.x * w, tracked.y * h, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#c8f542";
      ctx.font = "12px IBM Plex Sans";
      ctx.fillText(`${kmh.toFixed(0)} km/h`, tracked.x * w + 18, tracked.y * h - 8);
    } else if (hudTick.current % 8 === 0) {
      setBallLock(false);
      setPoseLock(Boolean(pose));
    }

    if (pose?.[15]) { ctx.fillStyle = "#4fd1c5"; ctx.beginPath(); ctx.arc(pose[15].x * w, pose[15].y * h, 5, 0, Math.PI * 2); ctx.fill(); }
    if (pose?.[16]) { ctx.fillStyle = "#f5b942"; ctx.beginPath(); ctx.arc(pose[16].x * w, pose[16].y * h, 5, 0, Math.PI * 2); ctx.fill(); }

    ctx.fillStyle = "rgba(7,9,13,.55)";
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = "#8b9bb0";
    ctx.font = "12px IBM Plex Sans";
    ctx.fillText(`${currentMode.toUpperCase()}  ·  pose ${pose ? "OK" : "—"}  ·  ball ${ball ? "OK" : "—"}`, 12, h - 10);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">CV</div>
          <div>
            <h1>TENNIS CV LAB</h1>
            <p>Tracker de práctica contra la pared · corre en el browser</p>
          </div>
        </div>
        <div className="chip">{status}</div>
      </header>
      <main className="workspace">
        <section className="stage">
          <div className="viewport">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            <div className="hud">
              <span className={`chip ${mode !== "idle" ? "live" : ""}`}>{mode === "idle" ? "IDLE" : mode.toUpperCase()}</span>
              <span className="chip">{fps} fps</span>
              <span className="chip">pose {poseLock ? "lock" : "off"}</span>
              <span className="chip">ball {ballLock ? "lock" : "off"}</span>
            </div>
          </div>
          <div className="controls">
            <button className="btn primary" disabled={!ready} onClick={startDemo}>Probar demo</button>
            <button className="btn" disabled={!ready} onClick={startCamera}>Cámara</button>
            <label className="file btn">
              Subir video
              <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) startVideo(f); }} />
            </label>
            <button className="btn" onClick={stopAll}>Pausar</button>
            <button className="btn" onClick={resetSession}>Reset stats</button>
          </div>
        </section>
        <aside className="side">
          <div className="kpis">
            <div className="kpi"><span>Golpes</span><strong>{stats.total}</strong></div>
            <div className="kpi"><span>Velocidad</span><strong>{speed.toFixed(0)}</strong></div>
            <div className="kpi"><span>Peak km/h</span><strong>{stats.peak.toFixed(0)}</strong></div>
            <div className="kpi"><span>Promedio</span><strong>{stats.avg.toFixed(0)}</strong></div>
          </div>
          <div className="section">
            <h3>Split</h3>
            <div className="row"><span>Forehand</span><strong>{stats.fh}</strong></div>
            <div className="row"><span>Backhand</span><strong>{stats.bh}</strong></div>
          </div>
          <div className="section">
            <h3>Impactos en pared</h3>
            <div className="shots">
              {strokes.slice(-24).map((s) => (
                <span key={s.t} className="dot" title={`${s.kind} ${s.speedKmh.toFixed(0)} km/h`} style={{ background: s.kind === "forehand" ? "#c8f542" : "#4fd1c5" }} />
              ))}
            </div>
          </div>
          <label className="field">
            Distancia jugador-pared (m)
            <input type="number" min={2} max={16} step={0.5} value={distanceM} onChange={(e) => setDistanceM(Number(e.target.value) || 6)} />
          </label>
          <label className="field">
            Mano habil
            <select value={handedness} onChange={(e) => setHandedness(e.target.value as "right" | "left")} style={{ background: "#0b1016", color: "white", border: "1px solid #243041", borderRadius: 8, padding: 8 }}>
              <option value="right">Derecha</option>
              <option value="left">Zurda</option>
            </select>
          </label>
          <p className="note">Lab en Vercel. Demo para validar overlays. Camara/video: MediaPipe + pelota amarilla. No es el pipeline Python/Roboflow original.</p>
        </aside>
      </main>
    </div>
  );
}
