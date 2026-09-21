#!/usr/bin/env python3
"""Detecta lineas de cancha de tenis (polvo) con OpenCV.

Uso:
  python scripts/detect_court_lines.py foto.jpg
  python scripts/detect_court_lines.py clip.mp4 --every 15 --out out/
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def resize_max(img: np.ndarray, max_w: int = 1280):
    h, w = img.shape[:2]
    if w <= max_w:
        return img, 1.0
    scale = max_w / w
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA), scale


def white_line_mask(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    v = clahe.apply(v)
    by_color = cv2.inRange(cv2.merge([h, s, v]), (0, 0, 165), (180, 70, 255))
    gray = clahe.apply(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    local = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, -12)
    mask = cv2.bitwise_and(by_color, local)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    return mask


def hough_segments(mask: np.ndarray):
    edges = cv2.Canny(mask, 50, 150)
    raw = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=70, minLineLength=50, maxLineGap=18)
    if raw is None:
        return []
    return [tuple(map(int, row[0])) for row in raw]


def line_angle(seg):
    x1, y1, x2, y2 = seg
    return float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))


def line_len(seg):
    x1, y1, x2, y2 = seg
    return float(np.hypot(x2 - x1, y2 - y1))


def classify(seg):
    a = abs(line_angle(seg))
    if a > 90:
        a = 180 - a
    if a < 25:
        return "horiz"
    if a > 65:
        return "vert"
    return "diag"


def _dist_point_seg(px, py, x1, y1, x2, y2):
    vx, vy = x2 - x1, y2 - y1
    den = vx * vx + vy * vy
    if den == 0:
        return float(np.hypot(px - x1, py - y1))
    t = max(0.0, min(1.0, ((px - x1) * vx + (py - y1) * vy) / den))
    return float(np.hypot(px - (x1 + t * vx), py - (y1 + t * vy)))


def _near(group, t, gap):
    for g in group:
        for px, py in ((t[0], t[1]), (t[2], t[3])):
            if _dist_point_seg(px, py, g[0], g[1], g[2], g[3]) < gap:
                return True
    return False


def merge_collinear(segs, gap=28.0):
    if not segs:
        return []
    used = [False] * len(segs)
    out = []
    for i, s in enumerate(segs):
        if used[i]:
            continue
        group = [s]
        used[i] = True
        changed = True
        while changed:
            changed = False
            for j, t in enumerate(segs):
                if used[j] or classify(s) != classify(t):
                    continue
                if _near(group, t, gap):
                    group.append(t)
                    used[j] = True
                    changed = True
        xs = [p for g in group for p in (g[0], g[2])]
        ys = [p for g in group for p in (g[1], g[3])]
        if classify(s) == "horiz":
            y = int(np.median(ys))
            out.append((min(xs), y, max(xs), y))
        elif classify(s) == "vert":
            x = int(np.median(xs))
            out.append((x, min(ys), x, max(ys)))
        else:
            out.append(s)
    out.sort(key=line_len, reverse=True)
    return out


def _seg_intersect(a, b):
    x1, y1, x2, y2 = map(float, a)
    x3, y3, x4, y4 = map(float, b)
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-6:
        return None
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    if min(x1, x2) - 12 <= px <= max(x1, x2) + 12 and min(y1, y2) - 12 <= py <= max(y1, y2) + 12:
        if min(x3, x4) - 12 <= px <= max(x3, x4) + 12 and min(y3, y4) - 12 <= py <= max(y3, y4) + 12:
            return int(px), int(py)
    return None


def intersections(horiz, vert):
    pts = []
    for h in horiz:
        for v in vert:
            p = _seg_intersect(h, v)
            if p:
                pts.append(p)
    return pts


def _order_quad(pts):
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(diff)], pts[np.argmax(s)], pts[np.argmax(diff)]], dtype=np.float32)


def court_quad(points, shape):
    if len(points) < 4:
        return None
    pts = np.array(points, dtype=np.float32)
    hull = cv2.convexHull(pts)
    if hull is None or len(hull) < 4:
        return None
    peri = cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, 0.05 * peri, True)
    if len(approx) != 4:
        approx = cv2.boxPoints(cv2.minAreaRect(pts)).reshape(-1, 1, 2)
    h, w = shape[:2]
    if cv2.contourArea(approx.astype(np.float32)) < 0.08 * w * h:
        return None
    return [[int(x), int(y)] for x, y in _order_quad(approx.reshape(-1, 2))]


def analyze_frame(bgr):
    img, scale = resize_max(bgr)
    mask = white_line_mask(img)
    segs = merge_collinear(hough_segments(mask))
    horiz = [s for s in segs if classify(s) == "horiz"][:12]
    vert = [s for s in segs if classify(s) == "vert"][:12]
    crosses = intersections(horiz, vert)
    return {
        "scale": scale,
        "size": [int(img.shape[1]), int(img.shape[0])],
        "segments": [{"x1": a, "y1": b, "x2": c, "y2": d, "kind": classify((a, b, c, d))} for a, b, c, d in segs],
        "horiz": horiz,
        "vert": vert,
        "intersections": crosses,
        "court_quad": court_quad(crosses, img.shape),
        "overlay_base": img,
        "mask": mask,
    }


def draw_overlay(result):
    vis = result["overlay_base"].copy()
    for x1, y1, x2, y2 in result["horiz"]:
        cv2.line(vis, (x1, y1), (x2, y2), (80, 220, 255), 2)
    for x1, y1, x2, y2 in result["vert"]:
        cv2.line(vis, (x1, y1), (x2, y2), (90, 255, 140), 2)
    for x, y in result["intersections"]:
        cv2.circle(vis, (x, y), 5, (0, 200, 255), -1)
    if result["court_quad"]:
        q = np.array(result["court_quad"], dtype=np.int32)
        cv2.polylines(vis, [q], True, (0, 255, 255), 3)
    cv2.putText(vis, f"H {len(result['horiz'])}  V {len(result['vert'])}  X {len(result['intersections'])}", (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return vis


def public_json(result):
    return {
        "size": result["size"],
        "segments": result["segments"],
        "intersections": result["intersections"],
        "court_quad": result["court_quad"],
        "counts": {"horiz": len(result["horiz"]), "vert": len(result["vert"]), "crosses": len(result["intersections"])},
    }


def iter_inputs(path: Path, every: int):
    if path.is_dir():
        for p in sorted(path.glob("*")):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                yield p.stem, cv2.imread(str(p))
        return
    if path.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv"}:
        cap = cv2.VideoCapture(str(path))
        i = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if i % max(every, 1) == 0:
                yield f"{path.stem}_{i:06d}", frame
            i += 1
        cap.release()
        return
    yield path.stem, cv2.imread(str(path))


def main():
    parser = argparse.ArgumentParser(description="Detector de lineas de cancha (polvo) con OpenCV")
    parser.add_argument("input")
    parser.add_argument("--out", default="out_court")
    parser.add_argument("--every", type=int, default=20)
    args = parser.parse_args()
    src = Path(args.input)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for name, frame in iter_inputs(src, args.every):
        if frame is None:
            print(f"skip {name}")
            continue
        result = analyze_frame(frame)
        cv2.imwrite(str(out / f"{name}_lines.png"), draw_overlay(result))
        cv2.imwrite(str(out / f"{name}_mask.png"), result["mask"])
        (out / f"{name}.json").write_text(json.dumps(public_json(result), indent=2), encoding="utf-8")
        q = "quad OK" if result["court_quad"] else "sin quad"
        print(f"{name}: H={len(result['horiz'])} V={len(result['vert'])} X={len(result['intersections'])} {q}")
        n += 1
    print(f"listo: {n} frames -> {out.resolve()}")


if __name__ == "__main__":
    main()
