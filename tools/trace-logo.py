#!/usr/bin/env python3
"""Traces assets/brand/logo-original.png into assets/brand/logo-full-light.svg.

The intro animation (js/intro.js) has to move the Y, the B and the S of the monogram
independently, so the logo has to exist as separate shapes rather than one flat image.
Those three letters never touch in the artwork, so each one falls out as its own
connected component of the gold — no hand-drawn seams, no guessing.

Output coordinates reproduce the framing of assets/brand/logo-full-light.png (800x622)
so the SVG is a drop-in replacement for it in the hero: the intro can hand the logo off
to the resting hero logo without anything shifting.

Run: python3 tools/trace-logo.py     (needs pillow, numpy, scipy)
Only rerun this when the brand logo itself changes.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

def cross2(a, b):
    """z of the 2-D cross product; numpy dropped 2-vector support from np.cross."""
    a, b = np.asarray(a), np.asarray(b)
    return a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0]


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/brand/logo-original.png"
REF = ROOT / "assets/brand/logo-full-light.png"
OUT = ROOT / "assets/brand/logo-full-light.svg"

GOLD = "#c0a270"   # measured from the artwork: rgb(191,162,112)
CREAM = "#f3ede4"  # --cream, so "YAM BARON" reads on the dark hero
GREY = "#a89f91"   # --grey, for "HAIR STUDIO"

SIMPLIFY = 0.35    # douglas-peucker tolerance, source pixels
CORNER = 40.0      # turn sharper than this stays a corner instead of being smoothed


# ---------------------------------------------------------------- coverage fields
def coverage(img, ink_rgb, bg_rgb):
    """Per-pixel 0..1 ink coverage, projecting each pixel onto the bg->ink line.

    Antialiased edge pixels land between 0 and 1, which is what lets marching squares
    put the outline at a sub-pixel position instead of on a stair-stepped boundary.
    """
    ink = np.asarray(ink_rgb, float)
    bg = np.asarray(bg_rgb, float)
    d = ink - bg
    t = ((img - bg) @ d) / (d @ d)
    return np.clip(t, 0.0, 1.0)


# ---------------------------------------------------------------- marching squares
# Each case lists the cell edges a contour segment connects. Edges: 0=top, 1=right,
# 2=bottom, 3=left. Index bits are tl=8, tr=4, br=2, bl=1.
CASES = {
    1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(0, 1)],
    6: [(0, 2)], 7: [(3, 0)], 8: [(3, 0)], 9: [(0, 2)],
    11: [(0, 1)], 12: [(3, 1)], 13: [(2, 1)], 14: [(3, 2)],
    5: [(3, 0), (2, 1)], 10: [(3, 2), (0, 1)],
}


def _edge_point(edge, x, y, tl, tr, br, bl, level):
    def lerp(a, b):
        return 0.5 if a == b else (level - a) / (b - a)
    if edge == 0:
        return (x + lerp(tl, tr), float(y))
    if edge == 1:
        return (x + 1.0, y + lerp(tr, br))
    if edge == 2:
        return (x + lerp(bl, br), y + 1.0)
    return (float(x), y + lerp(tl, bl))


def contours(field, level=0.5):
    """Closed sub-pixel contours of `field` at `level`, as lists of (x, y)."""
    f = np.pad(field, 1, constant_values=0.0)
    above = f >= level
    tl, tr = above[:-1, :-1], above[:-1, 1:]
    br, bl = above[1:, 1:], above[1:, :-1]
    idx = tl * 8 + tr * 4 + br * 2 + bl * 1

    segments = []
    ys, xs = np.nonzero((idx > 0) & (idx < 15))
    for y, x in zip(ys.tolist(), xs.tolist()):
        a, b = f[y, x], f[y, x + 1]
        c, d = f[y + 1, x + 1], f[y + 1, x]
        case = int(idx[y, x])
        pairs = CASES[case]
        if case in (5, 10) and (a + b + c + d) / 4.0 < level:
            # Saddle: the cell centre is outside, so pair the corners the other way.
            pairs = [(3, 2), (0, 1)] if case == 5 else [(3, 0), (2, 1)]
        for e0, e1 in pairs:
            p0 = _edge_point(e0, x, y, a, b, c, d, level)
            p1 = _edge_point(e1, x, y, a, b, c, d, level)
            segments.append((p0, p1))

    return _stitch(segments)


def _stitch(segments):
    """Joins unordered segments into closed loops by matching endpoints."""
    def key(p):
        return (round(p[0], 4), round(p[1], 4))

    ends = {}
    for i, (p0, p1) in enumerate(segments):
        ends.setdefault(key(p0), []).append(i)
        ends.setdefault(key(p1), []).append(i)

    used = [False] * len(segments)
    loops = []
    for start in range(len(segments)):
        if used[start]:
            continue
        used[start] = True
        p0, p1 = segments[start]
        loop = [p0, p1]
        while True:
            cands = ends.get(key(loop[-1]), [])
            nxt = next((i for i in cands if not used[i]), None)
            if nxt is None:
                break
            used[nxt] = True
            a, b = segments[nxt]
            loop.append(b if key(a) == key(loop[-1]) else a)
            if key(loop[-1]) == key(loop[0]):
                break
        if len(loop) > 3:
            loops.append(loop[:-1] if key(loop[-1]) == key(loop[0]) else loop)
    return loops


# ---------------------------------------------------------------- path building
def simplify(points, tol):
    """Douglas-Peucker on a closed ring."""
    if len(points) < 4:
        return points
    pts = np.asarray(points, float)
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True

    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = pts[i], pts[j]
        seg = b - a
        norm = np.hypot(*seg)
        chunk = pts[i + 1:j]
        if norm < 1e-9:
            dist = np.hypot(*(chunk - a).T)
        else:
            dist = np.abs(cross2(seg, chunk - a)) / norm
        k = int(np.argmax(dist))
        if dist[k] > tol:
            k += i + 1
            keep[k] = True
            stack += [(i, k), (k, j)]
    return [tuple(p) for p in pts[keep]]


def to_path(ring, tol=SIMPLIFY):
    """A closed ring as a smooth cubic path, keeping sharp corners sharp."""
    pts = simplify(ring, tol)
    n = len(pts)
    if n < 3:
        return ""
    p = np.asarray(pts, float)

    prev, nxt = np.roll(p, 1, 0), np.roll(p, -1, 0)
    incoming, outgoing = p - prev, nxt - p
    ang = np.degrees(np.abs(np.arctan2(
        cross2(incoming, outgoing),
        np.sum(incoming * outgoing, axis=1),
    )))
    corner = ang > CORNER

    def fmt(v):
        return f"{v:.2f}".rstrip("0").rstrip(".")

    out = [f"M{fmt(p[0][0])} {fmt(p[0][1])}"]
    for i in range(n):
        p0, p1 = p[i - 1], p[i]
        p2, p3 = p[(i + 1) % n], p[(i + 2) % n]
        c1 = p1 + (p2 - p1) / 3 if corner[i] else p1 + (p2 - p0) / 6
        c2 = p2 - (p2 - p1) / 3 if corner[(i + 1) % n] else p2 - (p3 - p1) / 6
        out.append(
            f"C{fmt(c1[0])} {fmt(c1[1])} {fmt(c2[0])} {fmt(c2[1])} "
            f"{fmt(p2[0])} {fmt(p2[1])}"
        )
    return " ".join(out) + "Z"


def trace(field, transform, min_area=40.0):
    """All rings of a coverage field as one path string, in output coordinates."""
    parts = []
    for ring in contours(field):
        pts = np.asarray(ring, float)
        area = 0.5 * abs(cross2(pts, np.roll(pts, -1, 0)).sum())
        if area < min_area:
            continue
        parts.append(to_path([transform(x, y) for x, y in ring]))
    return " ".join(p for p in parts if p)


# ---------------------------------------------------------------- main
def main():
    if not SRC.exists():
        sys.exit(f"missing {SRC}")

    img = np.array(Image.open(SRC).convert("RGB")).astype(float)
    gold_cov = coverage(img, (191, 162, 112), (250, 247, 242))
    dark_cov = coverage(img, (17, 17, 17), (250, 247, 242))
    # The gold projection also rises on the dark text; keep them apart by hue.
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    is_gold = (r - b) > 30
    gold_cov = np.where(is_gold, gold_cov, 0.0)
    dark_cov = np.where(is_gold, 0.0, dark_cov)

    # --- three letters of the monogram, biggest first: B, Y, then the thin S
    labels, count = ndimage.label(gold_cov >= 0.5)
    sizes = ndimage.sum(gold_cov >= 0.5, labels, range(1, count + 1))
    biggest = [int(i) + 1 for i in np.argsort(sizes)[::-1][:3]]
    # The S is a thin ribbon — far the smallest of the three. Of the other two the
    # left-hand one is the Y and the right-hand one the B.
    s = min(biggest, key=lambda l: sizes[l - 1])
    rest = [l for l in biggest if l != s]
    cx = {l: ndimage.center_of_mass(labels == l)[1] for l in rest}
    letters = {"y": min(rest, key=cx.get), "b": max(rest, key=cx.get), "s": s}

    # --- output frame: reproduce logo-full-light.png's crop so this drops into the hero
    ref = np.array(Image.open(REF).convert("RGBA"))
    ref_ink = ref[..., 3] >= 128
    ry, rx = np.where(ref_ink)
    src_ink = (gold_cov >= 0.5) | (dark_cov >= 0.5)
    sy, sx = np.where(src_ink)
    scale = (rx.max() - rx.min() + 1) / (sx.max() - sx.min() + 1)
    off_x = rx.min() - sx.min() * scale
    off_y = ry.min() - sy.min() * scale
    W, H = ref.shape[1], ref.shape[0]

    def T(x, y):
        return (x * scale + off_x, y * scale + off_y)

    print(f"frame {W}x{H}  scale={scale:.5f}  offset=({off_x:.2f},{off_y:.2f})")

    paths = {}
    for name, label in letters.items():
        field = np.where(labels == label, gold_cov, 0.0)
        # reclaim the antialiased fringe, which falls below the labelling threshold
        near = ndimage.binary_dilation(labels == label, iterations=3)
        field = np.where(near, np.maximum(field, np.where(labels == 0, gold_cov, 0.0)), 0.0)
        paths[name] = trace(field, T)
        ys, xs = np.where(field >= 0.5)
        print(f"  {name}: {len(paths[name])} chars, bbox x[{xs.min()}-{xs.max()}] y[{ys.min()}-{ys.max()}]")

    # --- wordmark: split "YAM BARON" from "HAIR STUDIO" on the blank row between them
    rows = (dark_cov >= 0.5).sum(axis=1)
    filled = np.where(rows > 0)[0]
    breaks = [filled[i] for i in range(1, len(filled)) if filled[i] - filled[i - 1] > 8]
    split = breaks[-1] if breaks else filled[-1]
    name_field = dark_cov.copy(); name_field[split:] = 0.0
    sub_field = dark_cov.copy(); sub_field[:split] = 0.0
    paths["name"] = trace(name_field, T)
    paths["sub"] = trace(sub_field, T)
    print(f"  wordmark split at row {split}")

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="YAM BARON Hair Studio">
<g id="mg" fill="{GOLD}" fill-rule="evenodd">
<path id="mg-y" d="{paths['y']}"/>
<path id="mg-b" d="{paths['b']}"/>
<path id="mg-s" d="{paths['s']}"/>
</g>
<path id="wm-name" fill="{CREAM}" fill-rule="evenodd" d="{paths['name']}"/>
<path id="wm-sub" fill="{GREY}" fill-rule="evenodd" d="{paths['sub']}"/>
</svg>
'''
    OUT.write_text(svg)
    print(f"wrote {OUT.relative_to(ROOT)}  ({len(svg) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
