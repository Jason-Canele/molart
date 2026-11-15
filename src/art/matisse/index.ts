import { ArtStyle, baseInk } from '../types';

/**
 * Henri Matisse — gouache cut-outs.
 * Paper painted with flat cobalt gouache and cut out: no modelling or lighting, just two
 * painted sheets (front face lighter cobalt, back face deeper ultramarine), visible gouache
 * brush texture, and white gaps where one cut piece crosses another (paper-white "ink").
 * Edges are scissor-cut: slightly irregular, never outlined in black.
 */
export const matisseStyle: ArtStyle = {
  id: 'matisse',
  label: 'Matisse',
  technique: 'Flat gouache cut-outs: cobalt helices and strands (light front, deep back), loops cut from orange, emerald, yellow, magenta and black sheets, brushy gouache texture, white gaps where pieces cross, scissor-cut edges, no outline.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.7, helixThickness: 0.2, strandWidth: 3.3, strandThickness: 0.2, arrowWidth: 4.8, coilWidth: 2.2, coilThickness: 0.2, coilFlatness: 12, flatness: 16 },
  art: {
    note: 'drawing with scissors: every piece is a lobed leaf or seaweed shape cut from painted paper and laid flat.',
    fit: 0.33,
    ribbon: { gap: 1.6, smooth: { helix: 8, strand: 4, coil: 6 }, face: 'all', outline: { helix: { kind: 'scallop', amount: 0.55, lobes: 3 }, strand: { kind: 'scallop', amount: 0.3, lobes: 2 }, coil: { kind: 'scallop', amount: 1.15, lobes: 2 } }, helixWidth: 4.6, strandWidth: 3.6, coilWidth: 1.7 },
  },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  // each cut piece (~one secondary-structure element) was painted on its own sheet: cerulean to cobalt
  vec3 front = vec3(0.13, 0.38, 0.76);
  vec3 back = vec3(0.05, 0.17, 0.48);
  vec3 c = s.faceY >= -0.5 ? front : back;   // thin side faces take the front sheet colour
  // loops are separate cut pieces from other painted sheets: orange, emerald, yellow, magenta, black
  // (art mode: one sheet colour per cut piece)
  float piece = mix(floor(X / 14.0 + hash11(s.chain * 2.7 + s.seed) * 5.0), s.run.y, step(0.5, s.run.y));
  float ph = hash11(piece * 3.7 + s.chain * 1.9 + s.seed);
  vec3 sheet = ph < 0.30 ? vec3(0.93, 0.45, 0.12) : (ph < 0.52 ? vec3(0.10, 0.52, 0.36) : (ph < 0.72 ? vec3(0.97, 0.78, 0.16) : (ph < 0.90 ? vec3(0.82, 0.16, 0.42) : vec3(0.08, 0.08, 0.10))));
  if (s.ss < 0.5) c = s.faceY >= -0.5 ? sheet : sheet * 0.72;
  // gouache: streaky, slightly uneven coverage, brushed along the sheet
  float brush = fbm2(vec2(X * 0.5 + s.seed, Y * 5.0));
  float patch_ = fbm2(vec2(X * 0.15, Y * 0.8) + s.seed * 3.0);
  c *= 0.95 + 0.07 * brush + 0.04 * (patch_ - 0.5);   // faint gouache unevenness only
  return lin(c);
}`,
  ink: { ...baseInk, color: [1, 1, 1], color2: [1, 1, 1], width: 1.7, opacity: 1, widthVar: 0.25, wobble: 0.5, breaks: 0, dissolve: 0.08, dissolveWidth: 1.2, softness: 0.4, frequency: 2.0 },
};
