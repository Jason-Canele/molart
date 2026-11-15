import { ArtStyle, baseInk } from '../types';

/**
 * ASCII Fold — the protein as coloured text that dissolves into a cartoon ribbon.
 * An homage to ascii-fold by Maxim Tsenkov (https://github.com/mitsenkov/ascii-fold, MIT): the idea, the
 * character ramp, the secondary-structure palette and the left-to-right dithered hand-over follow that
 * project; the implementation here is molart's own (no code was copied). The ribbon is drawn by the normal
 * pipeline; a final pass then lays a character grid over the image, picks a character per cell from the
 * ribbon's brightness under it, and hands cells to text or ribbon with a fixed per-cell dither.
 * The grid is tied to the picture, not to the protein: characters change as the structure turns.
 */
export const asciiFoldStyle: ArtStyle = {
  id: 'asciifold',
  label: 'ASCII Fold',
  technique: 'Coloured ASCII text (ramp .,:;-=+*x#%@) chosen per character cell from the ribbon shading, dissolving left to right into a flat-shaded cartoon through a fixed dither. After ascii-fold by Maxim Tsenkov.',
  mesh: 'smooth',
  ribbon: { coilRadius: 0.5 },
  ascii: { rows: 64, blend: [0.225, 0.775] },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  vec3 helix  = lin(vec3(0.828, 0.227, 0.173));   // #D33A2C
  vec3 strand = lin(vec3(0.122, 0.388, 0.690));   // #1F63B0
  vec3 coil   = lin(vec3(0.788, 0.580, 0.063));   // #C99410
  vec3 base = s.ss > 1.5 ? strand : (s.ss > 0.5 ? helix : coil);
  float d = abs(dot(s.n, normalize(vec3(-0.35, 0.55, 0.75))));
  float lit = 0.25 + 0.75 * d;
  return base * (0.5 + 0.5 * lit) + (vec3(1.0) - base) * 0.28 * d * d * d;
}`,
  ink: { ...baseInk, width: 0.7, color: [0.25, 0.16, 0.12], color2: [0.25, 0.16, 0.12], opacity: 0.45 },
};
