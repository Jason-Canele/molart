/**
 * Molecular surface (display geometry) built from the immutable Structure.
 *
 * Every heavy atom of a chain contributes a Gaussian to a density grid; the surface is the level set of
 * that density, extracted with surface nets (one vertex per grid cell the surface passes through). It is a
 * smooth Gaussian surface, not a solvent-excluded (Connolly) surface: fine for drawing, not for measuring.
 * Each chain gets its own closed surface. Coordinates are only read.
 */
import type { Structure } from '../model/structure';
import type { MeshData } from './ribbon';

export interface SurfaceOptions {
  /** Width of each atom's Gaussian in Å (larger = smoother, blobbier). */
  sigma?: number;
  /** Density level of the surface (one isolated atom peaks at 1). */
  iso?: number;
  /** Grid spacing in Å; enlarged automatically for big structures. */
  spacing?: number;
  /** Upper bound on grid points per chain. */
  maxPoints?: number;
  /**
   * 0..1: make the body less regular (display only). Atoms get unequal weight, so some bumps swell and others
   * shrink or merge, and the density is modulated by slow noise fixed to the protein, so the body is lumpy
   * rather than evenly beaded. Bump sizes then no longer reflect atom sizes.
   */
  irregular?: number;
  /** average the enclosure probes over a cone (smooth shading on fine, steep surfaces) */
  softProbe?: boolean;
  /** use narrower Gaussians on small proteins so the fold stays readable */
  adaptSmall?: boolean;
}

const SS_CODE = { C: 0, H: 1, E: 2 } as const;

export function buildSurface(s: Structure, options: SurfaceOptions = {}): MeshData {
  const o = { sigma: 1.9, iso: 1.0, spacing: 1.1, maxPoints: 1.4e6, irregular: 0, softProbe: false, adaptSmall: false, ...options };
  // deterministic pseudo-random numbers and smooth 3D noise, fixed to the protein's coordinates
  const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lat = (i: number, j: number, k: number) => rnd(i * 157.31 + j * 113.97 + k * 71.13);
  const noise3 = (x: number, y: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    let u = x - i, v = y - j, w = z - k;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
    const a = (di: number, dj: number, dk: number) => lat(i + di, j + dj, k + dk);
    const c00 = a(0, 0, 0) * (1 - u) + a(1, 0, 0) * u, c10 = a(0, 1, 0) * (1 - u) + a(1, 1, 0) * u;
    const c01 = a(0, 0, 1) * (1 - u) + a(1, 0, 1) * u, c11 = a(0, 1, 1) * (1 - u) + a(1, 1, 1) * u;
    return (c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w;
  };
  const P: number[] = [], N: number[] = [], SU: number[] = [], IN: number[] = [], PH: number[] = [], IDX: number[] = [];
  // CA-only models have a fraction of the atoms: widen the Gaussians so the chain still closes into a body
  // a small protein drawn with wide Gaussians is a featureless blob: narrow them (and lower the level to match the
  // thinner overlap) so its helices and grooves still read; from 300 residues up the style's own values apply
  const small = o.adaptSmall && !s.caOnly ? Math.max(0, Math.min(1, (300 - s.residues.length) / 200)) : 0;
  const shrink = 1 - 0.36 * small;
  const sigma = s.caOnly ? Math.max(o.sigma, 3.3) : o.sigma * shrink;
  o.iso *= Math.pow(shrink, 2.2);

  for (const chain of s.chains) {
    // heavy atoms of this chain, each remembering its residue
    const ax: number[] = [], owner: number[] = [];
    for (let r = chain.residueStart; r < chain.residueEnd; r++) {
      const res = s.residues[r];
      for (let a = res.atomStart; a < res.atomEnd; a++) {
        const el = s.atomElements[a];
        if (el === 'H' || el === 'D') continue;
        ax.push(s.coords[3 * a], s.coords[3 * a + 1], s.coords[3 * a + 2]);
        owner.push(r);
      }
    }
    const nAtoms = owner.length;
    if (nAtoms === 0) continue;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nAtoms; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], ax[3 * i + k]); hi[k] = Math.max(hi[k], ax[3 * i + k]); }
    const cut = 3.5 * sigma;
    let h = o.spacing;
    const dims = (hh: number) => [0, 1, 2].map((k) => Math.ceil((hi[k] - lo[k] + 2 * (cut + 2 * hh)) / hh) + 1);
    while (dims(h).reduce((a, b) => a * b, 1) > o.maxPoints) h *= 1.15;
    const [nx, ny, nz] = dims(h);
    const org = [lo[0] - cut - 2 * h, lo[1] - cut - 2 * h, lo[2] - cut - 2 * h];
    const V = new Float32Array(nx * ny * nz), W = new Float32Array(nx * ny * nz), O = new Int32Array(nx * ny * nz).fill(-1);
    const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
    const inv = 1 / (2 * sigma * sigma), rc = Math.ceil(cut / h);
    for (let a = 0; a < nAtoms; a++) {
      const x = ax[3 * a], y = ax[3 * a + 1], z = ax[3 * a + 2];
      const ci = Math.round((x - org[0]) / h), cj = Math.round((y - org[1]) / h), ck = Math.round((z - org[2]) / h);
      // unequal atoms: a weight between about a quarter and four times the normal one
      const wa = o.irregular > 0 ? Math.exp(o.irregular * 1.4 * (rnd(x * 3.1 + y * 5.7 + z * 7.3) * 2 - 1)) : 1;
      for (let k = Math.max(0, ck - rc); k <= Math.min(nz - 1, ck + rc); k++) {
        const dz = org[2] + k * h - z;
        for (let j = Math.max(0, cj - rc); j <= Math.min(ny - 1, cj + rc); j++) {
          const dy = org[1] + j * h - y;
          for (let i = Math.max(0, ci - rc); i <= Math.min(nx - 1, ci + rc); i++) {
            const dx = org[0] + i * h - x;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > cut * cut) continue;
            const w = wa * Math.exp(-d2 * inv), q = at(i, j, k);
            V[q] += w;
            if (w > W[q]) { W[q] = w; O[q] = owner[a]; }
          }
        }
      }
    }
    // a second, coarse field (4 Å Gaussians on a 3 Å grid) tells how much of the chain's mass surrounds a spot
    const ch = 3, cs = 4, ccut = 2.5 * cs;
    const cdim = [0, 1, 2].map((k) => Math.ceil((hi[k] - lo[k] + 2 * (ccut + ch)) / ch) + 2);
    const corg = [lo[0] - ccut - ch, lo[1] - ccut - ch, lo[2] - ccut - ch];
    const C = new Float32Array(cdim[0] * cdim[1] * cdim[2]);
    const crc = Math.ceil(ccut / ch), cinv = 1 / (2 * cs * cs);
    for (let a = 0; a < nAtoms; a++) {
      const x = ax[3 * a], y = ax[3 * a + 1], z = ax[3 * a + 2];
      const ci = Math.round((x - corg[0]) / ch), cj = Math.round((y - corg[1]) / ch), ck = Math.round((z - corg[2]) / ch);
      for (let k = Math.max(0, ck - crc); k <= Math.min(cdim[2] - 1, ck + crc); k++)
        for (let j = Math.max(0, cj - crc); j <= Math.min(cdim[1] - 1, cj + crc); j++)
          for (let i = Math.max(0, ci - crc); i <= Math.min(cdim[0] - 1, ci + crc); i++) {
            const dx = corg[0] + i * ch - x, dy = corg[1] + j * ch - y, dz = corg[2] + k * ch - z;
            C[i + cdim[0] * (j + cdim[1] * k)] += Math.exp(-(dx * dx + dy * dy + dz * dz) * cinv);
          }
    }
    const coarse = (x: number, y: number, z: number) => {
      const fx = Math.min(cdim[0] - 1.001, Math.max(0, (x - corg[0]) / ch)), fy = Math.min(cdim[1] - 1.001, Math.max(0, (y - corg[1]) / ch)), fz = Math.min(cdim[2] - 1.001, Math.max(0, (z - corg[2]) / ch));
      const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k;
      const q = i + cdim[0] * (j + cdim[1] * k), sx = 1, sy = cdim[0], sz = cdim[0] * cdim[1];
      const c00 = C[q] * (1 - u) + C[q + sx] * u, c10 = C[q + sy] * (1 - u) + C[q + sy + sx] * u;
      const c01 = C[q + sz] * (1 - u) + C[q + sz + sx] * u, c11 = C[q + sz + sy] * (1 - u) + C[q + sz + sy + sx] * u;
      return (c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w;
    };
    // typical value deep inside a protein (0.09 heavy atoms per Å3), used to scale the coarse field to 0..1
    const cFull = 0.09 * Math.pow(2 * Math.PI * cs * cs, 1.5);
    if (o.irregular > 0) {
      // slow lumps: the density swells and thins over a few ångström
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = org[0] + i * h, y = org[1] + j * h, z = org[2] + k * h;
        const n = 0.65 * noise3(x * 0.28, y * 0.28, z * 0.28) + 0.35 * noise3(x * 0.75 + 9.1, y * 0.75 + 3.3, z * 0.75 + 5.7);
        V[at(i, j, k)] *= Math.exp(o.irregular * 1.6 * (n - 0.5));
      }
    }
    // trilinear density lookup (object coordinates)
    const sample = (x: number, y: number, z: number) => {
      const fx = Math.min(nx - 1.001, Math.max(0, (x - org[0]) / h)), fy = Math.min(ny - 1.001, Math.max(0, (y - org[1]) / h)), fz = Math.min(nz - 1.001, Math.max(0, (z - org[2]) / h));
      const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k;
      const q = at(i, j, k);
      const c00 = V[q] * (1 - u) + V[q + 1] * u, c10 = V[q + nx] * (1 - u) + V[q + nx + 1] * u;
      const c01 = V[q + nx * ny] * (1 - u) + V[q + nx * ny + 1] * u, c11 = V[q + nx * ny + nx] * (1 - u) + V[q + nx * ny + nx + 1] * u;
      return (c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w;
    };

    // --- surface nets: one vertex per cell crossed by the surface ---
    const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
    const cat = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
    const base = P.length / 3;
    const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const val = new Float64Array(8);
    for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let inside = 0;
      for (let c = 0; c < 8; c++) { val[c] = V[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])] - o.iso; if (val[c] > 0) inside++; }
      if (inside === 0 || inside === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of edges) {
        if (val[a] > 0 === val[b] > 0) continue;
        const t = val[a] / (val[a] - val[b]);
        sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
        sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
        sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
        n++;
      }
      const x = org[0] + (i + sx / n) * h, y = org[1] + (j + sy / n) * h, z = org[2] + (k + sz / n) * h;
      // outward normal = downhill direction of the density
      const e = h * 0.75;
      let gx = sample(x - e, y, z) - sample(x + e, y, z), gy = sample(x, y - e, z) - sample(x, y + e, z), gz = sample(x, y, z - e) - sample(x, y, z + e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      // how enclosed the spot is: density a little way out along the normal (0 open … ~1+ in a groove)
      const d1 = Math.max(1.3, 1.257 * sigma), d2 = Math.max(3.0, 2.571 * sigma);   // probe distances follow the level of detail
      let near = sample(x + gx * d1, y + gy * d1, z + gz * d1) / o.iso;
      let far = sample(x + gx * d2, y + gy * d2, z + gz * d2) / o.iso;
      if (o.softProbe) {
        // a fine surface has a steep density, so a single probe is all-or-nothing and shading built on it gets
        // ragged edges; average the occupancy over a cone of probes instead
        let ux = gy, uy = -gx, uz = 0;
        if (Math.abs(gz) > 0.9) { ux = 0; uy = gz; uz = -gy; }
        const ul = Math.hypot(ux, uy, uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        const wx = gy * uz - gz * uy, wy = gz * ux - gx * uz, wz = gx * uy - gy * ux;
        const cone = (d: number, tilt: number, n: number, rot: number) => {
          let acc = Math.min(1, sample(x + gx * d, y + gy * d, z + gz * d) / o.iso);
          const c = Math.cos(tilt), sn = Math.sin(tilt);
          for (let q = 0; q < n; q++) {
            const a = rot + (q * 2 * Math.PI) / n, ca = Math.cos(a) * sn, sa = Math.sin(a) * sn;
            const dx = gx * c + ux * ca + wx * sa, dy = gy * c + uy * ca + wy * sa, dz = gz * c + uz * ca + wz * sa;
            acc += Math.min(1, sample(x + dx * d, y + dy * d, z + dz * d) / o.iso);
          }
          return acc / (n + 1);
        };
        near = 0.5 * (cone(1.2, 0.5, 5, 0) + cone(1.8, 0.7, 5, 0.6));
        far = (cone(2.6, 0.45, 5, 0.3) + cone(3.6, 0.6, 6, 0.9) + cone(4.8, 0.5, 6, 0.1)) / 3;
      }
      const res = Math.max(0, O[at(Math.round(i + sx / n), Math.round(j + sy / n), Math.round(k + sz / n))]);
      cellVert[cat(i, j, k)] = P.length / 3 - base;
      P.push(x, y, z);
      N.push(gx, gy, gz);
      // a constant chain parameter: the contour pass must not read neighbouring residues as separate pieces
      SU.push(chain.index * 10, 0, 0, SS_CODE[s.residues[res].ss]);
      IN.push(chain.index, res, 1, 0);
      // large-scale enclosure: the chain's mass 5 Å out along the normal (0 on an exposed knob, towards 1 in a cleft)
      const wide = Math.min(1, coarse(x + gx * 5, y + gy * 5, z + gz * 5) / cFull);
      PH.push(Math.min(2, near), Math.min(2, far), wide, 0);
    }
    const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      a += base; b += base; c += base; d += base;
      if (flip) IDX.push(a, c, b, a, d, c);
      else IDX.push(a, b, c, a, c, d);
    };
    // a quad for every grid edge the surface crosses, joining the four cells around that edge
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const v0 = V[at(i, j, k)] > o.iso;
      if (v0 !== V[at(i + 1, j, k)] > o.iso) quad(cellVert[cat(i, j - 1, k - 1)], cellVert[cat(i, j, k - 1)], cellVert[cat(i, j, k)], cellVert[cat(i, j - 1, k)], !v0);
      if (v0 !== V[at(i, j + 1, k)] > o.iso) quad(cellVert[cat(i - 1, j, k - 1)], cellVert[cat(i, j, k - 1)], cellVert[cat(i, j, k)], cellVert[cat(i - 1, j, k)], v0);
      if (v0 !== V[at(i, j, k + 1)] > o.iso) quad(cellVert[cat(i - 1, j - 1, k)], cellVert[cat(i, j - 1, k)], cellVert[cat(i, j, k)], cellVert[cat(i - 1, j, k)], !v0);
    }
  }

  const count = P.length / 3;
  // make every triangle wind counter-clockwise seen from outside (the shader flips normals on back faces)
  for (let t = 0; t < IDX.length; t += 3) {
    const a = IDX[t], b = IDX[t + 1], c = IDX[t + 2];
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2];
    const vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (N[3 * a] + N[3 * b] + N[3 * c]) + fy * (N[3 * a + 1] + N[3 * b + 1] + N[3 * c + 1]) + fz * (N[3 * a + 2] + N[3 * b + 2] + N[3 * c + 2]) < 0) { IDX[t + 1] = c; IDX[t + 2] = b; }
  }
  const tangents = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) tangents[3 * i] = 1;
  return {
    positions: new Float32Array(P),
    normals: new Float32Array(N),
    surf: new Float32Array(SU),
    info: new Float32Array(IN),
    tangents,
    phys: new Float32Array(PH),
    centers: new Float32Array(P),
    indices: new Uint32Array(IDX),
    vertexCount: count,
    segments: [],
    gaps: 0,
  };
}
