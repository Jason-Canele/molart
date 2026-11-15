/**
 * Face anchors for character styles (display only).
 * A few helices and strands (about a third, at most seven: those that look at the viewer in the default view,
 * are not hidden there and stand apart) get an anchor point on a broad side of their ribbon, placed so that
 * the face looks towards the default view and stands upright in it. The anchor is fixed to the ribbon:
 * it turns with the protein and is not re-chosen while the view changes. Nothing in the Structure is touched.
 */
import type { Structure } from '../model/structure';
import type { MeshData } from './ribbon';

type V = [number, number, number];
/** A short loop drawn as a rubber-hose arm: its element index, residue range and the residue parameter of its fist. */
export interface Arm { element: number; first: number; last: number; mid: number }

/**
 * Per-vertex (arc length of the face centre in Å, side × face radius in Å (0 = no face),
 * up code: ±1 = up along ±chain direction, ±2 = up along ±across direction,
 * element kind + random: 0 loop, 1.x helix, 2.x strand with x a per-element random number).
 */
export function faceAnchors(
  m: MeshData,
  s: Structure,
  viewDir: V,
  viewUp: V,
  /** keep faces at these residue parameters (element index → t), e.g. after the ribbon was rebuilt with head bulges */
  fixed?: Map<number, number>,
  /** arms chosen on the first pass (see the result), and the fist radius in Å to record for the shader */
  armPlan?: Arm[],
  fistRadius = 1.7,
): { attr: Float32Array; sites: { element: number; t: number; helix: boolean }[]; arms: Arm[] } {
  const nRes = s.residues.length;
  // secondary-structure elements: runs of equal state within a chain
  const sseOf = new Int32Array(nRes), start: number[] = [], length: number[] = [], kind: string[] = [];
  for (let i = 0; i < nRes; i++) {
    const r = s.residues[i], p = i > 0 ? s.residues[i - 1] : null;
    if (!p || p.chainIndex !== r.chainIndex || p.ss !== r.ss) { start.push(i); length.push(0); kind.push(r.ss); }
    sseOf[i] = start.length - 1;
    length[start.length - 1]++;
  }
  const best = new Int32Array(start.length).fill(-1), score = new Float64Array(start.length).fill(-2);
  const code = (i: number) => Math.round(m.surf[4 * i + 3]);
  const resOf = (i: number) => Math.max(0, Math.min(nRes - 1, Math.round(m.info[4 * i + 1])));
  for (let i = 0; i < m.vertexCount; i++) {
    const c = code(i);
    if (c !== 1 && c !== 2) continue;
    const res = resOf(i), e = sseOf[res];
    if (kind[e] !== (c === 1 ? 'H' : 'E') || length[e] < (c === 1 ? 6 : 4)) continue;
    if (Math.abs(m.info[4 * i + 2]) < 0.9 || Math.abs(m.surf[4 * i + 2]) > 0.3 || m.info[4 * i + 3] > 0.05) continue;
    if (c === 1 && m.info[4 * i + 2] < 0) continue;   // helices: outer side only, the inner side faces the helix axis
    const rel = (m.surf[4 * i] - start[e] + 0.5) / length[e];
    if (rel < 0.25 || rel > 0.72) continue;
    if (fixed && (!fixed.has(e) || Math.abs(m.surf[4 * i] - fixed.get(e)!) > 0.3)) continue;
    const sc = m.normals[3 * i] * viewDir[0] + m.normals[3 * i + 1] * viewDir[1] + m.normals[3 * i + 2] * viewDir[2];
    if (sc > score[e]) { score[e] = sc; best[e] = i; }
  }
  // Not every element becomes a character: keep the few that look at the viewer, are not hidden behind
  // other ribbons in the default view, and stand apart from each other.
  if (!fixed) {
    const cand: { e: number; rank: number; p: V }[] = [];
    const stride = Math.max(1, Math.floor(m.vertexCount / 20000));
    for (let e = 0; e < start.length; e++) {
      const v = best[e];
      if (v < 0) continue;
      const p: V = [m.positions[3 * v], m.positions[3 * v + 1], m.positions[3 * v + 2]];
      let hidden = score[e] < (kind[e] === 'H' ? 0.72 : 0.45);   // curved helix heads need a squarer view
      for (let k = 0; k < m.vertexCount && !hidden; k += stride) {
        const dx = m.positions[3 * k] - p[0], dy = m.positions[3 * k + 1] - p[1], dz = m.positions[3 * k + 2] - p[2];
        const ahead = dx * viewDir[0] + dy * viewDir[1] + dz * viewDir[2];
        if (ahead > 2.5 && dx * dx + dy * dy + dz * dz - ahead * ahead < 2.6) hidden = true;
      }
      best[e] = -1;
      if (!hidden) cand.push({ e, rank: score[e] * (0.6 + 0.4 * Math.min(1, length[e] / 10)), p });
      else cand.push({ e, rank: score[e] - 10, p });   // only used when nothing at all is visible
      (cand[cand.length - 1] as { v?: number }).v = v;
    }
    cand.sort((x, y) => y.rank - x.rank);
    const limit = Math.max(1, Math.min(7, Math.ceil(cand.length / 2)));
    const kept: V[] = [];
    for (const c of cand) {
      if (kept.length >= limit || (c.rank < 0 && kept.length > 0)) break;
      if (kept.some((q) => Math.hypot(q[0] - c.p[0], q[1] - c.p[1], q[2] - c.p[2]) < 7.5)) continue;
      kept.push(c.p);
      best[c.e] = (c as { v?: number }).v!;
    }
  }
  const anchor = new Float32Array(start.length * 3);   // arc, side*radius, up code
  const sites: { element: number; t: number; helix: boolean }[] = [];
  for (let e = 0; e < start.length; e++) {
    const v = best[e];
    if (v < 0) continue;
    const t = m.surf[4 * v];
    // the ring this vertex belongs to: its half-width, and the direction of increasing across-coordinate
    let half = 0, across: V | null = null;
    for (let k = Math.max(0, v - 64); k < Math.min(m.vertexCount, v + 64); k++) {
      if (Math.abs(m.surf[4 * k] - t) > 1e-5 || code(k) !== code(v)) continue;
      half = Math.max(half, Math.abs(m.phys[4 * k + 1]));
      const dy = m.phys[4 * k + 1] - m.phys[4 * v + 1];
      if (!across && Math.abs(dy) > 0.2 && Math.abs(k - v) <= 3) {
        const sg = Math.sign(dy);
        across = [(m.positions[3 * k] - m.positions[3 * v]) * sg, (m.positions[3 * k + 1] - m.positions[3 * v + 1]) * sg, (m.positions[3 * k + 2] - m.positions[3 * v + 2]) * sg];
      }
    }
    if (half < 0.3) continue;
    // upright in the default view: the face's "up" runs along the chain or across the ribbon, whichever is closer
    const unit = (d: V) => { const l = Math.hypot(d[0], d[1], d[2]) || 1; return (d[0] * viewUp[0] + d[1] * viewUp[1] + d[2] * viewUp[2]) / l; };
    const along = unit([m.tangents[3 * v], m.tangents[3 * v + 1], m.tangents[3 * v + 2]]);
    const acr = across ? unit(across) : 0;
    const useAcross = Math.abs(acr) > Math.abs(along);
    sites.push({ element: e, t, helix: code(v) === 1 });
    anchor[3 * e] = m.phys[4 * v];
    anchor[3 * e + 1] = Math.sign(m.info[4 * v + 2]) * half * (useAcross ? 0.92 : 1.3);
    anchor[3 * e + 2] = ((useAcross ? acr : along) >= 0 ? 1 : -1) * (useAcross ? 2 : 1);
  }
  // Arms: short loops that join two helices / strands become thin hoses with a gloved fist in the middle;
  // loops next to a character come first, and there are never more arms than a few.
  let arms: Arm[] = armPlan ?? [];
  if (!armPlan) {
    const faced = new Set(sites.map((f) => f.element));
    const pool: (Arm & { near: number })[] = [];
    for (let e = 1; e < start.length - 1; e++) {
      if (kind[e] !== 'C' || length[e] < 2 || length[e] > 6 || kind[e - 1] === 'C' || kind[e + 1] === 'C') continue;
      const a = start[e], b = start[e] + length[e] - 1;
      if (s.residues[a - 1].chainIndex !== s.residues[a].chainIndex || s.residues[b + 1].chainIndex !== s.residues[b].chainIndex) continue;
      pool.push({ element: e, first: a, last: b, mid: (a + b) / 2, near: Number(faced.has(e - 1)) + Number(faced.has(e + 1)) });
    }
    pool.sort((x, y) => y.near - x.near || x.element - y.element);
    arms = pool.slice(0, Math.max(1, Math.min(4, sites.length))).map(({ element, first, last, mid }) => ({ element, first, last, mid }));
  }
  const armOf = new Map(arms.map((a) => [a.element, a]));
  const fistArc = new Map<number, number>(), fistGap = new Map<number, number>();
  for (let i = 0; i < m.vertexCount; i++) {
    if (code(i) !== 0) continue;
    const a = armOf.get(sseOf[resOf(i)]);
    if (!a) continue;
    const gap = Math.abs(m.surf[4 * i] - a.mid);
    if (gap < (fistGap.get(a.element) ?? 1e9)) { fistGap.set(a.element, gap); fistArc.set(a.element, m.phys[4 * i]); }
  }
  const out = new Float32Array(m.vertexCount * 4);
  for (let i = 0; i < m.vertexCount; i++) {
    const c = code(i);
    if (c === 0 && armOf.has(sseOf[resOf(i)])) {
      // loops flagged as arms: (arc of the fist centre, fist radius, 0, 0.5)
      out[4 * i] = fistArc.get(sseOf[resOf(i)]) ?? -1e6;
      out[4 * i + 1] = fistRadius;
      out[4 * i + 3] = 0.5;
      continue;
    }
    if (c !== 1 && c !== 2) continue;
    const e = sseOf[resOf(i)];
    const h = Math.sin((e + 1) * 12.9898) * 43758.5453;
    out[4 * i + 3] = c + Math.min(0.999, h - Math.floor(h));
    if (kind[e] !== (c === 1 ? 'H' : 'E')) continue;
    out[4 * i] = anchor[3 * e];
    out[4 * i + 1] = anchor[3 * e + 1];
    out[4 * i + 2] = anchor[3 * e + 2];
  }
  return { attr: out, sites, arms };
}
