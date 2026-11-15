import { ArtStyle, baseInk } from '../types';

/**
 * Surface — the protein as a soft, matte molecular surface.
 * A smooth Gaussian surface over all heavy atoms (one closed body per chain), in pale lavender-white:
 * light from above, shade gathering in the grooves, a violet-blue tint where the surface folds in on itself
 * and along grazing edges, and a thin soft violet line where one lobe passes in front of another.
 * The grooves are shaded from the density field itself (how enclosed each spot is), so the shading turns
 * with the protein. A material study, not an artist.
 */
export const surfaceStyle: ArtStyle = {
  id: 'surface',
  label: 'Surface',
  technique: 'Soft molecular surface (Gaussian surface over all heavy atoms, one body per chain) in pale lavender-white, with shaded grooves, violet-blue creases and a thin soft contour.',
  mesh: 'surface',
  surface: { sigma: 1.75, iso: 2.5, spacing: 1.0, adaptSmall: true },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float near = s.phys.x, far = s.phys.y;                   // how enclosed: 0 open, about 1 in a groove
  vec3 lit = lin(vec3(0.955, 0.955, 0.985));
  vec3 mid = lin(vec3(0.85, 0.85, 0.93));
  vec3 shade = lin(vec3(0.60, 0.60, 0.77));
  vec3 crease = lin(vec3(0.50, 0.47, 0.90));
  float L = halfLambert(s.n);
  float sky = s.n.y * 0.5 + 0.5;
  float light = clamp(0.55 * L + 0.45 * sky, 0.0, 1.0);
  vec3 c = mix(shade, mid, sstep(0.18, 0.58, light));
  c = mix(c, lit, sstep(0.55, 0.9, light));
  // grooves: broad soft shade from the wide probe, a tighter violet line from the near one
  float groove = sstep(0.06, 0.6, far);
  c = mix(c, shade * 0.9, groove * 0.75);
  c = mix(c, crease, sstep(0.45, 0.9, near) * 0.6);
  // grazing edges pick up the violet-blue of the material
  float rim = pow(1.0 - clamp(dot(s.n, s.v), 0.0, 1.0), 2.6);
  c = mix(c, lin(vec3(0.62, 0.62, 0.93)), rim * 0.62);
  return c;
}`,
  ink: { ...baseInk, color: [0.45, 0.43, 0.80], color2: [0.52, 0.5, 0.86], width: 0.9, opacity: 0.6, softness: 1.0 },
};
