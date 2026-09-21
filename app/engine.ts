export type Landmark = { x: number; y: number };
export type StrokeKind = "forehand" | "backhand";

export const LINKS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28]
];

export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

export function detectBallColor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = 4;
  const data = ctx.getImageData(0, 0, w, h).data;
  let sumX = 0, sumY = 0, count = 0, minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!(r > 140 && g > 150 && b < 110 && g - b > 50 && r - b > 40)) continue;
      sumX += x; sumY += y; count++;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (count < 8) return null;
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 3 || size > Math.min(w, h) * 0.25) return null;
  return { x: sumX / count / w, y: sumY / count / h };
}

export function syntheticScene(now: number) {
  const t = now / 1000;
  const period = 1.45;
  const phase = (t % period) / period;
  const toWall = phase < 0.5;
  const u = toWall ? phase * 2 : (phase - 0.5) * 2;
  const ease = toWall ? u * u : 1 - (1 - u) * (1 - u);
  const px = 0.28, py = 0.62;
  const wx = 0.78, wy = 0.28 + Math.sin(t * 7) * 0.01;
  const ball = {
    x: px + (wx - px) * (toWall ? ease : 1 - ease),
    y: py - 0.08 + (wy - (py - 0.08)) * (toWall ? ease : 1 - ease) + Math.sin(u * Math.PI) * 0.04
  };
  const swing = Math.sin(phase * Math.PI * 2);
  const pose: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.3, y: 0.5 }));
  pose[0] = { x: px, y: py - 0.28 };
  pose[11] = { x: px - 0.05, y: py - 0.16 };
  pose[12] = { x: px + 0.05, y: py - 0.16 };
  pose[13] = { x: px - 0.08, y: py - 0.02 };
  pose[14] = { x: px + 0.09 + swing * 0.05, y: py - 0.04 };
  pose[15] = { x: px - 0.07, y: py + 0.08 };
  pose[16] = { x: px + 0.12 + swing * 0.08, y: py - 0.02 };
  pose[23] = { x: px - 0.03, y: py + 0.02 };
  pose[24] = { x: px + 0.03, y: py + 0.02 };
  pose[25] = { x: px - 0.04, y: py + 0.18 };
  pose[26] = { x: px + 0.05, y: py + 0.18 };
  pose[27] = { x: px - 0.05, y: py + 0.34 };
  pose[28] = { x: px + 0.06, y: py + 0.34 };
  return { ball, pose };
}

export function classifyStroke(
  pose: Landmark[] | null,
  ball: Landmark,
  hand: "right" | "left"
): StrokeKind {
  if (!pose) return "forehand";
  const lw = pose[15], rw = pose[16], ls = pose[11], rs = pose[12];
  if (!lw || !rw || !ls || !rs) return "forehand";
  const midX = (ls.x + rs.x) / 2;
  const dominant = hand === "right" ? rw : lw;
  const other = hand === "right" ? lw : rw;
  if (dist(ball, other) + 0.04 < dist(ball, dominant)) return "backhand";
  return hand === "right"
    ? ball.x >= midX - 0.02 ? "forehand" : "backhand"
    : ball.x <= midX + 0.02 ? "forehand" : "backhand";
}

export function drawCourt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#12331f");
  g.addColorStop(1, "#0b1a12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.62, h * 0.08, w * 0.3, h * 0.55);
  ctx.fillStyle = "rgba(200,245,66,.12)";
  ctx.fillRect(w * 0.73, h * 0.22, w * 0.08, h * 0.14);
}

export function drawStick(ctx: CanvasRenderingContext2D, pose: Landmark[], w: number, h: number) {
  ctx.strokeStyle = "rgba(79,209,197,.85)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [a, b] of LINKS) {
    const pa = pose[a], pb = pose[b];
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
}
