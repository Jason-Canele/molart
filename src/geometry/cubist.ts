import { MeshData } from './ribbon';

export interface CubistOptions {
  /** 0..1: how far each helix and strand is turned away from the common viewpoint. */
  amount: number;
  seed: number;
}

function rnd(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7 + 0.5) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Several viewpoints at once (opt-in artistic deformation of the DISPLAY mesh only).
 * Every helix and strand is turned rigidly about its own centre by a small, seeded angle, as if that piece
 * had been drawn from a slightly different position; the loops between two pieces blend from one turn to the
 * next, so the chain never tears. Atomic coordinates are not touched.
 */
export function cubistMesh(m: MeshData, opt: CubistOptions): MeshData {
  const a = Math.max(0, Math.min(1, opt.amount));
  if (a <= 0) return m;
  const n = m.vertexCount;
  // secondary structure per (chain, residue position) from the mesh itself
  const ssAt = new Map<number, number>();
  const keyOf = (i: number) => Math.round(m.info[4 * i]) * 100000 + Math.round(m.surf[4 * i]);
  for (let i = 0; i < n; i++) {
    const k = keyOf(i);
    if (!ssAt.has(k)) ssAt.set(k, Math.round(m.surf[4 * i + 3]));
  }
  const keys = [...ssAt.keys()].sort((x, y) => x - y);
  // elements: runs of helix or strand, at least 3 positions long
  interface El { chain: number; first: number; last: number; c: [number, number, number]; cnt: number; R: number[] }
  const els: El[] = [];
  for (let i = 0; i < keys.length; ) {
    const ss = ssAt.get(keys[i])!;
    let j = i;
    while (j + 1 < keys.length && keys[j + 1] === keys[j] + 1 && ssAt.get(keys[j + 1]) === ss) j++;
    if (ss > 0 && j - i >= 2) els.push({ chain: Math.floor(keys[i] / 100000), first: keys[i] % 100000, last: keys[j] % 100000, c: [0, 0, 0], cnt: 0, R: [] });
    i = j + 1;
  }
  if (!els.length) return m;
  const elOf = (chain: number, t: number) => els.findIndex((e) => e.chain === chain && t >= e.first - 0.5 && t <= e.last + 0.5);
  const own = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const e = elOf(Math.round(m.info[4 * i]), m.surf[4 * i]);
    own[i] = e;
    if (e >= 0) {
      const el = els[e];
      el.c[0] += m.centers[3 * i]; el.c[1] += m.centers[3 * i + 1]; el.c[2] += m.centers[3 * i + 2];
      el.cnt++;
    }
  }
  els.forEach((el, e) => {
    el.c = [el.c[0] / el.cnt, el.c[1] / el.cnt, el.c[2] / el.cnt];
    // seeded axis and angle (at least half of the full turn, either way)
    const u = rnd(e * 3 + 1, opt.seed) * 2 - 1, ph = rnd(e * 3 + 2, opt.seed) * Math.PI * 2;
    const sq = Math.sqrt(1 - u * u);
    const ax = [sq * Math.cos(ph), sq * Math.sin(ph), u];
    const r = rnd(e * 3 + 3, opt.seed) * 2 - 1;
    const ang = a * 0.5 * (r < 0 ? -1 : 1) * (0.5 + 0.5 * Math.abs(r));
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const [x, y, z] = ax;
    el.R = [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  });
  const turn = (el: El, p: ArrayLike<number>, o: number, out: number[]) => {
    const dx = p[o] - el.c[0], dy = p[o + 1] - el.c[1], dz = p[o + 2] - el.c[2], R = el.R;
    out[0] = el.c[0] + R[0] * dx + R[1] * dy + R[2] * dz;
    out[1] = el.c[1] + R[3] * dx + R[4] * dy + R[5] * dz;
    out[2] = el.c[2] + R[6] * dx + R[7] * dy + R[8] * dz;
  };
  const P = new Float32Array(m.positions), C = new Float32Array(m.centers);
  const p0 = [0, 0, 0], p1 = [0, 0, 0];
  const move = (src: Float32Array, dst: Float32Array, i: number, e0: number, e1: number, w: number) => {
    if (e0 < 0 && e1 < 0) return;
    if (e0 >= 0) turn(els[e0], src, 3 * i, p0); else { p0[0] = src[3 * i]; p0[1] = src[3 * i + 1]; p0[2] = src[3 * i + 2]; }
    if (e1 >= 0) turn(els[e1], src, 3 * i, p1); else { p1[0] = src[3 * i]; p1[1] = src[3 * i + 1]; p1[2] = src[3 * i + 2]; }
    for (let k = 0; k < 3; k++) dst[3 * i + k] = p0[k] + (p1[k] - p0[k]) * w;
  };
  for (let i = 0; i < n; i++) {
    let e0 = own[i], e1 = own[i], w = 0;
    if (e0 < 0) {
      // a loop: blend from the piece before it to the piece after it (a free end follows its only neighbour)
      const chain = Math.round(m.info[4 * i]), t = m.surf[4 * i];
      let before = -1, after = -1;
      for (let e = 0; e < els.length; e++) {
        if (els[e].chain !== chain) continue;
        if (els[e].last < t && (before < 0 || els[e].last > els[before].last)) before = e;
        if (els[e].first > t && (after < 0 || els[e].first < els[after].first)) after = e;
      }
      if (before >= 0 && after >= 0) {
        const lo = els[before].last + 0.5, hi = els[after].first - 0.5;
        const f = Math.max(0, Math.min(1, (t - lo) / Math.max(1e-6, hi - lo)));
        e0 = before; e1 = after; w = f * f * (3 - 2 * f);
      } else { e0 = e1 = before >= 0 ? before : after; }
    }
    move(m.positions, P, i, e0, e1, w);
    move(m.centers, C, i, e0, e1, w);
  }
  return { ...m, positions: P, centers: C };
}
