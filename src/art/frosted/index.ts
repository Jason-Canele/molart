import { ArtStyle, baseInk } from '../types';

/**
 * Frosted — the protein as a bumpy orange body of frosted glass, lit from within.
 * A fine Gaussian surface close to the van der Waals spheres: heavy atoms read as rounded bumps that fuse
 * smoothly into their neighbours (one closed body per chain). The body is made irregular on purpose (unequal
 * atoms, slow lumps, blotchy pigment, uneven edges) so it looks grown rather than machined. Each bump has a saturated orange middle, a
 * slightly denser ring, and a broad pale band at its edge where light scatters out through the thin glass.
 * Bumps that face the soft upper-left light carry a pale peach patch; lobes on the outside of the body are
 * paler, and whole regions of the body run pale or saturated; recesses and clefts deepen smoothly to burnt orange.
 * The body is translucent the way frosted glass is: the thin edge of a lobe glows pale in front of other lobes,
 * shows a soft trace of what lies behind, and lets the white paper through at the outline. Shading is softened slightly and carries a fine grain, for the frosted
 * finish. A material study, not an artist.
 */
export const frostedStyle: ArtStyle = {
  id: 'frosted',
  label: 'Frosted',
  technique: 'Bumpy atom-level surface in frosted orange glass: saturated middles, broad pale edges, peach on lit bumps, burnt orange to brown in the recesses, translucent lobes that show the ones behind.',
  mesh: 'surface',
  surface: { sigma: 0.66, iso: 0.04, spacing: 0.5, maxPoints: 3.4e6, irregular: 0.8, softProbe: true },
  wax: { density: 0.50, clear: 0.72, layers: 0.0, frost: 0.45, behind: 0.3, soft: 3.0 },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float near = s.phys.x, far = s.phys.y, wide = s.phys.z;
  vec3 umber = lin(vec3(0.66, 0.30, 0.08));
  vec3 deep = lin(vec3(0.78, 0.34, 0.08));
  vec3 orange = lin(vec3(0.90, 0.47, 0.16));
  vec3 apricot = lin(vec3(0.94, 0.60, 0.32));
  vec3 peach = lin(vec3(0.98, 0.80, 0.64));
  vec3 frostW = lin(vec3(1.00, 0.93, 0.86));
  vec3 key = normalize(vec3(-0.55, 0.62, 0.56));
  float d = dot(s.n, key);
  // light passes a little way through the body, so the side away from the light stays a glowing orange
  float wrap = clamp((d + 1.3) / 2.3, 0.0, 1.0);
  float contact = sstep(0.12, 0.70, near);
  float recess = sstep(0.08, 0.62, far);
  float cleft = sstep(0.05, 0.45, wide);
  float shadow = clamp(0.35 * contact + 0.60 * recess + 0.70 * cleft, 0.0, 1.0);
  float exposed = 1.0 - sstep(0.05, 0.28, wide);
  // whole lobes are pale or saturated, not single bumps: broad patches of the body catch the light
  // (pale towards the upper left of the protein's own frame, with an irregular boundary)
  float patchy = clamp(0.5 + clamp(dot(s.canvas, vec2(-0.64, 0.77)) / 48.0, -0.32, 0.32) + 0.9 * (fbm2(s.canvas * 0.05 + s.seed * 1.7) - 0.5), 0.0, 1.0);
  float lit = clamp(wrap * (1.0 - 0.72 * shadow) * (0.62 + 0.38 * exposed) + 0.72 * (patchy - 0.5), 0.0, 1.0);
  vec3 c = mix(umber, deep, sstep(-0.05, 0.22, lit));
  c = mix(c, orange, sstep(0.08, 0.46, lit));
  c = mix(c, apricot, sstep(0.40, 0.68, lit));
  c = mix(c, peach, sstep(0.64, 0.94, lit) * 0.75);
  // frosted grain: fine speckle and soft mottling
  float mott = fbm2(s.canvas * 0.34 + s.on.xy * 1.9 + s.seed);
  c *= 1.0 + (mott - 0.5) * 0.32;
  c *= 1.0 + (vnoise2(s.canvas * 6.0 + s.on.xy * 2.5 + s.seed) - 0.5) * 0.20;
  // frosted shell: a slightly denser ring inside the edge of every bump, then a pale band where
  // light scatters out through the thin edge
  float e = 1.0 - clamp(dot(s.n, s.v), 0.0, 1.0);
  float ring = sstep(0.10, 0.22, e) * (1.0 - sstep(0.26, 0.40, e));
  c = mix(c, c * vec3(0.95, 0.80, 0.66), ring * 0.40);
  float rim = sstep(0.28, 0.62, e);
  // the pale edge is uneven: wide and bright in places, almost gone in others
  float uneven = 0.45 + 1.0 * vnoise2(s.canvas * 0.6 + s.on.yz * 2.3 + s.seed);
  vec3 glow = mix(mix(c, sqrt(c), 0.8), mix(peach, frostW, 0.55), 0.25 + 0.75 * (1.0 - shadow) * sstep(0.15, 0.5, lit));
  c = mix(c, glow, clamp(rim * uneven * (0.55 + 0.45 * lit) * (1.0 - 0.85 * shadow), 0.0, 1.0));
  // an irregular pale patch where a bump faces the light
  float top = pow(max(dot(s.n, normalize(key + s.v)), 0.0), 2.0) * sstep(0.30, 0.62, vnoise2(s.canvas * 0.9 + s.on.xz * 2.7 + s.seed * 3.1));
  c = mix(c, mix(peach, frostW, 0.6), top * (0.15 + 0.35 * exposed) * patchy * (1.0 - shadow));
  return c;
}`,
  ink: { ...baseInk, color: [0.75, 0.38, 0.14], color2: [0.8, 0.42, 0.16], width: 0.6, opacity: 0.1, softness: 1.2 },
};
