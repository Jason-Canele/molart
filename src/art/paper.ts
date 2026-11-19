/**
 * Mounting: the paper a picture is made on, and the colophon written beside it (an inscription column and a
 * seal). Drawn with the 2D canvas over the finished rendering, by multiplication, so ink stays ink. The protein
 * is not touched: this is the sheet around it.
 */
export interface PaperOptions {
  /** sRGB 0..1 tone of the sheet */
  color: [number, number, number];
  /** 0..1 strength of the mottling and of the long fibres of xuan paper */
  fibre: number;
  /** default seal text (1 to 4 characters) */
  seal: string;
  /** sRGB 0..1 seal paste (cinnabar) */
  sealColor: [number, number, number];
  /** brush face of the inscription and the seal (one of the faces in public/fonts) */
  font: string;
}

export interface Colophon {
  /** 1 to 4 characters cut into the seal; empty = no seal */
  seal: string;
  /** a short line written top to bottom beside the picture; empty = none */
  inscription: string;
}

// Brush-written faces (SIL OFL 1.1, public/fonts/): Zhi Mang Xing (running-cursive), Ma Shan Zheng (thick regular),
// Long Cang (thin running) and Liu Jian Mao Cao (wild cursive). They cover simplified characters; others fall
// back to a brush or serif face of the system.
const stack = (font: string) => `"${font}", "Ma Shan Zheng", "Kaiti SC", "STKaiti", "KaiTi", "BiauKai", "DFKai-SB", "Noto Serif CJK SC", "Songti SC", serif`;

/** Load the brush face before text is drawn on a canvas (canvas text does not wait for web fonts). */
export async function brushFontReady(font: string, text: string): Promise<void> {
  try {
    await document.fonts.load(`40px "${font}"`, text || '蛋白');
  } catch {
    /* no font: the fallback faces are used */
  }
}

const css = (c: readonly number[], a = 1) => `rgba(${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255)).join(',')},${a})`;

function rng(seed: number) {
  let a = (seed | 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lay the sheet over what is already in `g` (a picture on white): tone, cloudy mottling and long fibres. */
export function layPaper(g: CanvasRenderingContext2D, w: number, h: number, p: PaperOptions, seed: number) {
  const r = rng(seed * 7 + 3);
  const u = Math.min(w, h) / 1000;
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = css(p.color);
  g.fillRect(0, 0, w, h);
  if (p.fibre > 0) {
    // cloudy mottling: a small noise tile, enlarged and smoothed
    const n = 48;
    const tile = document.createElement('canvas');
    tile.width = tile.height = n;
    const tg = tile.getContext('2d')!;
    const im = tg.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = 255 - Math.round(r() * r() * 30 * p.fibre);
      im.data.set([v, Math.round(v * 0.985), Math.round(v * 0.95), 255], i * 4);
    }
    tg.putImageData(im, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    // enlarged in two steps and blurred, so the clouds have no grid
    g.filter = `blur(${Math.round(9 * u)}px)`;
    g.drawImage(tile, -w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
    g.globalAlpha = 0.6;
    g.drawImage(tile, 0, 0, n / 3, n / 3, -w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
    g.globalAlpha = 1;
    g.filter = 'none';
    // long fibres lying every way in the sheet
    const count = Math.round(((w * h) / (u * u)) * 0.0011 * p.fibre);
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = (14 + r() * 46) * u, bend = (r() - 0.5) * 0.9;
      g.strokeStyle = css([0.52, 0.44, 0.3], (0.05 + r() * 0.1) * p.fibre);
      g.lineWidth = (0.35 + r() * 0.7) * u;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + bend) * len * 0.5, y + Math.sin(a + bend) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }
  g.restore();
}

/** A seal cut in intaglio (baiwen): the characters are left as paper in a field of cinnabar paste, worn at the edges. */
function sealCanvas(text: string, size: number, color: readonly number[], font: string, seed: number): HTMLCanvasElement {
  const r = rng(seed * 13 + 5);
  const chars = Array.from(text).slice(0, 4);
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(8, Math.round(size));
  const g = c.getContext('2d')!;
  const s = c.width, rad = s * 0.07;
  g.fillStyle = css(color);
  g.beginPath();
  g.roundRect(0, 0, s, s, rad);
  g.fill();
  // paste lies unevenly: darker and thinner patches
  for (let i = 0; i < 14; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(90,0,0,0.10)' : 'rgba(255,225,205,0.10)';
    g.beginPath();
    g.ellipse(r() * s, r() * s, s * (0.08 + r() * 0.2), s * (0.05 + r() * 0.14), r() * 3, 0, 7);
    g.fill();
  }
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  // layout: one column for up to three characters, two columns read right to left for four
  const cols = chars.length === 4 ? 2 : 1, rows = Math.ceil(chars.length / cols);
  const pad = s * 0.1, cw = (s - 2 * pad) / cols, ch = (s - 2 * pad) / rows;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fs = 100;
  g.font = `${fs}px ${stack(font)}`;
  chars.forEach((chr, i) => {
    const col = cols - 1 - Math.floor(i / rows), row = i % rows;
    const m = g.measureText(chr);
    const gw = Math.max(m.width, 1), gh = Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1);
    // seal characters are stretched to fill their cell
    const sx = Math.min((cw * 0.9) / gw, ((ch * 0.9) / gh) * 1.7), sy = Math.min((ch * 0.9) / gh, ((cw * 0.9) / gw) * 1.7);
    g.save();
    g.translate(pad + (col + 0.5) * cw, pad + (row + 0.5) * ch);
    g.scale(sx, sy);
    g.fillText(chr, 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);   // centre the glyph's own box on the cell
    g.restore();
  });
  // wear: pits in the paste and nibbled edges
  for (let i = 0; i < 90; i++) {
    const edge = r() < 0.4;
    const x = edge ? (r() < 0.5 ? r() * s : r() < 0.5 ? 0 : s) : r() * s, y = edge ? (x === 0 || x === s ? r() * s : r() < 0.5 ? 0 : s) : r() * s;
    g.beginPath();
    g.arc(x, y, s * (0.004 + r() * r() * 0.022), 0, 7);
    g.fill();
  }
  return c;
}

/** The colophon in the lower left of the sheet: the inscription written downwards, the seal below it. */
export function drawColophon(g: CanvasRenderingContext2D, w: number, h: number, p: PaperOptions, text: Colophon, seed: number) {
  const m = Math.min(w, h);
  const size = m * 0.072, x0 = m * 0.062, y1 = h - m * 0.062;
  const r = rng(seed * 3 + 11);
  g.save();
  g.globalCompositeOperation = 'multiply';
  let top = y1;
  if (text.seal) {
    const seal = sealCanvas(text.seal, size * 2, p.sealColor, p.font, seed);
    g.save();
    g.translate(x0 + size / 2, y1 - size / 2);
    g.rotate((r() - 0.5) * 0.06);
    g.globalAlpha = 0.93;
    g.imageSmoothingQuality = 'high';
    g.drawImage(seal, -size / 2, -size / 2, size, size);
    g.restore();
    top = y1 - size - size * 0.45;
  }
  const chars = Array.from(text.inscription).slice(0, 16);
  if (chars.length) {
    const fs = m * 0.044, step = fs * 1.02;
    g.fillStyle = 'rgba(24,22,22,0.92)';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${fs}px ${stack(p.font)}`;
    chars.forEach((chr, i) => g.fillText(chr, x0 + size / 2 + (r() - 0.5) * fs * 0.06, top - (chars.length - 1 - i) * step - fs / 2));
  }
  g.restore();
}

/** The whole sheet: paper over the picture, then the colophon. */
export function mount(g: CanvasRenderingContext2D, w: number, h: number, p: PaperOptions, text: Colophon, seed: number) {
  layPaper(g, w, h, p, seed);
  drawColophon(g, w, h, p, text, seed);
}
