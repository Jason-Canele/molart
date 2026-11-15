import { ArtStyle, baseInk } from '../types';

/**
 * Pablo Picasso — cubist faceting.
 * Geometry: wide, flat rectangular-section ribbons sampled twice per residue with flat
 * per-triangle normals, so every facet is a broad triangle spanning the full ribbon width
 * (the reference's diagonal shard pattern), not a crumpled tube.
 * Paint: each shard gets a flat tone from a 4-step palette by the light it catches. The light comes from the
 * upper left of the protein's own frame, jittered per plane and fixed to the protein, so tones run light to dark
 * around a helix turn and never pop while rotating; warm helices, cobalt strands, cream/tan loops with red and
 * blue accents; black ribbon edges, heavy contours, and creases wherever the tone changes.
 * Opt-in "Viewpoints" deformation: helices and strands of the display mesh are each turned a little about their
 * own centre (several viewpoints at once); atomic coordinates are never touched.
 */
export const picassoStyle: ArtStyle = {
  id: 'picasso',
  label: 'Picasso',
  technique: 'Broad planar shards across flat ribbons, flat tones lit from per-shard viewpoints (fixed to the protein), ochre/vermilion/teal/cream with cobalt counterpoints, brushed texture, heavy black contours.',
  mesh: 'faceted',
  deformable: true,
  deformLabel: 'Viewpoints',
  deformHint: 'Off at 0. Move the slider to turn each helix and strand as if drawn from a different position.',
  ribbon: {
    samplesPerResidue: 2,
    profileSegments: 4,
    cornerProfile: true,
    flatness: 20,
    helixWidth: 3.3,
    helixThickness: 0.34,
    strandWidth: 2.8,
    strandThickness: 0.34,
    arrowWidth: 4.4,
    coilWidth: 1.25,
    coilThickness: 0.3,
    coilFlatness: 20,
  },
  art: {
    note: 'the object broken into flat planes laid on the picture surface: helices are broad angular slabs, strands flat pointed shards, loops straight bands with sharp knees, each piece tilted to its own viewpoint (Viewpoints on).',
    deform: 0.85,
    ribbon: { smooth: { helix: 8, strand: 1 }, path: 'polyline', sharp: true, face: 'all', blockEnds: true, outline: { strand: { kind: 'taper' } }, helixWidth: 6.0, helixThickness: 1.6, strandWidth: 5.6, strandThickness: 0.7, coilWidth: 2.2, coilThickness: 0.7 },
  },
  surfaceGLSL: /* glsl */ `
vec3 pal(int i, vec3 a, vec3 b, vec3 c, vec3 d){ return i == 0 ? a : (i == 1 ? b : (i == 2 ? c : d)); }
vec3 shadeSurface(Surface s){
  // broad cubist planes: each 1.5-residue chunk of each ribbon face is split diagonally into two flat planes
  float pl = s.ss > 0.5 && s.ss < 1.5 ? 3.0 : 1.5;   // helices hold each tone over larger planes
  float ch = floor(s.t / pl);
  float fu = fract(s.t / pl);
  float half_ = step(0.0, s.across + (fu - 0.5) * 2.2);
  float plane = ch * 4.0 + (s.faceY > 0.0 ? 0.0 : 2.0) + half_ + s.chain * 1000.0;
  float h1 = hash11(plane * 1.137 + s.seed);
  float h2 = hash11(plane * 7.31 + s.seed * 3.1 + 11.0);
  // thin side faces take the darkest tone (single outline from the ink pass)
  if (abs(s.faceY) < 0.5) return lin(s.ss > 1.5 ? vec3(0.08, 0.15, 0.40) : (s.ss > 0.5 ? vec3(0.45, 0.10, 0.07) : vec3(0.55, 0.38, 0.20)));
  // one flat tone per shard, by the light it catches; the light direction is jittered per plane (each plane is
  // seen from its own viewpoint) and fixed to the protein, so tones run light-mid-dark around a helix turn
  // and never pop while rotating
  vec3 fz = cross(uFrameX, uFrameY);
  vec3 L = normalize(-0.62 * uFrameX + 0.72 * uFrameY + 0.30 * fz + 0.55 * (vec3(h1, h2, hash11(plane * 3.3 + s.seed + 5.0)) - 0.5));
  float tone = clamp(0.48 + 0.62 * dot(s.on, L) + (h2 - 0.5) * 0.30, 0.0, 0.999);
  int idx = int(floor(tone * 4.0));
  vec3 c;
  float cc = float(idx);   // colour class, for the creases
  float acc = hash11(plane * 5.17 + s.seed + 3.0);
  if (s.ss > 1.5) {
    // strands: cobalt-blue arrows with navy and lighter blue planes, rare yellow counterpoint
    c = pal(idx, vec3(0.10, 0.18, 0.42), vec3(0.18, 0.36, 0.68), vec3(0.30, 0.51, 0.80), vec3(0.59, 0.74, 0.90));
    if (acc > 0.92) { c = vec3(0.95, 0.76, 0.18); cc = 4.0; }
  } else if (s.ss > 0.5) {
    // helices: red, orange and yellow planes with a deep red-brown, occasional cobalt
    c = pal(idx, vec3(0.40, 0.18, 0.10), vec3(0.76, 0.29, 0.20), vec3(0.90, 0.55, 0.19), vec3(0.95, 0.79, 0.34));
    if (acc > 0.7 && acc <= 0.85) { c = vec3(0.72, 0.41, 0.18); cc = 4.0; }   // ochre earth anchor
    if (acc > 0.97) { c = vec3(0.10, 0.18, 0.42); cc = 5.0; }                 // rare navy facet, as in panel C
  } else {
    // loops: ochre, tan and cream bands with red and blue accents
    c = pal(idx, vec3(0.55, 0.38, 0.20), vec3(0.82, 0.62, 0.32), vec3(0.93, 0.82, 0.58), vec3(0.98, 0.94, 0.82));
    if (acc > 0.55) { c = acc > 0.78 ? vec3(0.80, 0.20, 0.12) : vec3(0.12, 0.33, 0.68); cc = acc > 0.78 ? 4.0 : 5.0; }   // loops carry the red/blue accents
  }
  // black creases wherever the tone changes
  gCreaseId = cc + 8.0 * s.ss + 32.0 * step(0.0, s.faceY);
  c = mix(c, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * vec3(1.06, 1.0, 0.9), 0.07);   // a little softer than panel C (owner-tuned)
  c = lin(c);
  // brushed paint inside each shard: streaks along a per-shard direction + canvas tooth
  float ang = h1 * 3.14159;
  vec2 q = vec2(s.phys.x, s.phys.y * 2.0 + s.phys.w);
  vec2 r = vec2(cos(ang) * q.x + sin(ang) * q.y, -sin(ang) * q.x + cos(ang) * q.y);
  float brush = fbm2(vec2(r.x * 0.5, r.y * 7.0) + h2 * 40.0);
  float tooth = vnoise2(q * 9.0 + s.seed);
  c *= 0.98 + 0.04 * brush;   // flat, untextured planes
  return c;
}`,
  ink: {
    ...baseInk,
    color: [0.02, 0.02, 0.02],
    color2: [0.02, 0.02, 0.02],
    width: 2.5,
    widthVar: 0.3,
    breaks: 0.0,
    crease: 1.3,
    creaseAll: true,
    softness: 0.4,
    frequency: 0.6,
  },
};
