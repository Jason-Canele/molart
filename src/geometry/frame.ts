import type { Structure } from '../model/structure';

export interface ViewFrame {
  centre: [number, number, number];
  /** Principal axes (unit, right-handed): x = longest extent, y = second, z = view direction. */
  axes: [[number, number, number], [number, number, number], [number, number, number]];
  radius: number;
  /** Half extents of CA positions along the principal axes. */
  extent: [number, number, number];
}

/** Principal-axis frame of the CA trace, used for a pleasing default camera (coordinates untouched). */
export function principalFrame(s: Structure, chainIds?: string[]): ViewFrame {
  const sel = chainIds && chainIds.length ? s.residues.filter((r) => chainIds.includes(r.chainId)) : s.residues;
  const pts = (sel.length ? sel : s.residues).map((r) => [s.coords[3 * r.ca], s.coords[3 * r.ca + 1], s.coords[3 * r.ca + 2]]);
  const n = pts.length;
  const c = [0, 0, 0];
  for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / n;
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += ((p[i] - c[i]) * (p[j] - c[j])) / n;
  const { vectors } = jacobiEigen(C);
  let ax = vectors[0], ay = vectors[1];
  // deterministic sign convention
  const fix = (v: number[]) => {
    let k = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i;
    return v[k] < 0 ? v.map((x) => -x) : v;
  };
  ax = fix(ax);
  ay = fix(ay);
  const az = [ax[1] * ay[2] - ax[2] * ay[1], ax[2] * ay[0] - ax[0] * ay[2], ax[0] * ay[1] - ax[1] * ay[0]];
  let radius = 0;
  const ext = [0, 0, 0];
  for (const p of pts) {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    radius = Math.max(radius, Math.hypot(d[0], d[1], d[2]));
    const proj = [ax, ay, az].map((a) => Math.abs(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]));
    for (let i = 0; i < 3; i++) ext[i] = Math.max(ext[i], proj[i]);
  }
  return {
    centre: c as [number, number, number],
    axes: [ax, ay, az] as ViewFrame['axes'],
    radius: radius + 3,
    extent: ext.map((e) => e + 3) as [number, number, number],
  };
}

/** Symmetric 3x3 eigen-decomposition; eigenvectors sorted by descending eigenvalue. */
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const a = A.map((r) => [...r]);
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += a[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const order = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => [v[0][i], v[1][i], v[2][i]]) };
}
