import { ArtStyle, baseInk } from '../types';

/**
 * Katsushika Hokusai — ukiyo-e woodblock.
 * Flat printed colour: cream paper on the outer faces of ribbons, Prussian/indigo on the
 * inner faces and on strands, with a bokashi (graded blue) wiped along each strand; carved
 * parallel lines in the shaded turns and rows of wave-crest scallops with pale foam edges on the
 * blue blocks (drawn on the ribbons only); crisp, even indigo key-block line.
 * No wave, cartouche or seal is drawn — only the protein.
 */
export const hokusaiStyle: ArtStyle = {
  id: 'hokusai',
  label: 'Hokusai',
  technique: 'Woodblock print: cream paper ribbons with Prussian-blue undersides, bokashi-graded strands, carved line texture, crisp indigo key-block outline.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.0, helixThickness: 0.24, strandWidth: 2.7, strandThickness: 0.26, arrowWidth: 4.1, coilWidth: 1.0, coilThickness: 0.24, coilFlatness: 8, flatness: 12 },
  art: {
    note: 'the wave: helices rear up as tapering crests fringed with foam fingers, strands are long swelling brush strokes, loops curl over like the lip of the wave, and everything lies flat in the picture plane, as in a print.',
    ribbon: { smooth: { helix: 8, strand: 3, coil: 5 }, face: 'all', wave: { amp: 2.4, period: 12 }, curl: { radius: 4.5, turns: 1.5 }, outline: { helix: { kind: 'flame', lobes: 8 }, strand: { kind: 'brush', amount: 0.7 } }, helixWidth: 4.4, strandWidth: 4.2, coilWidth: 1.0 },
  },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  vec3 paper = lin(vec3(0.96, 0.92, 0.82));
  vec3 paperShade = lin(vec3(0.86, 0.80, 0.68));
  vec3 indigo = lin(vec3(0.07, 0.13, 0.32));
  vec3 prussian = lin(vec3(0.13, 0.33, 0.56));
  vec3 pale = lin(vec3(0.55, 0.70, 0.82));
  if (abs(s.faceY) < 0.45) return lin(vec3(0.12, 0.25, 0.45));
  float L = halfLambert(s.n);
  vec3 deep = lin(vec3(0.12, 0.25, 0.45)), mid = lin(vec3(0.29, 0.45, 0.66));
  vec3 c;
  // carved lines: the block cutter's parallel strokes, following the ribbon in long gentle curves
  float carve = abs(fract(Y * 2.6 + 0.35 * sin(X * 0.22 + s.seed)) - 0.5);
  float line = 1.0 - sstep(0.06, 0.13, carve);
  // wave crests: rows of scallops (seigaiha) with pale foam edges, printed on the blue blocks
  float row = floor(X / 2.2);
  vec2 sp = vec2(fract(X / 2.2) - 0.5, fract(Y / 2.2 + 0.5 * mod(row, 2.0)) - 0.5) * 2.2;
  float sr = length(sp - vec2(-1.1, 0.0));
  float foam = 1.0 - sstep(0.07, 0.16, abs(fract(sr * 1.55) - 0.5));
  if (s.ss > 1.5) {
    // strands: Prussian blue with bokashi (wiped gradation) from deep at the tail to pale at the arrow, and wave scallops
    float bok = sstep(0.0, 1.0, fract(X / 26.0 + hash11(s.chain + s.seed)));
    c = mix(deep, mid, 0.25 + 0.75 * bok * step(0.5, L) + 0.2 * (1.0 - step(0.5, L)));
    c = mix(c, pale, foam * 0.75);
    c = mix(c, indigo, sstep(0.60, 0.90, abs(s.across)) * 0.8);   // straight bokashi along the edge
  } else if (s.ss > 0.5) {
    // helices: paper face with fine indigo carved lines in the shaded turns, blue underside with foam scallops
    vec3 face = mix(paper, paperShade, step(L, 0.42));
    face = mix(face, prussian, line * step(L, 0.52) * 0.85);
    vec3 under = mix(mix(deep, mid, step(0.45, L)), pale, foam * 0.7);
    c = s.faceY >= 0.0 ? face : under;
  } else {
    c = L < 0.42 ? mix(paperShade, prussian, line * 0.6) : paper;
  }
  // printed from wood: the block's grain shows in the colour, and the ink sits unevenly on the paper
  float grain = fbm2(vec2(X * 0.10 + s.seed, Y * 4.5));
  float blue = step(c.b, 0.6) * step(c.r, 0.5);
  c = mix(c, c * (0.80 + 0.40 * grain), 0.75 * blue);
  c = mix(c, paper, blue * 0.28 * sstep(0.62, 0.80, vnoise2(vec2(X * 0.9, Y * 3.0) + s.seed * 3.0)));
  return c;
}`,
  ink: { ...baseInk, color: [0.1, 0.11, 0.14], color2: [0.1, 0.11, 0.14], width: 3.2, widthVar: 0.25, softness: 0.35, frequency: 0.8, misregister: [1.3, -0.9] },
};
