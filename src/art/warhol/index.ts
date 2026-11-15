import { ArtStyle, baseInk } from '../types';

/**
 * Andy Warhol — silkscreen pop.
 * Flat, unmodulated neon inks laid in blocks: each helix half-turn alternates magenta /
 * yellow / cyan / violet, strands are solid cyan-blue, loops run in striped neon bands; colour
 * boundaries are dragged screen-print streaks (squeegee drag in ribbon coordinates); shadows
 * are a second flat violet plate with anchored halftone dots; plates slightly off-register.
 */
export const warholStyle: ArtStyle = {
  id: 'warhol',
  label: 'Warhol',
  technique: 'Silkscreen: flat neon magenta/yellow/cyan/violet blocks per helix half-turn, streaky squeegee boundaries, flat violet shadow plate with halftone dots, off-register plates.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.0, helixThickness: 0.3, strandWidth: 2.7, strandThickness: 0.3, arrowWidth: 4.0, coilWidth: 1.25, coilThickness: 0.35, coilFlatness: 6, flatness: 10 },
  art: {
    note: 'products off the shelf, screened flat: every helix is a bottle (a full straight body, a shoulder, then a neck that points the way the chain runs), every strand a banana-like pod with pointed ends, loops the thin line between them; a big protein becomes a crowd of the same bottle repeated.',
    ribbon: { smooth: { helix: 8, strand: 4, coil: 6 }, path: 'polyline', face: 'all', helixWidth: 6.6, strandWidth: 4.8, coilWidth: 1.5, flatness: 14, outline: { helix: { kind: 'brush', amount: 0.35 }, strand: { kind: 'petal', amount: 0.4 } } },
  },
  surfaceGLSL: /* glsl */ `
vec3 pop(int i){
  return i == 0 ? vec3(1.0, 0.10, 0.62) : (i == 1 ? vec3(1.0, 0.90, 0.05) : (i == 2 ? vec3(0.05, 0.75, 0.95) : (i == 3 ? vec3(0.10, 0.85, 0.75) : vec3(1.0, 0.45, 0.10))));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  // squeegee-dragged block boundaries: the cut position wobbles across the ribbon
  float drag = 0.0;
  // one flat ink per element (approximate element id from arc length), cyan / magenta / yellow
  float el = floor(X / 24.0) + s.chain * 31.0;   // large flat colour zones
  int i = int(mod(floor(hash11(el + s.seed) * 3.0) + (s.ss > 1.5 ? 2.0 : 0.0), 3.0));
  vec3 c = i == 0 ? vec3(0.93, 0.0, 0.55) : (i == 1 ? vec3(1.0, 0.90, 0.0) : vec3(0.0, 0.68, 0.94));
  // flat shadow plate (violet) where the ribbon faces away, filled with halftone dots
  float L = lambert(s.n);
  float graze = 1.0 - abs(dot(s.n, s.v));
  float shadow = sstep(0.16, 0.08, L * (1.0 - graze * 0.5));
  vec2 g = fract(vec2(X, Y) * 2.2) - 0.5;
  float dotR = mix(0.15, 0.45, shadow);
  float dots = step(length(g), dotR);
  vec3 plate = (c.r > 0.9 && c.g > 0.8) ? pop(0) : c * 0.6;   // yellow's shadow is a flat pink plate, never a murky mix
  c = mix(c, vec3(0.02), dots * sstep(0.7, 0.9, 1.0 - L) * 0.0);   // flat inks only
  return lin(c);
}`,
  ink: { ...baseInk, color: [0.02, 0.02, 0.02], color2: [0.02, 0.02, 0.02], width: 1.8, widthVar: 0.3, breaks: 0.0, wobble: 1.6, misregister: [9.0, 7.0], softness: 0.4, frequency: 0.8 },
};
