import { ArtStyle, baseInk } from '../types';

/**
 * Sumi-e — black ink brush painting.
 * Each ribbon is a brush stroke: the brush is loaded with ink at the start of a stroke and runs
 * dry along it (ink load as a saw-tooth over arc length), so tone goes from wet black to grey
 * dry-brush with white bristle streaks along the chain; some strokes are diluted to grey; every
 * bristle runs dry at its own point, so strokes fray into streaks towards their end. Edges break up into the paper (dry brush), no separate outline.
 */
export const sumieStyle: ArtStyle = {
  id: 'sumie',
  label: 'Sumi-e',
  technique: 'Black ink brush strokes along the chain: wet black where the brush is loaded, dry-brush grey with white bristle streaks as it runs dry, broken paper edges, no outline.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.1, helixThickness: 0.24, strandWidth: 2.8, strandThickness: 0.26, arrowWidth: 4.0, coilWidth: 1.3, coilThickness: 0.3, coilFlatness: 6, flatness: 10 },
  art: {
    note: 'ink bamboo: each helix is one culm segment laid down in a single straight pull, each strand a leaf pressed down and lifted to a point, each loop a thin twig with one knee; the paper between them is left empty.',
    ribbon: { path: 'polyline', sharp: true, gap: 1.8, smooth: { helix: 8, strand: 3, coil: 2 }, face: 'all', outline: { helix: { kind: 'brush', amount: 0.3 }, strand: { kind: 'brush', amount: 1.1 }, coil: { kind: 'brush', amount: 0.9, min: 0.12 } }, helixWidth: 2.6, strandWidth: 3.4, coilWidth: 0.6, coilThickness: 0.25 },
  },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  float off = hash11(s.chain + s.seed) * 3.0;
  float piece = step(0.5, s.run.y);   // art mode: every helix / strand / loop is one stroke, loaded once
  float id = mix(floor(X / 22.0 + off), s.run.y, piece);
  float u = mix(fract(X / 22.0 + off), s.run.x, piece);                       // 0 = brush lands, 1 = brush lifts
  float hh = hash11(id * 0.618 + s.chain * 1.37 + floor(s.seed));
  // every stretch of ribbon is one brush stroke: loaded (black) or diluted (grey), running dry along its length
  float full = step(s.ss > 1.5 ? 0.22 : 0.42, hh);
  // economy: a few strokes carry the ink, the rest are a pale wash the eye completes
  float faint = step(hash11(id * 2.9 + s.chain * 0.7 + 9.0), s.ss > 1.5 ? 0.30 : 0.55) * (1.0 - full);
  float load = mix(mix(0.62, 0.16, faint), 1.0, full) * (s.faceY < 0.0 ? 0.85 : 1.0);   // the far side of a ribbon is painted thinner
  float wet = load * (1.0 - 0.32 * sstep(0.3, 1.0, u));
  // bristles: fine streaks along the stroke; each bristle runs out of ink at its own point
  float by = Y * (2.6 + 1.6 * hash11(id * 7.7 + 1.0)) + vnoise1(X * 0.07 + id) * 1.6;   // coarse or fine brush per stroke
  float bid = floor(by);
  float bh = hash11(bid * 1.7 + id * 3.1 + 0.5);
  float dryAt = 0.38 + 0.80 * bh;                                     // a third of the bristles never run dry
  float dry = sstep(dryAt - 0.10, dryAt + 0.14, u + 0.22 * (vnoise1(X * 0.45 + bid * 7.0) - 0.5));
  float gapW = 0.10 + 0.32 * hash11(bid * 5.3 + id) * hash11(bid * 2.9 + id + 4.0);                  // width of the white streak a dry bristle leaves
  float white = dry * (1.0 - sstep(gapW - 0.08, gapW + 0.08, abs(fract(by) - 0.5)));
  // flying white: broken, skipping ink where the brush moves fast, and along the stroke's edges
  float a = abs(s.across);
  float skip = sstep(0.52, 0.68, vnoise2(vec2(X * 0.30, by * 0.9) + id * 3.0));
  white = max(white, skip * max(sstep(0.35, 1.0, u), sstep(0.62, 0.98, a)));
  // the landing of the brush: a wet, slightly pooled head; wet strokes pool at their edges
  float head = 1.0 - sstep(0.0, 0.10, u);
  float pool = sstep(0.72, 1.0, a) * (1.0 - sstep(0.1, 0.5, u));
  float tone = wet * (1.0 - 0.92 * white) + 0.12 * head + 0.10 * pool;
  tone += (vnoise2(vec2(X * 0.5, Y * 2.5) + id) - 0.5) * 0.10;         // paper tooth and uneven dilution
  tone *= 0.90 + 0.20 * fbm2(vec2(X * 0.04, Y * 0.2) + id);
  return lin(mix(vec3(1.0), vec3(0.04, 0.04, 0.05), clamp(tone, 0.0, 1.0)));
}`,
  ink: { ...baseInk, color: [0.05, 0.05, 0.06], color2: [0.25, 0.25, 0.27], width: 0, widthVar: 0, breaks: 0, opacity: 0, softness: 0.6, frequency: 1.2, dissolve: 0.0, dissolveWidth: 0.0 },
};
