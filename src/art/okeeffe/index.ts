import { ArtStyle, baseInk } from '../types';

/**
 * Georgia O'Keeffe — magnified petals.
 * Ribbons rendered as rows of overlapping silky petals (deep throat, midrib, fanning veins, pale thin edge): very smooth, blended gradients from near-white highlights
 * through shell pink and rose to crimson and wine where the band turns; strands in lavender
 * and dusk blue fading to white; faint fine veining along the chain; a soft rose-brown edge,
 * no hard line.
 */
export const okeeffeStyle: ArtStyle = {
  id: 'okeeffe',
  label: "O'Keeffe",
  technique: 'Silky petal gradients: white to shell pink, rose and crimson at the turns; lavender-to-white strands; faint veining; soft rose-brown edges.',
  mesh: 'smooth',
  ribbon: { helixWidth: 4.9, helixThickness: 0.22, strandWidth: 4.3, strandThickness: 0.24, arrowWidth: 5.6, coilWidth: 2.3, coilThickness: 0.24, coilFlatness: 6, flatness: 10 },
  art: {
    note: 'the flower seen from very close: each helix and strand is one great petal, swelling from its base and closing to a point.',
    fit: 0.33,
    ribbon: { smooth: { helix: 8, strand: 4, coil: 6 }, face: 'all', outline: { helix: { kind: 'petal', amount: 0.85 }, strand: { kind: 'petal', amount: 0.9 }, coil: { kind: 'petal', amount: 0.5, min: 0.3 } }, helixWidth: 7.4, strandWidth: 5.0, coilWidth: 1.8 },
  },
  surfaceGLSL: /* glsl */ `
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  float wrap = clamp((dot(s.n, normalize(KEY)) + 0.65) / 1.65, 0.0, 1.0);   // wide, soft value transitions
  float graze = 1.0 - abs(dot(s.n, s.v));
  float v = clamp(0.95 * (1.0 - wrap) + 0.1 * graze - 0.02, 0.0, 1.0);
  // slow colour drift along the chain so petals differ (pink <-> coral <-> magenta)
  float piece = step(0.5, s.run.y);   // art mode: one petal per helix / strand / loop
  float drift = mix(vnoise1(X * 0.04 + s.seed), hash11(s.run.y * 1.7 + s.seed), piece);
  vec3 c;
  if (s.ss > 1.5) {
    vec3 a = vec3(0.88, 0.89, 0.92), b = vec3(0.74, 0.76, 0.84), d = vec3(0.60, 0.63, 0.74), e = vec3(0.48, 0.51, 0.63);
    c = mix(a, b, sstep(0.0, 0.4, v));
    c = mix(c, d, sstep(0.4, 0.75, v));
    c = mix(c, e, sstep(0.75, 1.0, v));
  } else {
    vec3 a = vec3(0.98, 0.95, 0.89);
    vec3 b = mix(vec3(0.95, 0.78, 0.72), vec3(0.94, 0.74, 0.66), drift);
    vec3 d = mix(vec3(0.80, 0.38, 0.38), vec3(0.76, 0.30, 0.34), drift);
    vec3 e = vec3(0.74, 0.33, 0.31);
    c = mix(a, b, sstep(0.0, 0.35, v));
    c = mix(c, d, sstep(0.35, 0.7, v));
    c = mix(c, e, sstep(0.72, 1.0, v));
  }
  // petals: the band is a row of overlapping petals, each with a deep throat where it emerges from under the
  // previous one, a midrib, veins that fan out towards a pale, thin edge
  float pl = s.ss > 1.5 ? 16.0 : 12.0;
  float pu = mix(fract(X / pl + hash11(s.chain * 3.1 + s.seed)), s.run.x, piece);
  float ac = abs(s.across);
  float tip = sstep(0.55, 1.0, pu);
  float throat = (1.0 - sstep(0.0, 0.38, pu)) * (1.0 - 0.6 * ac);
  float edge = sstep(0.55, 1.0, ac) * (0.5 + 0.5 * pu);
  float deepen = 0.62 * throat - 0.30 * edge - 0.16 * tip;
  vec3 deep = s.ss > 1.5 ? vec3(0.36, 0.38, 0.56) : mix(vec3(0.62, 0.16, 0.24), vec3(0.50, 0.12, 0.30), drift);
  c = mix(c, deep, clamp(deepen, 0.0, 1.0));
  c = mix(c, vec3(0.99, 0.95, 0.92), clamp(-deepen * 1.6, 0.0, 1.0));
  // the lip of the petal lying on top casts a soft shadow on the next one
  c *= 1.0 - 0.30 * (1.0 - sstep(0.0, 0.06, pu));
  // midrib and fanning veins, faint
  float fan = Y * (2.4 - 1.0 * pu) + 0.25 * sin(X * 0.35 + s.seed);
  float vein = 1.0 - sstep(0.03, 0.10, abs(fract(fan) - 0.5));
  float rib = 1.0 - sstep(0.02, 0.10, abs(s.across));
  c = mix(c, c * vec3(0.90, 0.80, 0.84), (0.30 * vein + 0.35 * rib) * (1.0 - 0.6 * ac));
  if (s.ss < 0.5) c = mix(c, vec3(0.99, 0.95, 0.92), 0.45 * (1.0 - v));
  // satin sheen
  c = min(c, vec3(0.973, 0.91, 0.88));   // matte: nothing brighter than #F8E8E0
  return lin(c);
}`,
  ink: { ...baseInk, opacity: 0, width: 0, dissolve: 0.35, dissolveWidth: 1.8 },
};
