import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { loadStructure, parseRaw } from '../src/io/load';
import { coordinateFingerprint, Structure } from '../src/model/structure';
import { StructureParseError } from '../src/io/types';
import { backboneSegments, buildRibbon, flatten, MeshData } from '../src/geometry/ribbon';
import { meltMesh } from '../src/geometry/dali';
import { splatterMesh } from '../src/geometry/splatter';
import { principalFrame } from '../src/geometry/frame';

const sample = (f: string) => readFileSync(new URL(`../public/samples/${f}`, import.meta.url), 'utf8');
const load = (f: string, opts = {}) => loadStructure(sample(f), f, opts);

describe('parsing', () => {
  test.each(['1UBQ', '3CHY', '4HHB', '1TIM'])('%s: PDB and mmCIF are semantically equivalent', (id) => {
    const a = load(`${id}.pdb`), b = load(`${id}.cif`);
    expect(b.residues.length).toBe(a.residues.length);
    expect(b.chains.map((c) => c.id)).toEqual(a.chains.map((c) => c.id));
    expect(b.coords.length).toBe(a.coords.length);
    let maxD = 0;
    for (let i = 0; i < a.coords.length; i++) maxD = Math.max(maxD, Math.abs(a.coords[i] - b.coords[i]));
    expect(maxD).toBeLessThan(1e-3); // parser tolerance (PDB has 3 decimals)
    expect(b.residues.map((r) => r.ss).join('')).toBe(a.residues.map((r) => r.ss).join(''));
    expect(b.residues.map((r) => `${r.chainId}${r.resSeq}${r.iCode}${r.name}`)).toEqual(a.residues.map((r) => `${r.chainId}${r.resSeq}${r.iCode}${r.name}`));
  });

  test('1TIM: two chains of 247 residues, secondary structure from file', () => {
    const s = load('1TIM.cif');
    expect(s.chains.map((c) => [c.id, c.residueEnd - c.residueStart])).toEqual([
      ['A', 247],
      ['B', 247],
    ]);
    expect(s.ssSource).toBe('file');
    const h = s.residues.filter((r) => r.ss === 'H').length, e = s.residues.filter((r) => r.ss === 'E').length;
    expect(h).toBeGreaterThan(150);
    expect(e).toBeGreaterThan(60); // eight-stranded barrel per chain
  });

  test('4HHB: four chains (multi-chain) with all-α fold', () => {
    const s = load('4HHB.pdb');
    expect(s.chains.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(s.residues.filter((r) => r.ss === 'E').length).toBe(0);
  });

  test('malformed and empty input give helpful errors', () => {
    expect(() => loadStructure('', 'x.pdb')).toThrow(StructureParseError);
    expect(() => loadStructure('hello world', 'x.txt')).toThrow(/Unrecognised/);
    expect(() => loadStructure('HEADER    TEST\nEND\n', 'x.pdb')).toThrow(/No ATOM/);
    expect(() => loadStructure('ATOM      1  CA  ALA A   1      abc     0.000   0.000  1.00  0.00           C\n', 'x.pdb')).toThrow(/invalid coordinates/);
    expect(() => loadStructure('HETATM    1  O   HOH A   1       0.000   0.000   0.000  1.00  0.00           O\n', 'x.pdb')).toThrow(/No protein/);
    expect(() => loadStructure('data_x\nloop_\n_atom_site.id\n_atom_site.Cartn_x\n1\n', 'x.cif')).toThrow(StructureParseError);
  });

  test('alternate locations: first altLoc kept, notes recorded', () => {
    const lines = [
      'ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N',
      'ATOM      2  CA AALA A   1       1.458   0.000   0.000  0.50  0.00           C',
      'ATOM      3  CA BALA A   1       1.500   0.100   0.000  0.50  0.00           C',
      'ATOM      4  C   ALA A   1       2.009   1.420   0.000  1.00  0.00           C',
      'ATOM      5  O   ALA A   1       1.251   2.390   0.000  1.00  0.00           O',
    ];
    const s = loadStructure(lines.join('\n'), 'alt.pdb');
    expect(s.coords.length / 3).toBe(4);
    expect(s.coords[3]).toBeCloseTo(1.458);
    expect(s.notes.join(' ')).toMatch(/altLoc/);
  });

  test('insertion codes are preserved as distinct residues', () => {
    const raw = parseRaw(sample('1UBQ.pdb'), '1UBQ.pdb');
    // fabricate an insertion residue by duplicating residue 10 with icode A
    const r10 = raw.atoms.filter((a) => a.resSeq === 10);
    const ins = r10.map((a) => ({ ...a, iCode: 'A', x: a.x + 0.01 }));
    const at = raw.atoms.findIndex((a) => a.resSeq === 11);
    const text = [...raw.atoms.slice(0, at), ...ins, ...raw.atoms.slice(at)]
      .map((a, i) =>
        `ATOM  ${String(i + 1).padStart(5)} ${a.name.padEnd(4).length === 4 && a.name.length < 4 ? ' ' + a.name.padEnd(3) : a.name.padEnd(4)}${a.altLoc || ' '}${a.resName.padStart(3)} ${a.chainId}${String(a.resSeq).padStart(4)}${a.iCode || ' '}   ${a.x.toFixed(3).padStart(8)}${a.y.toFixed(3).padStart(8)}${a.z.toFixed(3).padStart(8)}  1.00  0.00          ${a.element.padStart(2)}`,
      )
      .join('\n');
    const s = loadStructure(text, 'ins.pdb');
    expect(s.residues.length).toBe(77);
    expect(s.residues.filter((r) => r.resSeq === 10).map((r) => r.iCode)).toEqual(['', 'A']);
  });
});

describe('secondary structure fallbacks', () => {
  test('DSSP-like assignment agrees substantially with author records', () => {
    for (const id of ['1UBQ', '3CHY', '1TIM']) {
      const f = load(`${id}.pdb`), c = load(`${id}.pdb`, { ss: 'computed' });
      expect(c.ssSource).toBe('computed-dssp');
      const agree = f.residues.filter((r, i) => r.ss === c.residues[i].ss).length / f.residues.length;
      expect(agree).toBeGreaterThan(0.78);
    }
  });

  test('CA-only structures use an explicit, documented fallback', () => {
    const ca = sample('3CHY.pdb')
      .split('\n')
      .filter((l) => l.startsWith('ATOM') && l.substring(12, 16).trim() === 'CA')
      .join('\n');
    const s = loadStructure(ca, '3CHY-ca.pdb');
    expect(s.caOnly).toBe(true);
    expect(s.ssSource).toBe('computed-ca');
    expect(s.notes.join(' ')).toMatch(/CA-only/);
    const full = load('3CHY.pdb');
    const agree = full.residues.filter((r, i) => r.ss === s.residues[i].ss).length / full.residues.length;
    expect(agree).toBeGreaterThan(0.6);
    const m = buildRibbon(s);
    expect(m.vertexCount).toBeGreaterThan(1000);
    expect([...m.positions].every(Number.isFinite)).toBe(true);
  });
});

describe('geometry', () => {
  test('residue gaps split the backbone into segments', () => {
    const lines = sample('1UBQ.pdb')
      .split('\n')
      .filter((l) => !(l.startsWith('ATOM') && +l.substring(22, 26) >= 30 && +l.substring(22, 26) <= 33));
    const s = loadStructure(lines.join('\n'), 'gap.pdb');
    const segs = backboneSegments(s);
    expect(segs.length).toBe(2);
    expect(buildRibbon(s).gaps).toBe(1);
  });

  test('triangle winding matches outward normals', () => {
    const m = buildRibbon(load('1UBQ.pdb'));
    let agree = 0;
    const n = m.indices.length / 3;
    for (let k = 0; k < m.indices.length; k += 3) {
      const [a, b, c] = [m.indices[k], m.indices[k + 1], m.indices[k + 2]];
      const P = (i: number) => [m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]];
      const A = P(a), B = P(b), C = P(c);
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const vn = [0, 1, 2].map((i) => m.normals[3 * a + i] + m.normals[3 * b + i] + m.normals[3 * c + i]);
      if (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] > 0) agree++;
    }
    expect(agree / n).toBeGreaterThan(0.97);
  });

  test('ribbon follows the CA trace (scientific geometry is not distorted)', () => {
    const s = load('3CHY.pdb');
    const m = buildRibbon(s);
    // every non-strand residue's CA lies on the spline centre line (sample at integer t)
    let maxD = 0;
    for (let i = 0; i < m.vertexCount; i++) {
      const t = m.surf[4 * i];
      if (Math.abs(t - Math.round(t)) > 1e-6) continue;
      const r = s.residues[Math.round(t)];
      if (r.ss === 'E') continue;
      const d = Math.hypot(m.centers[3 * i] - s.coords[3 * r.ca], m.centers[3 * i + 1] - s.coords[3 * r.ca + 1], m.centers[3 * i + 2] - s.coords[3 * r.ca + 2]);
      maxD = Math.max(maxD, d);
    }
    expect(maxD).toBeLessThan(1e-3);
  });

  test('strand arrows point N→C', () => {
    const s = load('3CHY.pdb');
    const m = buildRibbon(s);
    // arrow vertices (info.w = 1) have t at or after the last residue of their strand minus 0.5
    for (let i = 0; i < m.vertexCount; i++) {
      if (m.info[4 * i + 3] < 0.5) continue;
      const k = Math.round(m.surf[4 * i]);
      expect(s.residues[k].ss).toBe('E');
      const next = s.residues[k + 1];
      expect(!next || next.ss !== 'E' || next.chainIndex !== s.residues[k].chainIndex).toBe(true);
    }
  });
});

describe('scientific invariants', () => {
  const variants = (s: Structure): MeshData[] => {
    const m = buildRibbon(s);
    const f = principalFrame(s);
    return [m, flatten(m), buildRibbon(s, { samplesPerResidue: 2, profileSegments: 6 }), meltMesh(m, { amount: 1, gravity: [-f.axes[1][0], -f.axes[1][1], -f.axes[1][2]], seed: 3 }), splatterMesh(m, { seed: 3 })];
  };

  test.each(['1TIM.cif', '4HHB.pdb', '1UBQ.pdb'])('%s: coordinates are bit-identical after every mesh/style variant', (f) => {
    const s = load(f);
    const before = coordinateFingerprint(s);
    const copy = Float64Array.from(s.coords);
    variants(s);
    expect(coordinateFingerprint(s)).toBe(before);
    expect(s.coords).toEqual(copy);
    expect(Object.isFrozen(s.residues)).toBe(true);
    expect(Object.isFrozen(s.residues[0])).toBe(true);
  });

  test('melting deforms only the display mesh, deterministically', () => {
    const s = load('1UBQ.pdb');
    const m = buildRibbon(s);
    const pos = Float32Array.from(m.positions);
    const a = meltMesh(m, { amount: 0.8, gravity: [0, -1, 0], seed: 5 });
    const b = meltMesh(m, { amount: 0.8, gravity: [0, -1, 0], seed: 5 });
    const c = meltMesh(m, { amount: 0.8, gravity: [0, -1, 0], seed: 6 });
    expect(m.positions).toEqual(pos); // input mesh untouched
    expect(a.positions).toEqual(b.positions);
    expect(a.positions).not.toEqual(c.positions);
    expect(a.vertexCount).toBeGreaterThan(m.vertexCount); // drips were added
    const zero = meltMesh(m, { amount: 0, gravity: [0, -1, 0], seed: 5 });
    expect(zero.positions).toEqual(m.positions);
  });
});

describe('art-mode shape tools', () => {
  const frame: [[number, number, number], [number, number, number], [number, number, number]] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const finite = (m: MeshData) => m.positions.every((v) => Number.isFinite(v)) && m.normals.every((v) => Number.isFinite(v));
  test('gap splits the ribbon into capped pieces and leaves the structure alone', () => {
    const s = load('1UBQ.pdb');
    const before = Array.from(s.coords);
    const a = buildRibbon(s, { smooth: { helix: 8 }, face: 'all', faceDir: [0, 0, 1], frame });
    const b = buildRibbon(s, { smooth: { helix: 8 }, face: 'all', faceDir: [0, 0, 1], frame, gap: 1.6 });
    expect(finite(b)).toBe(true);
    expect(b.vertexCount).not.toBe(a.vertexCount);
    expect(Array.from(s.coords)).toEqual(before);
  });
  test('sharp corners and hairline loops give a finite mesh', () => {
    const s = load('1UBQ.pdb');
    for (const path of ['polyline', 'manhattan'] as const) {
      const m = buildRibbon(s, { smooth: { helix: 8, strand: 4 }, path, sharp: true, face: 'all', faceDir: [0, 0, 1], frame, coilWidth: 0.6, outline: { coil: { kind: 'brush', min: 0.12 } } });
      expect(finite(m)).toBe(true);
      expect(m.indices.length).toBeGreaterThan(0);
    }
  });
});

describe('DNA / RNA', () => {
  test('reads nucleotides as polymer residues next to the protein', () => {
    const s = loadStructure(sample('1AAY.cif'), '1AAY.cif');
    expect(s.chains.map((c) => `${c.id}:${c.residueEnd - c.residueStart}:${s.residues[c.residueStart].kind}`)).toEqual(['B:11:nucleic', 'C:11:nucleic', 'A:85:protein']);
    expect(s.residues.filter((r) => r.kind === 'nucleic').every((r) => r.ss === 'C' && r.ca >= 0)).toBe(true);
    expect(s.caOnly).toBe(false);
  });
  test('draws a backbone band and one base slab per nucleotide, in science and art mode alike', () => {
    const s = loadStructure(sample('1BNA.cif'), '1BNA.cif');
    expect(s.residues.length).toBe(24);
    expect(s.ssSource).toBe('none');
    const before = coordinateFingerprint(s);
    const m = buildRibbon(s);
    for (const v of m.positions) expect(Number.isFinite(v)).toBe(true);
    // slabs carry code 2 and end exactly on the base's N1 (purine) / N3 (pyrimidine) atom
    const slabRes = new Set<number>();
    for (let i = 0; i < m.vertexCount; i++) if (Math.round(m.surf[4 * i + 3]) === 2) slabRes.add(m.info[4 * i + 1]);
    expect(slabRes.size).toBe(24);
    const r = s.residues[3], names = s.atomNames.slice(r.atomStart, r.atomEnd);
    const tip = r.atomStart + names.indexOf(names.includes('N9') ? 'N1' : 'N3');
    let best = Infinity;
    for (let i = 0; i < m.vertexCount; i++) {
      if (m.info[4 * i + 1] !== 3 || Math.round(m.surf[4 * i + 3]) !== 2) continue;
      best = Math.min(best, Math.hypot(m.centers[3 * i] - s.coords[3 * tip], m.centers[3 * i + 1] - s.coords[3 * tip + 1], m.centers[3 * i + 2] - s.coords[3 * tip + 2]));
    }
    expect(best).toBeLessThan(1e-3);
    const art = buildRibbon(s, { smooth: { helix: 8, coil: 5 }, exaggerate: 1, outline: { coil: { kind: 'brush' } }, runs: true });
    expect(Array.from(art.positions)).toEqual(Array.from(m.positions));
    expect(coordinateFingerprint(s)).toBe(before);
  });
  test('leaves a lone nucleotide ligand out', () => {
    const atom = (n: number, name: string, x: number) => `HETATM${String(n).padStart(5)} ${name.padEnd(4)} AMP A   1    ${x.toFixed(3).padStart(8)}   0.000   0.000  1.00  0.00`;
    const lone = [atom(1, ' P', 0), atom(2, " C4'", 3), atom(3, " C1'", 5), atom(4, ' N9', 6.5), atom(5, ' N1', 10)].join('\n') + '\n';
    expect(() => loadStructure(lone, 'x.pdb')).toThrow(/No protein or nucleic/);
  });
});
