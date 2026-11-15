/**
 * Procedural glyph atlas for the ASCII Fold style.
 * The twelve characters of the ramp ".,:;-=+*x#%@" are described as dots, strokes and rings and rasterised
 * here into a small distance-field texture. No font file or system font is involved, so the text looks
 * the same on every machine and stays sharp at any export size.
 */
export const GLYPH_RAMP = '.,:;-=+*x#%@';
export const GLYPH_ASPECT = 0.6; // cell width / cell height
/** Distance (in cell heights) mapped onto half of the texture's value range. */
export const GLYPH_RANGE = 0.08;

type Dot = { k: 'dot'; x: number; y: number; r: number };
type Seg = { k: 'seg'; x1: number; y1: number; x2: number; y2: number };
type Ring = { k: 'ring'; x: number; y: number; rx: number; ry: number };
type Prim = Dot | Seg | Ring;

const HW = 0.047; // stroke half-width in cell heights (bold)
const dot = (x: number, y: number, r = 0.078): Dot => ({ k: 'dot', x, y, r });
const seg = (x1: number, y1: number, x2: number, y2: number): Seg => ({ k: 'seg', x1, y1, x2, y2 });
/** rx is given in cell widths, ry in cell heights. */
const ring = (x: number, y: number, rx: number, ry: number): Ring => ({ k: 'ring', x, y, rx, ry });
const star = (cx: number, cy: number, r: number): Seg[] =>
  [90, 30, 150].map((deg) => {
    const a = (deg * Math.PI) / 180, dx = (r * Math.cos(a)) / GLYPH_ASPECT, dy = r * Math.sin(a);
    return seg(cx - dx, cy - dy, cx + dx, cy + dy);
  });

// Coordinates: x across the cell (0..1 of its width), y up (0..1 of its height); baseline near 0.22.
const GLYPHS: Record<string, Prim[]> = {
  '.': [dot(0.5, 0.27)],
  ',': [dot(0.5, 0.27), seg(0.5, 0.25, 0.4, 0.11)],
  ':': [dot(0.5, 0.28), dot(0.5, 0.58)],
  ';': [dot(0.5, 0.58), dot(0.5, 0.28), seg(0.5, 0.26, 0.4, 0.12)],
  '-': [seg(0.22, 0.44, 0.78, 0.44)],
  '=': [seg(0.2, 0.35, 0.8, 0.35), seg(0.2, 0.55, 0.8, 0.55)],
  '+': [seg(0.17, 0.44, 0.83, 0.44), seg(0.5, 0.22, 0.5, 0.66)],
  '*': star(0.5, 0.5, 0.2),
  x: [seg(0.2, 0.22, 0.8, 0.62), seg(0.2, 0.62, 0.8, 0.22)],
  '#': [seg(0.34, 0.2, 0.41, 0.76), seg(0.59, 0.2, 0.66, 0.76), seg(0.13, 0.38, 0.87, 0.38), seg(0.13, 0.58, 0.87, 0.58)],
  '%': [seg(0.2, 0.2, 0.8, 0.76), ring(0.25, 0.66, 0.15, 0.09), ring(0.75, 0.3, 0.15, 0.09)],
  '@': [ring(0.5, 0.46, 0.37, 0.31), ring(0.55, 0.46, 0.14, 0.1), seg(0.72, 0.36, 0.72, 0.56)],
};

function distance(p: Prim, x: number, y: number): number {
  const A = GLYPH_ASPECT;
  if (p.k === 'dot') return Math.hypot((x - p.x) * A, y - p.y) - p.r;
  if (p.k === 'seg') {
    const ax = p.x1 * A, bx = p.x2 * A, px = x * A;
    const dx = bx - ax, dy = p.y2 - p.y1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (y - p.y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - ax - t * dx, y - p.y1 - t * dy) - HW;
  }
  const rx = p.rx * A, ry = p.ry;
  const q = Math.hypot(((x - p.x) * A) / rx, (y - p.y) / ry);
  return Math.abs(q - 1) * Math.min(rx, ry) - HW * 0.9;
}

/** Single-channel atlas, glyphs side by side in ramp order; value 0.5 lies on the stroke edge. */
export function buildGlyphAtlas(cellW = 48, cellH = 80): { data: Uint8Array; width: number; height: number; count: number } {
  const count = GLYPH_RAMP.length, width = cellW * count;
  const data = new Uint8Array(width * cellH);
  for (let g = 0; g < count; g++) {
    const prims = GLYPHS[GLYPH_RAMP[g]];
    for (let j = 0; j < cellH; j++) {
      for (let i = 0; i < cellW; i++) {
        const x = (i + 0.5) / cellW, y = (j + 0.5) / cellH;
        let d = 1e9;
        for (const p of prims) d = Math.min(d, distance(p, x, y));
        data[j * width + g * cellW + i] = Math.round(255 * Math.max(0, Math.min(1, 0.5 - d / (2 * GLYPH_RANGE))));
      }
    }
  }
  return { data, width, height: cellH, count };
}
