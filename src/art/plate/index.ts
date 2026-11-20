import { ArtStyle, baseInk } from '../types';

/**
 * Plate — a copperplate engraving in the olive ink of the Canele paper site.
 * The ribbon is left as bare paper and modelled only by engraved lines that run across it, as in the plates
 * of an old atlas: the lines swell where the surface turns from the light and thin to nothing where it faces
 * it; the deepest shade takes a second set of lines across the first. Strands are ruled closer than helices,
 * loops are a plain line. Crisp olive contour with creases.
 */
export const plateStyle: ArtStyle = {
  id: 'plate',
  label: 'Plate',
  technique: 'Engraving in olive ink: bare paper ribbons modelled by ruled lines that swell in the shade, cross-hatching in the deepest shade, crisp contour.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.0, helixThickness: 0.5, strandWidth: 2.8, strandThickness: 0.5, arrowWidth: 4.2, coilWidth: 0.42, coilThickness: 0.42, coilFlatness: 2, flatness: 9 },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  vec3 olive = vec3(0.282, 0.333, 0.243);
  if (s.ss < 0.5) return lin(mix(vec3(1.0), olive, 0.9));                         // loops: a plain engraved line
  if (abs(s.faceY) < 0.45) return lin(olive);                                    // the ribbon's edge
  float shade = 1.0 - halfLambert(s.n);
  shade = clamp(shade * 1.05 - 0.08 + (s.faceY < 0.0 ? 0.24 : 0.0) + 0.08 * sstep(0.7, 1.0, abs(s.across)), 0.0, 1.0);
  // ruled lines across the ribbon: their width follows the shade (the burin cuts deeper)
  float pitch = s.ss > 1.5 ? 0.58 : 0.72;
  float l1 = abs(fract(X / pitch + 0.04 * sin(Y * 1.7)) - 0.5) * 2.0;             // 0 at a line's centre
  float w1 = sstep(0.16, 0.95, shade) * 0.58;
  float line = 1.0 - sstep(w1 - 0.12, w1 + 0.12, l1);
  // the deepest shade is crossed by a second set
  float l2 = abs(fract((X * 0.55 + Y * 0.85) / pitch) - 0.5) * 2.0;
  float w2 = sstep(0.74, 1.0, shade) * 0.40;
  line = max(line, 1.0 - sstep(w2 - 0.12, w2 + 0.12, l2));
  line *= step(0.02, w1);
  return lin(mix(vec3(1.0), olive, line * 0.96));
}`,
  ink: { ...baseInk, color: [0.282, 0.333, 0.243], color2: [0.22, 0.27, 0.19], width: 0.95, widthVar: 0.25, crease: 0.55, softness: 0.35, frequency: 1.2 },
};
