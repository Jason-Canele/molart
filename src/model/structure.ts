import { RawStructure, StructureParseError } from '../io/types';
import { assignSecondaryStructure, SSSource } from './ss';

export type SS = 'H' | 'E' | 'C';

export interface Residue {
  readonly index: number;
  readonly chainIndex: number;
  readonly chainId: string;
  readonly resSeq: number;
  readonly iCode: string;
  readonly name: string;
  /** Atom indices (-1 if absent). */
  readonly n: number;
  readonly ca: number;
  readonly c: number;
  readonly o: number;
  /** Atoms of this residue as a range [atomStart, atomEnd) into the atom arrays (file order). */
  readonly atomStart: number;
  readonly atomEnd: number;
  readonly ss: SS;
}

export interface Chain {
  readonly index: number;
  readonly id: string;
  /** [start, end) into residues. */
  readonly residueStart: number;
  readonly residueEnd: number;
}

export interface Structure {
  readonly id: string;
  readonly title: string;
  readonly format: 'pdb' | 'mmcif';
  /** Atom coordinates exactly as parsed (x,y,z interleaved). Never mutated by molart. */
  readonly coords: Float64Array;
  readonly atomNames: readonly string[];
  readonly atomElements: readonly string[];
  readonly atomAltLocs: readonly string[];
  /** Protein residues (polymer residues with a CA), in file order. */
  readonly residues: readonly Residue[];
  readonly chains: readonly Chain[];
  readonly ssSource: SSSource;
  /** True when the protein has CA atoms only (no N/C/O backbone). */
  readonly caOnly: boolean;
  readonly notes: readonly string[];
}

const AMINO = new Set(
  'ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL SEC PYL MSE ASX GLX UNK HYP MLY SEP TPO PTR CSO CME KCX LLP'.split(' '),
);

export interface BuildOptions {
  /** 'auto' (file records when present, else computed), 'file', or 'computed'. */
  ss?: 'auto' | 'file' | 'computed';
}

/** Build the immutable molecular model from raw parser output. */
export function buildStructure(raw: RawStructure, opts: BuildOptions = {}): Structure {
  const notes = [...raw.notes];
  // --- alternate locations: keep blank altLoc plus the first altLoc seen per residue ---
  const chosenAlt = new Map<string, string>();
  const keep: number[] = [];
  let altDropped = 0;
  raw.atoms.forEach((a, i) => {
    if (!a.altLoc) return keep.push(i);
    const key = `${a.chainId}|${a.resSeq}|${a.iCode}`;
    const ch = chosenAlt.get(key);
    if (ch === undefined) {
      chosenAlt.set(key, a.altLoc);
      keep.push(i);
    } else if (ch === a.altLoc) keep.push(i);
    else altDropped++;
  });
  if (altDropped) notes.push(`Alternate locations: kept the first altLoc per residue, ignored ${altDropped} atoms.`);

  const coords = new Float64Array(keep.length * 3);
  const atomNames: string[] = [];
  const atomElements: string[] = [];
  const atomAltLocs: string[] = [];
  keep.forEach((ai, k) => {
    const a = raw.atoms[ai];
    coords[3 * k] = a.x;
    coords[3 * k + 1] = a.y;
    coords[3 * k + 2] = a.z;
    atomNames.push(a.name);
    atomElements.push(a.element);
    atomAltLocs.push(a.altLoc);
  });

  // --- residues ---
  type Proto = { chainId: string; resSeq: number; iCode: string; name: string; n: number; ca: number; c: number; o: number; atom: boolean; first: number; last: number };
  const protos: Proto[] = [];
  let cur: Proto | null = null;
  keep.forEach((ai, k) => {
    const a = raw.atoms[ai];
    if (!cur || cur.chainId !== a.chainId || cur.resSeq !== a.resSeq || cur.iCode !== a.iCode || cur.name !== a.resName) {
      cur = { chainId: a.chainId, resSeq: a.resSeq, iCode: a.iCode, name: a.resName, n: -1, ca: -1, c: -1, o: -1, atom: a.record === 'ATOM', first: k, last: k };
      protos.push(cur);
    }
    cur.last = k;
    if (a.name === 'N' && cur.n < 0) cur.n = k;
    else if (a.name === 'CA' && cur.ca < 0 && a.element !== 'CA') cur.ca = k;
    else if (a.name === 'C' && cur.c < 0) cur.c = k;
    else if ((a.name === 'O' || a.name === 'OT1') && cur.o < 0) cur.o = k;
  });
  const protein = protos.filter((p) => p.ca >= 0 && (AMINO.has(p.name) || (p.atom && p.n >= 0 && p.c >= 0)));
  if (protein.length === 0) throw new StructureParseError('No protein residues (with CA atoms) found.');

  const chains: Chain[] = [];
  const chainIndexOf: number[] = [];
  protein.forEach((p, i) => {
    const last = chains[chains.length - 1];
    if (!last || last.id !== p.chainId || protein[i - 1].chainId !== p.chainId) {
      if (last) (last as { residueEnd: number }).residueEnd = i;
      chains.push({ index: chains.length, id: p.chainId, residueStart: i, residueEnd: protein.length });
    }
    chainIndexOf.push(chains.length - 1);
  });

  const withBackbone = protein.filter((p) => p.n >= 0 && p.c >= 0 && p.o >= 0).length;
  const caOnly = withBackbone < protein.length * 0.5;
  if (caOnly) notes.push('CA-only (or mostly CA-only) structure: ribbon orientation and secondary structure are inferred from CA geometry.');

  // --- secondary structure ---
  const ssMode = opts.ss ?? 'auto';
  const { ss, source, notes: ssNotes } = assignSecondaryStructure(protein, chainIndexOf, coords, raw.ssRanges, ssMode, caOnly);
  notes.push(...ssNotes);

  const residues: Residue[] = protein.map((p, i) =>
    Object.freeze({
      index: i,
      chainIndex: chainIndexOf[i],
      chainId: p.chainId,
      resSeq: p.resSeq,
      iCode: p.iCode,
      name: p.name,
      n: p.n,
      ca: p.ca,
      c: p.c,
      o: p.o,
      atomStart: p.first,
      atomEnd: p.last + 1,
      ss: ss[i],
    }),
  );

  return Object.freeze({
    id: raw.id,
    title: raw.title,
    format: raw.format,
    coords,
    atomNames: Object.freeze(atomNames),
    atomElements: Object.freeze(atomElements),
    atomAltLocs: Object.freeze(atomAltLocs),
    residues: Object.freeze(residues),
    chains: Object.freeze(chains.map((c) => Object.freeze(c))),
    ssSource: source,
    caOnly,
    notes: Object.freeze(notes),
  });
}

/** FNV-1a hash over the raw coordinate bytes: used to prove coordinates never change. */
export function coordinateFingerprint(s: Structure): string {
  const bytes = new Uint8Array(s.coords.buffer, s.coords.byteOffset, s.coords.byteLength);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[bytes.length - 1 - i], 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

export function residueLabel(r: Residue): string {
  return `${r.chainId || '_'}:${r.name}${r.resSeq}${r.iCode}`;
}
