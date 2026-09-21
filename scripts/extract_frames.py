#!/usr/bin/env python3
"""Extrae frames a ~2 fps para etiquetar en Roboflow.

  python scripts/extract_frames.py clips/ --out dataset/frames --fps 2
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2


VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}


def extract(video: Path, dest: Path, target_fps: float) -> int:
    cap = cv2.VideoCapture(str(video))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(int(round(src_fps / target_fps)), 1)
    dest.mkdir(parents=True, exist_ok=True)
    saved = 0
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            name = dest / f"{video.stem}_{i:06d}.jpg"
            cv2.imwrite(str(name), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            saved += 1
        i += 1
    cap.release()
    return saved


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="video o carpeta de clips")
    parser.add_argument("--out", default="dataset/frames")
    parser.add_argument("--fps", type=float, default=2.0)
    args = parser.parse_args()

    src = Path(args.input)
    out = Path(args.out)
    videos = [src] if src.is_file() else sorted(p for p in src.iterdir() if p.suffix.lower() in VIDEO_EXT)
    total = 0
    for v in videos:
        n = extract(v, out, args.fps)
        print(f"{v.name}: {n} frames")
        total += n
    print(f"total {total} -> {out.resolve()}")
    print("subilos a Roboflow y auto-label: ball, player, racket, net")


if __name__ == "__main__":
    main()
