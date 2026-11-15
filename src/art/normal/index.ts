import { ArtStyle, baseInk } from '../types';

/** Scientific cartoon: secondary-structure colouring, simple lighting, thin outline. No deformation. */
export const normalStyle: ArtStyle = {
  id: 'normal',
  label: 'Scientific',
  technique: 'Conventional cartoon: helices, β-arrows and coils coloured by secondary structure.',
  mesh: 'smooth',
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  vec3 helixOut = lin(vec3(0.50, 0.37, 0.27));
  vec3 helixIn  = lin(vec3(0.90, 0.66, 0.36));
  vec3 strand   = lin(vec3(0.46, 0.78, 0.64));
  vec3 coil     = lin(vec3(0.66, 0.58, 0.50));
  vec3 base = s.ss > 1.5 ? strand : (s.ss > 0.5 ? mix(helixIn, helixOut, sstep(-0.4, 0.4, s.faceY)) : coil);
  float d = lambert(s.n);
  float fill = max(dot(s.n, normalize(vec3(0.6, -0.2, 0.5))), 0.0);
  return base * (0.42 + 0.70 * d + 0.18 * fill) + vec3(0.22) * blinn(s.n, s.v, 48.0);
}`,
  ink: { ...baseInk, width: 1.0, color: [0.16, 0.13, 0.11], color2: [0.16, 0.13, 0.11] },
};
