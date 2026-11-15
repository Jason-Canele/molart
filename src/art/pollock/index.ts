import { ArtStyle, baseInk } from '../types';

/**
 * Jackson Pollock — poured paint anchored to the fold (follows the owner's concept sheet).
 * The fold itself is a bold, saturated chrome-yellow/orange poured ribbon, mottled with navy and
 * red-orange paint that pooled on it. Around it (display geometry from geometry/splatter.ts):
 * thin looping navy/red skeins that follow the backbone, long flung lines that end in round
 * blobs, and fine round spatter — all built from the backbone spline, never a background.
 */
export const pollockStyle: ArtStyle = {
  id: 'pollock',
  label: 'Pollock',
  technique: 'Bold chrome-yellow/orange poured ribbon mottled with navy and red; looping navy and red skeins, flung lines ending in round blobs, fine round spatter around the fold.',
  mesh: 'splatter',
  splatter: { seed: 0, layers: 5, drops: 9, dropReach: 10, dropSize: 0.45, flickReach: 34, density: 1.3, flickDots: true },
  ribbon: { helixWidth: 1.8, helixThickness: 0.45, strandWidth: 1.7, strandThickness: 0.5, arrowWidth: 3.2, coilWidth: 1.0, coilThickness: 0.5, coilFlatness: 4, flatness: 5 },
  art: {
    note: 'one poured line: helices are looping lariats of paint that swell and thin, strands are loaded pours running out to a trickle, loops are fast thin thrown arcs. Display mesh only.',
    ribbon: {
      helixWidth: 1.2, helixThickness: 0.9, flatness: 2, strandWidth: 3.4, strandThickness: 0.9, coilWidth: 0.5, coilThickness: 0.5, coilFlatness: 2,
      smooth: { helix: 0, strand: 3, coil: 4 }, exaggerate: 0.5, curl: { radius: 5, turns: 1 },
      outline: { helix: { kind: 'scallop', lobes: 4, amount: 0.5 }, strand: { kind: 'brush', amount: 1.1 } },
    },
  },
  surfaceGLSL: /* glsl */ `
vec3 paint(float layer){
  // navy, chrome yellow, red-orange, orange, navy-black
  return layer < 0.5 ? vec3(0.08, 0.13, 0.30) : (layer < 1.5 ? vec3(0.97, 0.74, 0.05) : (layer < 2.5 ? vec3(0.89, 0.27, 0.10) : (layer < 3.5 ? vec3(0.97, 0.80, 0.12) : vec3(0.06, 0.08, 0.18))));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  vec3 c;
  if (s.ss > 2.5) {
    c = paint(s.ss - 3.0);
    return lin(c);                                   // skeins, flung lines and spatter: flat enamel
  }
  // the poured ribbon: chrome yellow with orange streaks along the pour
  // flat poured enamel: chrome yellow, with irregular orange pools (no lengthwise airbrush streaks)
  float bleed = (vnoise2(vec2(X * 6.0, Y * 6.0) + s.seed) - 0.5) * 0.05;   // ragged pool edges
  float pool = fbm2(vec2(X * 0.45, Y * 0.9) + s.seed) + bleed;
  c = vec3(0.97, 0.80, 0.12);   // chrome yellow leads
  if (pool > 0.74) c = vec3(0.95, 0.60, 0.12);
  // navy and red paint pooled on the ribbon in irregular patches
  float navy = fbm2(vec2(X * 0.42, Y * 1.0) + s.seed * 3.0 + s.chain * 7.0);
  float red = fbm2(vec2(X * 0.45, Y * 1.4) + s.seed * 5.0 + 40.0);
  navy += bleed;
  if (navy > 0.57) c = vec3(0.11, 0.16, 0.29);
  else if (red > 0.62) c = vec3(0.85, 0.26, 0.12);
  // fine flicked dots on the ribbon
  vec2 g = vec2(X, Y) * 2.2;
  vec2 gi = floor(g);
  vec2 o = hash22(gi + s.seed) - 0.5;
  if (length(fract(g) - 0.5 - o * 0.5) < 0.1 * hash12(gi * 1.7)) c = paint(hash12(gi) > 0.5 ? 0.0 : 2.0);
  // enamel has some body: gentle light, a wet sheen on top
  return lin(c);   // flat enamel, no modelling
}`,
  ink: { ...baseInk, color: [0.06, 0.08, 0.18], color2: [0.06, 0.08, 0.18], width: 0.7, widthVar: 0.6, breaks: 0.35, opacity: 0.8, softness: 0.4, frequency: 2.0 },
};
