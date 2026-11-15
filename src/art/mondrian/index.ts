import { ArtStyle, baseInk } from '../types';

/**
 * Piet Mondrian — neoplastic composition.
 * One composition for the whole protein: an irregular grid of straight black lines lies on the protein's own
 * principal plane, with white fields and sparse pure red, blue, yellow (and rare black) rectangles. The ribbons
 * are windows onto that grid, so all lines are exactly horizontal or vertical at the default view and stay
 * fixed to the protein when it turns. Flat, unshaded colour; heavy black contour.
 */
export const mondrianStyle: ArtStyle = {
  id: 'mondrian',
  label: 'Mondrian',
  technique: 'One straight black grid across the whole protein, fixed to it: white fields with sparse pure red, blue and yellow rectangles; flat unshaded colour; heavy black contour.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.1, helixThickness: 0.3, strandWidth: 2.8, strandThickness: 0.3, arrowWidth: 4.2, coilWidth: 1.3, coilThickness: 0.3, coilFlatness: 12, flatness: 16 },
  art: {
    note: 'only horizontals and verticals: helices are wide rectangular planes, strands narrower bars, each along one of two directions; loops are thin lines that join them at right angles.',
    ribbon: { smooth: { helix: 8, strand: 5, coil: 2 }, path: 'manhattan', sharp: true, face: 'all', blockEnds: true, helixWidth: 5.0, helixThickness: 0.5, strandWidth: 2.3, strandThickness: 0.5, coilWidth: 0.4, coilThickness: 0.4, flatness: 24, coilFlatness: 24 },
  },
  surfaceGLSL: /* glsl */ `
// position of the grid line that opens the field containing x, on an irregular grid (lines only at some units)
float fieldStart(float x, float unit, float salt){
  float k = floor(x / unit);
  for (int i = 0; i < 12; i++) { if (hash11(k * 1.37 + salt) < 0.62) break; k -= 1.0; }
  return k;
}
vec3 shadeSurface(Surface s){
  // one composition for the whole protein: an irregular grid of straight black lines on the protein's own
  // principal plane (exactly horizontal and vertical at the default view); the ribbons are windows onto it
  vec3 black = vec3(0.04);
  float unit = 4.6, barW = 0.62;
  vec2 p = s.canvas;
  float sx = fieldStart(p.x, unit, s.seed + 3.0), sy = fieldStart(p.y, unit, s.seed + 71.0);
  float kx = floor(p.x / unit), ky = floor(p.y / unit);
  float onX = step(fract(p.x / unit) * unit, barW) * step(hash11(kx * 1.37 + s.seed + 3.0), 0.62);
  float onY = step(fract(p.y / unit) * unit, barW) * step(hash11(ky * 1.37 + s.seed + 71.0), 0.62);
  float h = hash12(vec2(sx, sy) * 1.31 + s.seed * 1.7);
  vec3 c = h < 0.50 ? vec3(0.97, 0.965, 0.94) : (h < 0.70 ? vec3(0.84, 0.17, 0.12) : (h < 0.84 ? vec3(0.11, 0.31, 0.61) : (h < 0.96 ? vec3(0.96, 0.82, 0.25) : black)));
  if (onX + onY > 0.5) c = black;
  return lin(c);
}`,
  ink: { ...baseInk, color: [0.03, 0.03, 0.03], color2: [0.03, 0.03, 0.03], width: 2.4, widthVar: 0, softness: 0.3, crease: 0 },
};
