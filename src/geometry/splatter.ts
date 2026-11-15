/**
 * Pollock "action painting" marks anchored to the molecular form (display geometry only).
 *
 * Builds thin poured-paint skeins that wander and loop around the backbone spline and
 * droplets scattered close to it, from the ribbon's own spline centres. They rotate with the
 * protein like any other surface mark. Atomic coordinates are never read or written here.
 * Vertex ssCode 3 + layer (3..7) tells the shader which paint colour a mark carries.
 */
import type { MeshData } from './ribbon';

type V = [number, number, number];

function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x2545f491, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca77);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}
const vnoise = (x: number, s: number) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i * 7919 + s * 104729) * (1 - u) + hash((i + 1) * 7919 + s * 104729) * u;
};

export interface SplatterOptions {
  seed: number;
  /** Paint layers (colours) poured over the protein. */
  layers?: number;
  density?: number;
  skeins?: boolean;
  flicks?: boolean;
  /** droplet count per residue, max distance from backbone (Å), size scale, flattening (1 = sphere) */
  drops?: number;
  dropReach?: number;
  dropSize?: number;
  flickReach?: number;
  /** End flung lines in round blobs and dot some of them (concept-sheet Pollock). */
  flickDots?: boolean;
  /** Sketch construction lines along both ribbon edges (Schiele): passes per edge, overshoot (Å). */
  sketch?: { passes: number; overshoot: number; jitter: number; radius: number };
}

/** Upper bound on droplets, so a very large structure cannot build an unbounded mesh. */
const MAX_DROPS = 9000;
/** Satellite specks around a drop are far below a pixel: a coarse ball is enough. */
const SLA = 2, SLO = 5;

export function splatterMesh(m: MeshData, opt: SplatterOptions): MeshData {
  const seed = opt.seed | 0;
  const layers = opt.layers ?? 5;
  const density = opt.density ?? 1;
  // per-residue spline centres (samples at integer t, first profile vertex)
  const centre = new Map<number, { p: V; chain: number }>();
  for (let i = 0; i < m.vertexCount; i++) {
    const t = m.surf[4 * i];
    if (Math.abs(t - Math.round(t)) > 1e-4 || m.surf[4 * i + 1] !== 0) continue;
    const k = Math.round(t);
    if (!centre.has(k)) centre.set(k, { p: [m.centers[3 * i], m.centers[3 * i + 1], m.centers[3 * i + 2]], chain: m.info[4 * i] });
  }
  const edgeA = new Map<number, V>(), edgeB = new Map<number, V>();
  if (opt.sketch) {
    for (let i = 0; i < m.vertexCount; i++) {
      const t = m.surf[4 * i];
      if (Math.abs(t - Math.round(t)) > 1e-4) continue;
      const k = Math.round(t), a = m.surf[4 * i + 1];
      const p: V = [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]];
      if (a === 0 && !edgeA.has(k)) edgeA.set(k, p);
      if (Math.abs(a - 0.5) < 1e-4 && !edgeB.has(k)) edgeB.set(k, p);
    }
  }
  const keys = [...centre.keys()].sort((a, b) => a - b);
  const P = Array.from(m.positions), N = Array.from(m.normals), SU = Array.from(m.surf), IN = Array.from(m.info);
  const TG = Array.from(m.tangents), PH = Array.from(m.phys), CT = Array.from(m.centers), ID = Array.from(m.indices);
  const push = (p: V, n: V, t: number, code: number, chain: number, tg: V, arc: number) => {
    P.push(...p);
    N.push(...n);
    SU.push(t, 0, 0, code);
    IN.push(chain, Math.round(t), 0, 0);
    TG.push(...tg);
    PH.push(arc, 0, 0, 0);
    CT.push(...p);
    return P.length / 3 - 1;
  };
  const sphere = (ctr: V, rad: number, t: number, code: number, chain: number) => {
    const base = P.length / 3, LA = 6, LO = 10;
    for (let a = 0; a <= LA; a++)
      for (let b = 0; b < LO; b++) {
        const th = (Math.PI * a) / LA, ph = (2 * Math.PI * b) / LO;
        const n: V = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        push([ctr[0] + n[0] * rad, ctr[1] + n[1] * rad, ctr[2] + n[2] * rad], n, t, code, chain, [1, 0, 0], 0);
      }
    for (let a = 0; a < LA; a++)
      for (let b = 0; b < LO; b++) {
        const b1 = (b + 1) % LO;
        const i0 = base + a * LO + b, i1 = base + a * LO + b1, j0 = base + (a + 1) * LO + b, j1 = base + (a + 1) * LO + b1;
        ID.push(i0, i1, j0, i1, j1, j0);
      }
  };
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a: V) => Math.hypot(a[0], a[1], a[2]) || 1;
  const norm = (a: V): V => {
    const l = len(a);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // --- skeins: poured lines wandering around the chain ---
  const nSkeins = opt.skeins === false ? 0 : Math.max(2, Math.round((keys.length / 40) * density));
  for (let sk = 0; sk < nSkeins * layers; sk++) {
    const layer = sk % layers;
    const hs = sk * 131 + seed * 977;
    const startIdx = Math.floor(hash(hs) * keys.length);
    const runLen = 8 + Math.floor(hash(hs + 1) * 30);
    const pts: { p: V; t: number; chain: number }[] = [];
    for (let j = 0; j < runLen; j++) {
      const k = keys[startIdx + j];
      if (k === undefined) break;
      const c = centre.get(k)!;
      if (pts.length && (c.chain !== pts[pts.length - 1].chain || len(sub(c.p, pts[pts.length - 1].p)) > 7)) break;
      // smooth wandering offset, 0.6–3 Å from the backbone
      const r = 0.6 + 2.4 * vnoise(j * 0.3 + sk * 1.7, seed + 11);
      const off: V = [vnoise(j * 0.45, hs + 3) - 0.5, vnoise(j * 0.45, hs + 5) - 0.5, vnoise(j * 0.45, hs + 7) - 0.5];
      const o = norm(off);
      pts.push({ p: [c.p[0] + o[0] * r, c.p[1] + o[1] * r, c.p[2] + o[2] * r], t: k, chain: c.chain });
    }
    if (pts.length < 4) continue;
    // Catmull-Rom through pts, tube with pooling thickness
    const SEG = 5, SUB = 4;
    const base0 = 0.03 + 0.035 * hash(hs + 9);
    let prevRing = -1;
    let arc = 0;
    let lastP: V | null = null;
    let ref: V = [0, 0, 1];
    for (let i = 0; i < pts.length - 1; i++)
      for (let s = 0; s < SUB; s++) {
        const f = s / SUB;
        const p0 = pts[Math.max(0, i - 1)].p, p1 = pts[i].p, p2 = pts[i + 1].p, p3 = pts[Math.min(pts.length - 1, i + 2)].p;
        const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
        const p: V = [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])];
        const T = norm(sub(p2, p1));
        if (Math.abs(T[0] * ref[0] + T[1] * ref[1] + T[2] * ref[2]) > 0.9) ref = [1, 0, 0];
        const e1 = norm(cross(T, ref)), e2 = cross(T, e1);
        if (lastP) arc += len(sub(p, lastP));
        lastP = p;
        const tt = pts[i].t + f;
        const pool = Math.pow(vnoise(arc * 0.5, hs + 13), 3);
        const rad = base0 * (0.25 + 5.0 * pool);
        const ring = P.length / 3;
        for (let j = 0; j < SEG; j++) {
          const a = (2 * Math.PI * j) / SEG;
          const n: V = [e1[0] * Math.cos(a) + e2[0] * Math.sin(a), e1[1] * Math.cos(a) + e2[1] * Math.sin(a), e1[2] * Math.cos(a) + e2[2] * Math.sin(a)];
          push([p[0] + n[0] * rad, p[1] + n[1] * rad, p[2] + n[2] * rad], n, tt, 3 + layer, pts[i].chain, T, arc);
        }
        if (prevRing >= 0)
          for (let j = 0; j < SEG; j++) {
            const j1 = (j + 1) % SEG;
            ID.push(prevRing + j, prevRing + j1, ring + j, prevRing + j1, ring + j1, ring + j);
          }
        prevRing = ring;
      }
  }

  // --- flicks: thin, nearly straight navy/black pours that cross the fold (Pollock's whipped lines) ---
  const nFlicks = opt.flicks === false ? 0 : Math.round((keys.length / 10) * density);
  for (let f = 0; f < nFlicks; f++) {
    const hf = f * 613 + seed * 71 + 3;
    const ka = keys[Math.floor(hash(hf) * keys.length)], kb = keys[Math.floor(hash(hf + 1) * keys.length)];
    const A0 = centre.get(ka)!.p, B0 = centre.get(kb)!.p;
    if (len(sub(A0, B0)) > (opt.flickReach ?? 26) || len(sub(A0, B0)) < 6) continue;
    // flung lines overshoot the fold a little on both ends
    const over = opt.flickDots ? 0.15 + 0.25 * hash(hf + 12) : 0;
    const D0 = sub(B0, A0);
    const A: V = [A0[0] - D0[0] * over, A0[1] - D0[1] * over, A0[2] - D0[2] * over];
    const B: V = [B0[0] + D0[0] * over, B0[1] + D0[1] * over, B0[2] + D0[2] * over];
    const T = norm(sub(B, A));
    let ref2: V = Math.abs(T[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(cross(T, ref2)), e2 = cross(T, e1);
    const bow = (hash(hf + 2) < 0.5 ? -1 : 1) * (opt.flickDots ? 0.5 + 2.5 * hash(hf + 9) : 3 + 7 * hash(hf + 9));
    const STEPS = 12, SEG = 4;
    let prev = -1;
    const lr = hash(hf + 3);
    const layer = opt.flickDots ? (lr < 0.5 ? 0 : lr < 0.8 ? 2 : 1) : (lr < 0.75 ? 0 : 4);
    const dotted = opt.flickDots && hash(hf + 14) < 0.5;   // half the flung lines are trails of dots   // some lines are trails of dots
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const p: V = [A[0] + (B[0] - A[0]) * u + e1[0] * bow * Math.sin(Math.PI * u), A[1] + (B[1] - A[1]) * u + e1[1] * bow * Math.sin(Math.PI * u), A[2] + (B[2] - A[2]) * u + e1[2] * bow * Math.sin(Math.PI * u)];
      const rad = opt.flickDots ? 0.025 + 0.09 * Math.pow(vnoise(u * 4, hf), 2) : 0.02 + 0.12 * Math.pow(vnoise(u * 5, hf), 3);
      if (dotted) { if (hash(hf + i * 3) < 0.55) sphere(p, 0.04 + 0.1 * Math.pow(hash(hf + i), 2), ka + (kb - ka) * u, 3 + layer, centre.get(ka)!.chain); continue; }   // irregular spacing and size
      const ring = P.length / 3;
      for (let j = 0; j < SEG; j++) {
        const a = (2 * Math.PI * j) / SEG;
        const n: V = [e1[0] * Math.cos(a) + e2[0] * Math.sin(a), e1[1] * Math.cos(a) + e2[1] * Math.sin(a), e1[2] * Math.cos(a) + e2[2] * Math.sin(a)];
        push([p[0] + n[0] * rad, p[1] + n[1] * rad, p[2] + n[2] * rad], n, ka + (kb - ka) * u, 3 + layer, centre.get(ka)!.chain, T, u * 10);
      }
      if (prev >= 0) for (let j = 0; j < SEG; j++) { const j1 = (j + 1) % SEG; ID.push(prev + j, prev + j1, ring + j, prev + j1, ring + j1, ring + j); }
      prev = ring;
    }
    if (opt.flickDots && !dotted) {
      sphere(A, 0.2 + 0.15 * hash(hf + 20), ka, 3 + layer, centre.get(ka)!.chain);
      sphere(B, 0.2 + 0.15 * hash(hf + 21), kb, 3 + layer, centre.get(kb)!.chain);
    }
  }

  // --- sketch: jittered thin lines along both ribbon edges, overshooting at segment ends ---
  if (opt.sketch) {
    const sk = opt.sketch;
    const runs: number[][] = [];
    let cur: number[] = [];
    for (const k of keys) {
      const prevK = cur[cur.length - 1];
      if (cur.length && (k !== prevK + 1 || centre.get(k)!.chain !== centre.get(prevK)!.chain)) { runs.push(cur); cur = []; }
      cur.push(k);
    }
    if (cur.length) runs.push(cur);
    const SEG = 4, SUB = 3;
    for (const run of runs) {
      if (run.length < 3) continue;
      for (const edge of [edgeA, edgeB]) {
        for (let pass = 0; pass < sk.passes; pass++) {
          const hs = run[0] * 31 + pass * 7 + (edge === edgeA ? 0 : 3) + seed * 101;
          const raw: { p: V; t: number }[] = [];
          for (const k of run) { const e = edge.get(k); if (e) raw.push({ p: e, t: k }); }
          if (raw.length < 3) continue;
          // overshoot: extrapolate past both ends
          const ext = (a: V, b: V, d: number): V => { const u = norm(sub(a, b)); return [a[0] + u[0] * d, a[1] + u[1] * d, a[2] + u[2] * d]; };
          const os = sk.overshoot * (0.4 + hash(hs + 1));
          raw.unshift({ p: ext(raw[0].p, raw[1].p, os), t: raw[0].t });
          raw.push({ p: ext(raw[raw.length - 1].p, raw[raw.length - 2].p, os * (0.4 + hash(hs + 2))), t: raw[raw.length - 1].t });
          const pts = raw.map((r, i) => ({ t: r.t, p: [r.p[0] + (vnoise(i * 0.7, hs + 11) - 0.5) * 2 * sk.jitter, r.p[1] + (vnoise(i * 0.7, hs + 13) - 0.5) * 2 * sk.jitter, r.p[2] + (vnoise(i * 0.7, hs + 17) - 0.5) * 2 * sk.jitter] as V }));
          let prev = -1, ref: V = [0, 0, 1];
          for (let i = 0; i < pts.length - 1; i++)
            for (let q = 0; q < SUB; q++) {
              const f = q / SUB;
              const p0 = pts[Math.max(0, i - 1)].p, p1 = pts[i].p, p2 = pts[i + 1].p, p3 = pts[Math.min(pts.length - 1, i + 2)].p;
              const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
              const p: V = [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])];
              // pen lifts: occasional gaps
              if (vnoise((i + f) * 0.5, hs + 23) < 0.18) { prev = -1; continue; }
              const T = norm(sub(p2, p1));
              if (Math.abs(T[0] * ref[0] + T[1] * ref[1] + T[2] * ref[2]) > 0.9) ref = [1, 0, 0];
              const e1 = norm(cross(T, ref)), e2 = cross(T, e1);
              const rad = sk.radius * (0.6 + 0.8 * vnoise((i + f) * 0.8, hs + 29));
              const ring = P.length / 3;
              for (let j = 0; j < SEG; j++) {
                const a = (2 * Math.PI * j) / SEG;
                const n: V = [e1[0] * Math.cos(a) + e2[0] * Math.sin(a), e1[1] * Math.cos(a) + e2[1] * Math.sin(a), e1[2] * Math.cos(a) + e2[2] * Math.sin(a)];
                push([p[0] + n[0] * rad, p[1] + n[1] * rad, p[2] + n[2] * rad], n, pts[i].t + f, 3, centre.get(run[0])!.chain, T, i);
              }
              if (prev >= 0) for (let j = 0; j < SEG; j++) { const j1 = (j + 1) % SEG; ID.push(prev + j, prev + j1, ring + j, prev + j1, ring + j1, ring + j); }
              prev = ring;
            }
        }
      }
    }
  }

  // --- droplets: splatter close to the backbone ---
  // A drop is a fraction of an ångström across — a few pixels even in a 4K export — so its sphere is tessellated by size.
  // (Every drop at 12 x 18 made a 1.7 million vertex, 216 MB mesh for a 500-residue protein, which could take a browser tab down.)
  const nDrops = Math.min(MAX_DROPS, Math.round(keys.length * (opt.drops ?? 3.0) * density));
  for (let d = 0; d < nDrops; d++) {
    const hd = d * 977 + seed * 31 + 7;
    const k = keys[Math.floor(hash(hd) * keys.length)];
    const c = centre.get(k)!;
    const dir = norm([hash(hd + 1) - 0.5, hash(hd + 2) - 0.5, hash(hd + 3) - 0.5]);
    const dist = 0.9 + (opt.dropReach ?? 4.1) * Math.pow(hash(hd + 4), 1.5);
    const rad = (0.06 + 0.32 * Math.pow(hash(hd + 5), 3.0)) * (opt.dropSize ?? 1);
    const ctr: V = [c.p[0] + dir[0] * dist, c.p[1] + dir[1] * dist, c.p[2] + dir[2] * dist];
    const layer = Math.floor(hash(hd + 6) * layers);
    const sat = Math.floor(hash(hd + 8) * 4);
    const LAT = rad < 0.05 ? 3 : rad < 0.11 ? 4 : rad < 0.25 ? 6 : 9, LON = rad < 0.05 ? 6 : rad < 0.11 ? 8 : rad < 0.25 ? 12 : 16;
    for (let q = 0; q < sat; q++) {
      const sd: V = norm([hash(hd + 20 + q) - 0.5, hash(hd + 30 + q) - 0.5, hash(hd + 40 + q) - 0.5]);
      const sr = rad * (0.15 + 0.3 * hash(hd + 50 + q));
      const sc: V = [ctr[0] + sd[0] * rad * 2.5, ctr[1] + sd[1] * rad * 2.5, ctr[2] + sd[2] * rad * 2.5];
      const sb = P.length / 3;
      for (let a = 0; a <= SLA; a++) for (let b = 0; b < SLO; b++) { const th = (Math.PI * a) / SLA, ph = (2 * Math.PI * b) / SLO; const n: V = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; push([sc[0] + n[0] * sr, sc[1] + n[1] * sr, sc[2] + n[2] * sr], n, k, 3 + layer, c.chain, [1, 0, 0], 0); }
      for (let a = 0; a < SLA; a++) for (let b = 0; b < SLO; b++) { const b1 = (b + 1) % SLO; const i0 = sb + a * SLO + b, i1 = sb + a * SLO + b1, j0 = sb + (a + 1) * SLO + b, j1 = sb + (a + 1) * SLO + b1; ID.push(i0, i1, j0, i1, j1, j0); }
    }
    const base = P.length / 3;
    for (let a = 0; a <= LAT; a++)
      for (let b = 0; b < LON; b++) {
        const th = (Math.PI * a) / LAT, ph = (2 * Math.PI * b) / LON;
        const n: V = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const wob = 1 + (opt.flickDots ? 0.05 : hash(hd + 91) < 0.3 ? 0.55 : 0.2) * Math.sin(ph * 3 + hd) * Math.sin(th * 2 + hd * 0.3);
        const el2 = opt.flickDots ? 1 : 1 + 1.6 * hash(hd + 77);   // elongated teardrop along a random axis
        push([ctr[0] + n[0] * rad * wob * el2, ctr[1] + n[1] * rad * 0.7 * wob, ctr[2] + n[2] * rad * wob], n, k, 3 + layer, c.chain, [1, 0, 0], 0);
      }
    for (let a = 0; a < LAT; a++)
      for (let b = 0; b < LON; b++) {
        const b1 = (b + 1) % LON;
        const i0 = base + a * LON + b, i1 = base + a * LON + b1, j0 = base + (a + 1) * LON + b, j1 = base + (a + 1) * LON + b1;
        ID.push(i0, i1, j0, i1, j1, j0); // outward winding
      }
  }
  return {
    ...m,
    positions: new Float32Array(P),
    normals: new Float32Array(N),
    surf: new Float32Array(SU),
    info: new Float32Array(IN),
    tangents: new Float32Array(TG),
    phys: new Float32Array(PH),
    centers: new Float32Array(CT),
    indices: new Uint32Array(ID),
    vertexCount: P.length / 3,
  };
}
