import { ArtStyle, baseInk } from '../types';

/**
 * Shufa 書法 — Chinese calligraphy.
 * The chain is one line of ink written in a single breath with a round brush held upright. Pressure is the
 * secondary structure: strands are pressed, broad strokes that lift to a point, helices are written at an
 * even middle weight and turn like the linked loops of cursive script, loops are the gossamer threads
 * (yousi) that carry the brush from one stroke to the next. The brush is dipped, writes until it runs dry
 * and is dipped again, so the line goes from wet black to flying white (feibai: the paper showing between
 * dry bristles) along the chain. No light, no shading and no outline: ink is flat. Where one stroke
 * crosses another a hair of paper is left, so the eye can follow which passes in front.
 *
 * The style comes in several hands, as calligraphy does: they differ in the weight of the line, in how wet
 * or dry the brush is, and in the face the inscription and the seal are written in.
 */
interface Hand {
  id: string;
  /** name in the hand selector */
  name: string;
  technique: string;
  /** stroke widths in Å: helix and strand as [width, thickness], loop diameter */
  helix: [number, number];
  strand: [number, number];
  coil: number;
  /** -1..1: how dry the brush is overall (0 = a normally loaded brush) */
  dry: number;
  /** Å of chain written between two dips of the brush */
  span: number;
  /** bristles per Å across the stroke */
  bristle: number;
  /** hair of paper left around a stroke where it crosses another (reference px) */
  hair: number;
  /** 0..1 raggedness of the stroke's edge */
  ragged: number;
  /** face of the inscription and the seal (public/fonts) */
  font: string;
}

const f = (x: number) => x.toFixed(3);

function hand(k: Hand): ArtStyle {
  return {
    id: k.id,
    label: 'Shufa 書法',
    family: { of: 'shufa', name: k.name },
    technique: k.technique,
    mesh: 'smooth',
    ribbon: { helixWidth: k.helix[0], helixThickness: k.helix[1], strandWidth: k.strand[0], strandThickness: k.strand[1], arrowWidth: k.strand[0], coilWidth: k.coil, coilThickness: k.coil, coilFlatness: 2, flatness: 2.4 },
    paper: { color: [0.957, 0.933, 0.875], fibre: 0.8, seal: '蛋白', sealColor: [0.72, 0.13, 0.1], font: k.font },
    art: {
      note: 'written flat on the paper in one breath: each strand is a pressed stroke lifted to a point, each helix an undulating sweep, and the loops between them curl into the rings and threads that link cursive characters.',
      ribbon: { smooth: { helix: 2, strand: 2, coil: 2 }, face: 'all', curl: { radius: 3.6, turns: 1 }, runs: true, outline: { helix: { kind: 'brush', amount: 0.45 }, strand: { kind: 'brush', amount: 1.0 }, coil: { kind: 'brush', amount: 0.5, min: k.coil * 0.26 } }, helixWidth: k.helix[0] * 1.3, strandWidth: k.strand[0] * 1.3, coilWidth: k.coil, coilThickness: k.coil * 0.5 },
    },
    surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, P = s.phys.w;                 // along the chain and around the brush line, in Å
  float sd = s.chain * 7.31 + floor(s.seed);
  // the brush is dipped, writes until it runs dry and is dipped again: ink load as a saw-tooth along the chain
  float q = X / ${f(k.span)} + hash11(sd);
  float dip = floor(q);
  float u = pow(fract(q), mix(0.75, 1.5, hash11(dip * 3.7 + sd)));      // 0 = freshly loaded, 1 = dry
  // pressure: strands are pressed and wet, helices middle weight, loops lifted and fast
  float lift = s.ss > 1.5 ? 0.0 : (s.ss > 0.5 ? 0.42 : 1.0);
  float piece = step(0.5, s.run.y);                                    // art mode: place along this single stroke
  float dryness = clamp(u * 0.78 + lift * 0.36 + piece * 0.30 * sstep(0.45, 1.0, s.run.x) - 0.14 + ${f(k.dry)}, 0.0, 1.0);
  // bristles: every hair of the brush runs out of ink at its own point; a dry hair skips, leaving short
  // dashes of paper rather than one clean line
  float by = P * (${f(k.bristle)} + 3.0 * hash11(dip * 7.7 + 1.0)) + vnoise1(X * 0.08 + dip) * 2.2;
  float bid = floor(by);
  float bh = hash11(bid * 1.7 + dip * 3.1 + 0.5);
  float at = 0.30 + 0.80 * bh;
  float dry = sstep(at - 0.10, at + 0.14, dryness + 0.30 * (vnoise1(X * 0.30 + bid * 7.0) - 0.5));
  float dash = sstep(0.30, 0.62, vnoise1(X * (0.9 + 0.9 * bh) + bid * 13.0) + 0.55 * (dryness - 0.5));
  float gapW = 0.16 + 0.34 * hash11(bid * 5.3 + dip);
  float white = dry * dash * (1.0 - sstep(gapW - 0.10, gapW + 0.10, abs(fract(by) - 0.5)));
  // flying white: where the dry brush moves fast, the ink skips ragged patches of paper drawn out along the stroke
  float skip = sstep(0.50, 0.66, fbm2(vec2(X * 0.16, by * 0.55) + dip * 3.0)) * sstep(0.38, 0.90, dryness);
  float tone = 1.0 - 0.94 * max(white, 0.9 * skip);
  // thick ink is not quite even; thin ink is a shade greyer
  tone *= 0.93 + 0.07 * fbm2(vec2(X * 0.05, P * 0.3) + dip);
  vec3 ink = mix(vec3(0.035, 0.035, 0.045), vec3(0.20, 0.20, 0.21), 0.55 * dryness * dryness);
  return lin(mix(vec3(1.0), ink, clamp(tone, 0.0, 1.0)));
}`,
    // a hair of bare paper around every stroke, so crossings stay legible; the stroke's own edge is slightly dry
    ink: { ...baseInk, color: [1, 1, 1], color2: [1, 1, 1], width: k.hair, opacity: 1, softness: 0.5, dissolve: k.ragged, dissolveWidth: 1.6, frequency: 1.5 },
  };
}

/** Running-cursive (xingcao): the middle hand, and the one the style row chooses. */
export const shufaStyle = hand({
  id: 'shufa', name: 'Running 行草', font: 'Zhi Mang Xing',
  technique: 'Running-cursive calligraphy: the chain as one brush line, strands pressed broad, helices at middle weight, loops as gossamer threads; ink runs from wet black to flying white between dips of the brush.',
  helix: [2.0, 1.7], strand: [3.1, 1.2], coil: 0.62, dry: 0, span: 92, bristle: 5.5, hair: 0.9, ragged: 0.22,
});
/** Yan Zhenqing's regular script: full, heavy strokes from a brush kept wet. */
export const shufaYanStyle = hand({
  id: 'shufa-yan', name: 'Thick 顏楷', font: 'Ma Shan Zheng',
  technique: 'Yan-style regular script: full, heavy strokes from a brush kept wet; hardly any flying white.',
  helix: [3.0, 2.6], strand: [4.6, 1.9], coil: 1.15, dry: -0.3, span: 150, bristle: 4.5, hair: 1.2, ragged: 0.08,
});
/** Slender gold (shoujin): thin, taut, wiry lines without any dry brush. */
export const shufaShoujinStyle = hand({
  id: 'shufa-shoujin', name: 'Slender 瘦金', font: 'Long Cang',
  technique: 'Slender gold: thin, taut, wiry lines of even black ink; strands a little broader, loops hair-fine.',
  helix: [1.05, 0.95], strand: [1.8, 0.6], coil: 0.36, dry: -0.5, span: 200, bristle: 6, hair: 0.6, ragged: 0,
});
/** Wild cursive (kuangcao) with a dry brush: heavy contrast, frayed strokes, much flying white. */
export const shufaKuangcaoStyle = hand({
  id: 'shufa-kuangcao', name: 'Dry brush 狂草', font: 'Liu Jian Mao Cao',
  technique: 'Wild cursive with a dry brush: broad pressed strands against hair-fine threads, strokes frayed into flying white almost from where the brush lands.',
  helix: [2.5, 2.1], strand: [4.3, 1.5], coil: 0.5, dry: 0.3, span: 64, bristle: 7, hair: 0.9, ragged: 0.42,
});
