/**
 * Dalí "melting" — an ARTISTIC deformation of the *display mesh only*.
 *
 * Input MeshData is copied; the Structure (atomic coordinates) is never read or
 * written here. Results must be labelled in the UI as artistic interpretation,
 * not a physical conformation.
 */
import type { MeshData } from './ribbon';

type V = [number, number, number];

function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const vnoise = (x: number, seed: number) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i * 7919 + seed * 104729) * (1 - u) + hash((i + 1) * 7919 + seed * 104729) * u;
};

export interface MeltOptions {
  /** 0 = no deformation, 1 = strong melting. */
  amount: number;
  /** Unit "gravity" direction in model space. */
  gravity: V;
  seed: number;
  /** Drip density multiplier. */
  drips?: number;
}

export function meltMesh(m: MeshData, opt: MeltOptions): MeshData {
  const a = Math.max(0, Math.min(1, opt.amount));
  const g = opt.gravity;
  const seed = opt.seed | 0;
  const P = new Float32Array(m.positions);
  const n = m.vertexCount;
  // 1) sag: smooth along the chain so nothing tears; lower side stretches further
  for (let i = 0; i < n; i++) {
    const t = m.surf[4 * i];
    const cx = m.centers[3 * i], cy = m.centers[3 * i + 1], cz = m.centers[3 * i + 2];
    const ox = P[3 * i] - cx, oy = P[3 * i + 1] - cy, oz = P[3 * i + 2] - cz;
    const ol = Math.hypot(ox, oy, oz) || 1;
    const bottom = Math.max(0, (ox * g[0] + oy * g[1] + oz * g[2]) / ol);
    const field = vnoise(t * 0.18, seed) ** 1.5;
    const droop = a * (0.6 + 2.6 * field);
    const stretch = Math.min(1.5, a * (0.5 + 2.4 * vnoise(t * 0.55 + 31.7, seed)) * bottom * bottom * bottom);   // lower edge drapes; capped at ~0.5x ribbon width
    // strands melt along their lower edge in a scalloped, dripping fringe
    const scallop = m.surf[4 * i + 3] > 1.5 && m.surf[4 * i + 3] < 2.5 ? a * 1.1 * Math.sqrt(bottom) * Math.max(0, Math.sin(m.phys[4 * i] * 1.7 + vnoise(t * 0.9, seed) * 4)) ** 2 : 0;
    const d = droop + stretch + 0 * scallop;
    P[3 * i] += g[0] * d;
    P[3 * i + 1] += g[1] * d;
    P[3 * i + 2] += g[2] * d;
  }
  const out: MeshData = {
    ...m,
    positions: P,
    normals: new Float32Array(m.normals),
    indices: new Uint32Array(m.indices),
  };
  recomputeNormals(out);
  if (a <= 0) return out;
  return appendDrips(out, a, g, seed, opt.drips ?? 1);
}

/** Area-weighted vertex normals; keeps original normals where a vertex has no faces. */
function recomputeNormals(m: MeshData) {
  const acc = new Float32Array(m.vertexCount * 3);
  const P = m.positions, I = m.indices;
  for (let k = 0; k < I.length; k += 3) {
    const a = I[k], b = I[k + 1], c = I[k + 2];
    const e1 = [P[3 * b] - P[3 * a], P[3 * b + 1] - P[3 * a + 1], P[3 * b + 2] - P[3 * a + 2]];
    const e2 = [P[3 * c] - P[3 * a], P[3 * c + 1] - P[3 * a + 1], P[3 * c + 2] - P[3 * a + 2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    for (const v of [a, b, c]) {
      acc[3 * v] += nx;
      acc[3 * v + 1] += ny;
      acc[3 * v + 2] += nz;
    }
  }
  for (let v = 0; v < m.vertexCount; v++) {
    const l = Math.hypot(acc[3 * v], acc[3 * v + 1], acc[3 * v + 2]);
    if (l > 1e-12) {
      // keep orientation consistent with the original outward normal
      const s = acc[3 * v] * m.normals[3 * v] + acc[3 * v + 1] * m.normals[3 * v + 1] + acc[3 * v + 2] * m.normals[3 * v + 2] < 0 ? -1 : 1;
      m.normals[3 * v] = (s * acc[3 * v]) / l;
      m.normals[3 * v + 1] = (s * acc[3 * v + 1]) / l;
      m.normals[3 * v + 2] = (s * acc[3 * v + 2]) / l;
    }
  }
}

/** Teardrop drips hanging from the lowest point of selected ribbon rings. ssCode 3 marks drip vertices. */
function appendDrips(m: MeshData, a: number, g: V, seed: number, density: number): MeshData {
  // collect lowest vertex per integer residue sample (ring at integer t)
  const lowest = new Map<number, { vi: number; score: number }>();
  for (let i = 0; i < m.vertexCount; i++) {
    const t = m.surf[4 * i];
    if (Math.abs(t - Math.round(t)) > 1e-4 || m.info[4 * i + 3] > 0) continue;
    const key = Math.round(t);
    const ox = m.positions[3 * i] - m.centers[3 * i], oy = m.positions[3 * i + 1] - m.centers[3 * i + 1], oz = m.positions[3 * i + 2] - m.centers[3 * i + 2];
    const score = ox * g[0] + oy * g[1] + oz * g[2] + (m.positions[3 * i] * g[0] + m.positions[3 * i + 1] * g[1] + m.positions[3 * i + 2] * g[2]) * 0.02;
    const cur = lowest.get(key);
    if ((ox * g[0] + oy * g[1] + oz * g[2]) / (Math.hypot(ox, oy, oz) || 1) < 0.35) continue; // only edges facing down
    if (!cur || score > cur.score) lowest.set(key, { vi: i, score });
  }
  // a stable basis perpendicular to gravity
  const ref: V = Math.abs(g[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let e1: V = [g[1] * ref[2] - g[2] * ref[1], g[2] * ref[0] - g[0] * ref[2], g[0] * ref[1] - g[1] * ref[0]];
  const l1 = Math.hypot(...e1);
  e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
  const e2: V = [g[1] * e1[2] - g[2] * e1[1], g[2] * e1[0] - g[0] * e1[2], g[0] * e1[1] - g[1] * e1[0]];

  const P = Array.from(m.positions), N = Array.from(m.normals), SU = Array.from(m.surf), IN = Array.from(m.info);
  const TG = Array.from(m.tangents), PH = Array.from(m.phys), CT = Array.from(m.centers), ID = Array.from(m.indices);
  const RINGS = 72, SEG = 16;
  const keys = [...lowest.keys()].sort((x, y) => x - y);
  let lastDrip = -99;
  for (const k of keys) {
    const h = hash(k * 31 + seed * 977);
    if (h > 0.24 * density * (0.5 + a) || k - lastDrip < 5) continue;
    lastDrip = k;
    const { vi } = lowest.get(k)!;
    const A: V = [m.positions[3 * vi], m.positions[3 * vi + 1], m.positions[3 * vi + 2]];
    // classic drip: leaves the ribbon thin, swells as it falls, ends in a rounded teardrop
    const L = a * (4.0 + 3.0 * Math.pow(hash(k * 17 + seed * 13 + 5), 1.5));
    const neck = 0.2 + 0.05 * hash(k * 3 + seed);
    const bulb = 0.5 + 0.12 * hash(k * 11 + seed);
    const base = P.length / 3;
    for (let ri = 0; ri <= RINGS; ri++) {
      const s = 1 - Math.pow(1 - ri / RINGS, 1.6);   // denser sampling toward the bulb
      const z = s * L;
      const u = z / L;
      const r0d = ri === RINGS ? 0 : (u < 0.7 ? neck + (bulb - neck) * Math.pow(u / 0.7, 1.4) : bulb * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.7) / 0.3, 2))));
      const r = ri === RINGS ? 0 : Math.max(r0d, 0.42 * Math.exp(-z * 3.5));   // fillet joins the drip to its ribbon edge
      const lean = (0.18 + 0.2 * hash(k * 7 + seed)) * (hash(k * 13 + seed) < 0.5 ? -1 : 1);   // 5-15° bend
      const sway = lean * z * z / L;
      const c: V = [A[0] + g[0] * (z - 0.25) + e1[0] * sway, A[1] + g[1] * (z - 0.25) + e1[1] * sway, A[2] + g[2] * (z - 0.25) + e1[2] * sway];
      for (let j = 0; j < SEG; j++) {
        const th = (2 * Math.PI * j) / SEG;
        const dir: V = [e1[0] * Math.cos(th) + e2[0] * Math.sin(th), e1[1] * Math.cos(th) + e2[1] * Math.sin(th), e1[2] * Math.cos(th) + e2[2] * Math.sin(th)];
        P.push(c[0] + dir[0] * r, c[1] + dir[1] * r, c[2] + dir[2] * r);
        N.push(...dir);
        SU.push(k, j / SEG, Math.cos(th), 3);
        IN.push(m.info[4 * vi], m.info[4 * vi + 1], 0, 0);
        TG.push(...g);
        PH.push(m.phys[4 * vi] + L * s, Math.cos(th) * r, Math.sin(th) * r, (j / SEG) * 2 * Math.PI * r);
        CT.push(...c);
      }
    }
    for (let ri = 0; ri < RINGS; ri++)
      for (let j = 0; j < SEG; j++) {
        const j1 = (j + 1) % SEG;
        const a0 = base + ri * SEG + j, a1 = base + ri * SEG + j1, b0 = base + (ri + 1) * SEG + j, b1 = base + (ri + 1) * SEG + j1;
        ID.push(a0, a1, b0, a1, b1, b0);
      }
  }
  const out: MeshData = {
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
  // smooth drip normals (rings are closed tubes)
  recomputeNormals(out); // smooth shading over drips (necks and rounded bulbs)
  return out;
}
