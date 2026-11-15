import { ArtStyle, baseInk } from '../types';

/**
 * Vincent van Gogh — directed impasto.
 * The ribbon surface is tiled with long, thick strokes laid in staggered, swaying rows along the chain
 * that swirl in rings around each star
 * (arc length × width, Å): each dab is its own colour, sits slightly apart from its neighbours
 * (dark underpaint shows in the gaps), carries a raised ridge plus bristle grooves that perturb
 * the normal (impasto relief and glints), and is oriented by the local chain tangent. Colours are
 * picked per dab from 6-step complementary ramps by the relit tone with a random ±1 step, so
 * neighbouring strokes visibly differ. Contour: broken, dashed dark-blue line.
 */
export const vanGoghStyle: ArtStyle = {
  id: 'vangogh',
  label: 'Van Gogh',
  technique: 'Long thick impasto strokes in swaying rows along the chain, turning into vortices in places; each stroke its own colour with dark gaps and raised ridges; wheat-yellow and orange helices with blue in their shadows, night-blue strands; dashed blue contour.',
  mesh: 'smooth',
  ribbon: {
    helixWidth: 3.0,
    helixThickness: 0.36,
    strandWidth: 2.7,
    strandThickness: 0.38,
    arrowWidth: 4.1,
    coilWidth: 1.2,
    coilThickness: 0.34,
    coilFlatness: 6,
    flatness: 8,
  },
  art: {
    note: 'nothing stands still: the whole chain sways, loops turn into vortices, strands rise like cypress flames, and the paint is laid on in thick ropes.',
    ribbon: { exaggerate: 0.6, smooth: { coil: 3, strand: 1 }, wave: { amp: 1.6, period: 7 }, curl: { radius: 4.0, turns: 1 }, outline: { strand: { kind: 'flame', lobes: 4 } }, helixWidth: 3.4, helixThickness: 1.7, strandWidth: 6.0, strandThickness: 1.2, coilWidth: 2.1, coilThickness: 1.1, flatness: 2.8, coilFlatness: 2.6 },
  },
  surfaceGLSL: /* glsl */ `
vec3 pickN(float k, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, vec3 f){
  // branch-free selection (nested ternaries over vec3 are mis-compiled by some macOS GL drivers)
  vec3 r = a;
  r = mix(r, b, step(1.0, k));
  r = mix(r, c, step(2.0, k));
  r = mix(r, d, step(3.0, k));
  r = mix(r, e, step(4.0, k));
  return mix(r, f, step(5.0, k));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  // stars first: the strokes around a star swirl around it
  float sc = 9.0;
  float sid = floor(X / sc);
  float hasStar = step(0.55, hash11(sid * 4.7 + s.chain * 13.0 + s.seed));   // a vortex of strokes on about half the stretches
  float cx = (sid + 0.5 + (hash11(sid * 2.3 + s.seed) - 0.5) * 0.4) * sc;
  float rs = length(vec2(X - cx, Y));
  float swirl = hasStar * (1.0 - step(3.4, rs));
  float sx = mix(X, atan(Y, X - cx) * max(rs, 0.6) + cx, swirl);     // along the stroke: around the star
  float sy = mix(Y, rs + 0.4 * sin(atan(Y, X - cx) * 2.0), swirl);   // across the strokes: outwards, slightly spiralled
  // long swirling stroke lanes along the ribbon
  float Yw = sy + (1.0 - swirl) * (0.42 * sin(mod(X * 0.42 + s.seed, 6.2831853)) + 0.14 * sin(mod(X * 1.3 + s.chain, 6.2831853)));
  float lane = floor(Yw / 0.38);
  float lx = sx / 2.3 + hash11(lane * 1.7 + s.seed) * 7.0;
  float cell = floor(lx);
  float id = hash11(lane * 3.3 + cell * 0.71 + s.seed);
  // tapered, lens-shaped strokes of random length and offset
  float len = 0.75 + 0.6 * hash11(cell * 5.1 + lane * 2.3 + s.seed);
  float st = (hash11(cell * 2.9 + lane + 11.0) - 0.5) * 0.4;
  float u = (fract(lx) - 0.5 - st) / (len * 1.15) + 0.5;
  float vy = fract(Yw / 0.38) - 0.5 + (hash11(cell * 7.7 + lane) - 0.5) * 0.25;
  float halfW = 0.6 * sqrt(max(0.0, sin(3.14159 * clamp(u, 0.0, 1.0))));
  float rag = (vnoise2(vec2(u * 6.0, id * 13.0)) - 0.5) * 0.12;
  float inU = step(0.0, u) * step(u, 1.0);
  float dash = inU * sstep(halfW + rag, halfW + rag - 0.06, abs(vy));
  float lit = halfLambert(s.n);
  float graze = 1.0 - abs(dot(s.n, s.v));
  // each stroke is ONE unblended colour, chosen by light with a random step
  float tone = clamp(lit * 1.25 - 0.1 - 0.4 * graze * graze + 0.30 * swirl * (1.0 - rs / 3.4), 0.0, 0.999);
  float k = clamp(floor(tone * 6.0 + (id - 0.5) * 2.2), 0.0, 5.0);
  vec3 c, gap;
  if (s.ss > 1.5) {
    // strands: night sky blues with cream-white swirl strokes
    c = pickN(k, vec3(0.09, 0.16, 0.46), vec3(0.18, 0.33, 0.70), vec3(0.34, 0.54, 0.84), vec3(0.55, 0.72, 0.90), vec3(0.80, 0.88, 0.90), vec3(0.96, 0.94, 0.80));
    c = mix(c, vec3(0.34, 0.62, 0.62), step(0.88, id));   // teal accent
    c = mix(c, vec3(0.95, 0.72, 0.18), step(id, 0.06) * step(2.5, k));   // a few yellow strokes in the lights
    gap = vec3(0.08, 0.13, 0.34);
  } else if (s.ss > 0.5) {
    // helices: wheat and sun - red-brown shadows through orange to chrome yellow and pale straw, with strokes of the
    // strands' blue laid into the shadows (complementary contrast inside one form)
    c = pickN(k, vec3(0.42, 0.16, 0.10), vec3(0.72, 0.30, 0.10), vec3(0.90, 0.50, 0.10), vec3(0.96, 0.68, 0.14), vec3(0.98, 0.82, 0.26), vec3(0.98, 0.92, 0.60));
    c = mix(c, vec3(0.16, 0.30, 0.66), step(0.80, id) * step(k, 2.5));   // blue strokes in the shadows
    c = mix(c, vec3(0.36, 0.52, 0.22), step(id, 0.07));                   // rare olive green
    gap = vec3(0.30, 0.14, 0.10);
  } else {
    // loops: cypress darks and night blues
    c = pickN(k, vec3(0.10, 0.12, 0.20), vec3(0.18, 0.24, 0.22), vec3(0.14, 0.24, 0.52), vec3(0.24, 0.38, 0.68), vec3(0.40, 0.55, 0.78), vec3(0.62, 0.72, 0.84));
    gap = vec3(0.14, 0.18, 0.30);
  }
  // impasto: each stroke is a raised ridge of oil paint with bristle grooves running along it
  float across = clamp(vy / max(halfW, 1e-3), -1.0, 1.0);
  float drag = vnoise2(vec2(u * 3.0, vy * 9.0) + id * 17.0) - 0.5;
  float bristle = sin(vy * 26.0 + id * 31.0 + drag * 3.0) * 0.6 + sin(vy * 61.0 + id * 11.0) * 0.3;
  float slopeA = -across * 0.7 + bristle * 0.9 + drag * 0.6;
  float slopeU = (step(u, 0.25) - step(0.8, u)) * 0.6;          // loaded start, dragged end
  vec3 npr = s.n + (s.bin * slopeA + s.tangent * slopeU) * dash * 1.3;
  vec3 np = npr / max(length(npr), 1e-4);
  float relief = 0.88 + 0.3 * (dot(np, normalize(KEY)) - dot(s.n, normalize(KEY)));
  c *= mix(1.0, relief, dash);
  c *= 1.0 - 0.14 * max(-bristle, 0.0) * dash;
  // stars: occasional round yellow bursts with an orange core and a pale halo (the only yellow in the picture)
  float sr = rs / (0.75 + 0.4 * hash11(sid * 6.1));
  float inStar = hasStar * (1.0 - step(1.25, sr));
  vec3 star = mix(vec3(0.94, 0.52, 0.10), vec3(0.98, 0.80, 0.20), sstep(0.2, 0.45, sr));
  star = mix(star, vec3(0.99, 0.92, 0.62), sstep(0.6, 0.8, sr));
  star = mix(star, vec3(0.85, 0.90, 0.78), sstep(0.95, 1.1, sr));
  float ring = 0.85 + 0.15 * sin(sr * 18.0);
  // (no star discs: the vortices are made of strokes alone, lighter towards their centre)
  vec3 lc = lin(mix(gap, c, dash));
  // wet oil sheen on the ridge tops
  lc += vec3(1.0, 0.97, 0.9) * pow(max(dot(np, normalize(normalize(KEY) + s.v)), 0.0), 22.0) * 0.5 * dash * sstep(-0.1, 0.3, bristle);
  return clamp(lc, 0.0, 4.0);
}`,
  ink: {
    ...baseInk,
    color: [0.05, 0.07, 0.18],
    color2: [0.05, 0.07, 0.18],
    width: 0.9,
    widthVar: 0.6,
    breaks: 0.22,
    softness: 0.45,
    frequency: 3.0,
  },
};
