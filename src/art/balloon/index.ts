import { ArtStyle, baseInk } from '../types';

/**
 * Balloon — the chain twisted out of polished balloons, after Jeff Koons's mirror-finished Balloon Dog and
 * the balloon figures oracle-diff samples (Canele hackathon, November 2026).
 * Every surface is a tinted mirror in a photo studio: it reflects a bright ceiling, a dark floor, a strip
 * light and two soft boxes, all coloured by the balloon's own colour, with a white rim where it turns away.
 * Science mode keeps the true path as one long round tube. Art mode twists it into balloons: each helix and
 * each strand is one fat sausage pinched to a point at both ends, the loops are the thin twists between them.
 */
export const balloonStyle: ArtStyle = {
  id: 'balloon',
  label: 'Balloon',
  technique: 'Mirror-polished balloons: round tubes that reflect a studio (ceiling, floor, strip light, soft boxes) in their own colour, one colour per chain.',
  mesh: 'smooth',
  ribbon: { helixWidth: 2.3, helixThickness: 2.3, strandWidth: 2.3, strandThickness: 2.3, arrowWidth: 2.3, coilWidth: 1.5, coilThickness: 1.5, coilFlatness: 2, flatness: 2, profileSegments: 28 },
  art: {
    note: 'a balloon figure: each helix and each strand is one fat balloon pinched at both ends, the loops are the twists between them; lengths and directions follow the chain, the helices are straightened.',
    fit: 0.5,
    ribbon: { smooth: { helix: 8, strand: 4, coil: 2 }, runs: true, outline: { helix: { kind: 'petal', amount: 0.2, min: 0.55 }, strand: { kind: 'petal', amount: 0.2, min: 0.55 } }, helixWidth: 6.4, helixThickness: 6.4, strandWidth: 4.6, strandThickness: 4.6, arrowWidth: 4.6, coilWidth: 0.9, coilThickness: 0.9, flatness: 2, helixFlatness: 2, profileSegments: 32 },
  },
  surfaceGLSL: /* glsl */ `
// the studio a balloon reflects: r is the reflected view ray in view space (y up)
float studio(vec3 r){
  float room = 0.30 + 0.38 * sstep(-0.55, 0.25, r.y) + 0.26 * sstep(0.30, 0.95, r.y);
  float strip = sstep(0.52, 0.58, r.y) * (1.0 - sstep(0.76, 0.82, r.y));                       // a long light overhead
  float boxL = sstep(0.38, 0.46, -r.x) * (1.0 - sstep(0.80, 0.88, -r.x)) * sstep(-0.25, -0.10, r.y) * (1.0 - sstep(0.42, 0.52, r.y));
  float boxR = sstep(0.50, 0.58, r.x) * (1.0 - sstep(0.84, 0.92, r.x)) * sstep(-0.05, 0.08, r.y) * (1.0 - sstep(0.36, 0.46, r.y));
  return room + 0.95 * strip + 0.70 * boxL + 0.45 * boxR;
}
vec3 shadeSurface(Surface s){
  // one colour per chain, from the sculptures: magenta, blue, orange, yellow, red, violet
  float k = mod(s.chain + floor(s.seed), 6.0);
  vec3 base = k < 0.5 ? vec3(0.86, 0.10, 0.56) : k < 1.5 ? vec3(0.10, 0.34, 0.86) : k < 2.5 ? vec3(0.96, 0.42, 0.08)
            : k < 3.5 ? vec3(0.96, 0.76, 0.06) : k < 4.5 ? vec3(0.84, 0.10, 0.12) : vec3(0.48, 0.20, 0.80);
  vec3 n = normalize(s.n), v = normalize(s.v);
  vec3 r = reflect(-v, n);
  float e = studio(r);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  // a tinted mirror: the room is seen in the balloon's colour; the lights themselves burn through to white
  vec3 c = base * (0.22 + 1.02 * e);
  c = mix(c, vec3(1.0), clamp(0.55 * sstep(1.05, 1.75, e) + 0.42 * rim, 0.0, 1.0));
  c *= 1.0 - 0.14 * sstep(0.60, 1.0, -r.y);                                                    // the floor's shadow underneath
  return lin(clamp(c, 0.0, 1.0));
}`,
  ink: { ...baseInk, width: 0, opacity: 0 },
};
