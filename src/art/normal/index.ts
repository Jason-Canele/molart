import { ArtStyle, baseInk } from '../types';

/**
 * Scientific ribbon drawing in the manner of Jane Richardson's hand-drawn schematics (1981): helices as
 * spiral ribbons, β-strands as flat arrows with a visible edge, loops as round ropes; an even pen outline
 * and soft pastel colour with the paper showing through. No specular highlights, no deformation.
 */
export const normalStyle: ArtStyle = {
  id: 'normal',
  label: 'Scientific',
  technique: 'Ribbon drawing after Jane Richardson: spiral-ribbon helices, flat β-arrows and rope loops, pen outline and soft pastel colour by secondary structure.',
  mesh: 'smooth',
  ribbon: { helixWidth: 2.5, helixThickness: 0.3, strandWidth: 2.2, strandThickness: 0.55, arrowWidth: 3.7, coilRadius: 0.3, flatness: 14 },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  // pastel sticks: the helix ribbon has a brown outer face and a golden inner face, strands are green, ropes grey-buff
  vec3 helixOut = vec3(0.60, 0.44, 0.33);
  vec3 helixIn  = vec3(0.95, 0.74, 0.42);
  vec3 strand   = vec3(0.52, 0.80, 0.68);
  vec3 coil     = vec3(0.74, 0.67, 0.60);
  vec3 helix = mix(helixIn, helixOut, sstep(-0.4, 0.4, s.faceY));
  // where a strand meets a loop the interpolated code passes through the helix value: only a constant code is a helix
  float still = 1.0 - step(0.0005, fwidth(vSurf.w));
  float isHelix = still * step(0.5, s.ss) * step(s.ss, 1.5);
  vec3 base = mix(mix(coil, strand, step(1.0, vSurf.w)), helix, isHelix);
  float L = halfLambert(s.n);
  // soft drawn shading: a broad half-tone and a deeper tone on faces turned away, no gloss
  vec3 c = base * mix(0.70, 1.0, sstep(0.25, 0.75, L));
  c = mix(c, base * base * 0.85, 0.45 * (1.0 - sstep(0.05, 0.4, L)));
  // pastel on paper: strokes laid along the ribbon, with the tooth of the paper showing through on lit faces
  float X = s.phys.x, Y = s.phys.y;
  float stroke = fbm2(vec2(X * 0.45, Y * 3.2) + s.seed);
  float tooth = vnoise2(vec2(X, Y) * 7.0 + s.seed * 3.1);
  float bare = sstep(0.52, 0.86, 0.6 * stroke + 0.4 * tooth) * (0.14 + 0.36 * sstep(0.45, 0.95, L));
  c = mix(c, vec3(1.0), bare);
  c *= 0.96 + 0.08 * stroke;
  return lin(c);
}`,
  ink: { ...baseInk, width: 1.25, widthVar: 0.3, wobble: 0.35, crease: 0.7, softness: 0.45, frequency: 1.4, color: [0.13, 0.11, 0.10], color2: [0.13, 0.11, 0.10] },
};
