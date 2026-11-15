import { ArtStyle, baseInk } from '../types';

/**
 * Rubber-hose cartoon — the protein as a troupe of 1930s-style characters.
 * Chunky ribbons in pastel watercolour (coral or teal helices with lavender / slate undersides, butter-yellow
 * strands, lavender loops), a bold brown brush outline of varying weight, and a few characters: some helices
 * and strands get a face (leaning pie-cut eyes, brush-stroke brows, a rosy nose, a wide open smile with a tongue),
 * each with its own tilt, glance and mood, painted on the ribbon itself. Each face is fixed to a
 * spot on its ribbon (picked to look towards the default view), so it turns with the protein.
 * No hands, motion lines or other objects are drawn — only the protein.
 */
export const toonStyle: ArtStyle = {
  id: 'toon',
  label: 'Cartoon',
  technique: 'Rubber-hose cartoon: chunky pastel watercolour ribbons, bold brown brush outline, and lively faces (pie-cut eyes, brush brows, open smile) on a few helices and strands, fixed to the ribbon.',
  mesh: 'smooth',
  faces: { helixHead: 0.95, strandHead: 0.6, span: 1.7, arms: true, fist: 3.5 },
  ribbon: { helixWidth: 3.5, helixThickness: 0.5, strandWidth: 3.3, strandThickness: 0.5, arrowWidth: 5.2, coilWidth: 1.35, coilThickness: 0.36, coilFlatness: 6, flatness: 8 },
  surfaceGLSL: /* glsl */ `
float ell(vec2 p, vec2 c, vec2 r){ return (length((p - c) / r) - 1.0) * min(r.x, r.y); }
float stroke(float d, float w, float aa){ return 1.0 - sstep(w - aa, w + aa, abs(d)); }
vec2 rot2(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// a brush stroke along x in [-hl, hl]: distance d from its centre line, heavy in the middle, tapering to the ends
float brush(float d, float x, float hl, float w, float aa){
  float q = clamp(x / hl, -1.0, 1.0);
  float th = w * (0.22 + 0.78 * (1.0 - q * q));
  return (1.0 - sstep(th - aa, th + aa, abs(d))) * (1.0 - sstep(hl - aa, hl + aa, abs(x)));
}
vec3 shadeSurface(Surface s){
  vec3 coral = lin(vec3(0.97, 0.64, 0.49)), lavender = lin(vec3(0.76, 0.65, 0.84));
  vec3 teal = lin(vec3(0.70, 0.87, 0.85)), slate = lin(vec3(0.50, 0.60, 0.79));
  vec3 butter = lin(vec3(0.99, 0.91, 0.60)), ochre = lin(vec3(0.84, 0.73, 0.42));
  vec3 loopC = lin(vec3(0.82, 0.73, 0.88));
  vec3 line = lin(vec3(0.20, 0.12, 0.08));
  float kind = floor(s.face.w);                            // crisp per-element kind: 0 loop, 1 helix, 2 strand
  float h = fract(s.face.w);
  float pick = step(0.5, fract(h * 3.7));                  // each helix is coral or teal
  float outer = sstep(-0.3, 0.3, s.faceY);
  float drift = vnoise1(s.t * 0.16 + s.seed);              // slow change of hue along the chain
  vec3 warm = mix(lavender, mix(coral, lin(vec3(0.98, 0.72, 0.52)), drift), outer);
  vec3 cool = mix(slate, mix(teal, lin(vec3(0.62, 0.78, 0.88)), drift), outer);
  vec3 helix = mix(warm, cool, pick);
  vec3 strand = mix(ochre, butter, sstep(0.3, 0.7, s.faceY));
  vec3 c = kind > 1.5 ? strand : (kind > 0.5 ? helix : mix(loopC, lavender, drift * 0.6));
  // watercolour: a loose wash with blooms, pigment gathering at the edges, a lighter middle, paper grain
  float L = halfLambert(s.n);
  c *= 0.90 + 0.13 * L;
  float wash = fbm2(s.canvas * 0.22 + s.seed);
  c *= 0.80 + 0.40 * wash;
  float edge = sstep(0.45, 1.0, abs(s.across));
  c *= 1.0 - 0.20 * edge;
  c = mix(c, c * 1.06 + vec3(0.03), (1.0 - edge) * sstep(0.45, 0.75, wash));
  c *= 1.0 + (vnoise2(s.canvas * 4.5 + s.seed * 3.0) - 0.5) * 0.14;
  c *= 1.0 + (hash12(floor(s.canvas * 14.0)) - 0.5) * 0.05;

  // ---- face, in ribbon coordinates around its anchor (Å), scaled to the face radius ----
  float R = max(abs(s.face.y), 1e-3);
  float has = step(0.5, kind) * step(0.3, abs(s.face.y)) * step(0.0, s.faceY * s.face.y) * sstep(0.55, 0.8, abs(s.faceY));
  float a = s.phys.x - s.face.x, w = s.phys.y;
  float sg = s.face.z < 0.0 ? -1.0 : 1.0;
  float alongUp = 1.0 - step(1.5, abs(s.face.z));
  // on a helix the ribbon curls away quickly along the chain, so faces there are drawn narrower in that direction
  vec2 p = mix(vec2(a * 1.28, w * sg), vec2(w, a * sg), alongUp) / R;   // (right, up)
  // every character is a little different: head tilt, where it looks, and whether it laughs
  float h1 = fract(h * 5.1), h2 = fract(h * 9.7), h3 = fract(h * 13.3);
  p = rot2(p, (h1 - 0.5) * 0.5);
  float lx = step(0.5, h2) * 2.0 - 1.0;
  vec2 look = vec2(lx * 0.8, mix(-0.5, 0.55, step(0.6, h3)));
  float laugh = step(0.68, fract(h * 11.3));
  float aa = clamp(0.6 * length(vec2(fwidth(p.x), fwidth(p.y))), 0.004, 0.035);   // capped: lines must not swell on oblique surfaces
  float e = p.x < 0.0 ? -1.0 : 1.0;
  // eyes: tall ovals leaning together, big pupils with a pie cut, heavy outline
  vec2 pe = rot2(p - vec2(e * 0.262, 0.27), -e * 0.12);      // tops lean towards each other
  float dEye = ell(pe, vec2(0.0), vec2(0.215, 0.39));
  float open = 1.0 - laugh;
  float white = (1.0 - sstep(-aa, aa, dEye)) * open;
  float eyeLine = stroke(dEye, 0.04, aa) * open;
  vec2 pcn = look * vec2(0.085, 0.13);
  float dPup = ell(pe, pcn, vec2(0.105, 0.205));
  vec2 pd = normalize(pe - pcn + vec2(1e-5));
  float pie = step(0.80, dot(pd, normalize(vec2(-look.x, 0.75)))) * step(0.02, length(pe - pcn));
  float pupil = (1.0 - sstep(-aa, aa, dPup)) * (1.0 - pie) * white;
  // laughing: the eyes close into two thick arches that taper at the ends
  vec2 pa = p - vec2(e * 0.25, 0.30);
  float arch = brush(pa.y + 3.0 * pa.x * pa.x, pa.x, 0.20, 0.065, aa) * laugh;
  // brows: short brush strokes high on the forehead, one a little higher than the other
  vec2 pb = p - vec2(e * 0.27, 0.90 + e * lx * 0.05 + 0.03 * laugh);
  pb.y += e * pb.x * 0.30;                                   // outer ends drop a little: a friendly arch
  float brow = brush(pb.y + 3.0 * pb.x * pb.x, pb.x, 0.15, 0.04, aa);
  // nose: a small rosy bump, outlined underneath
  vec2 nc = vec2(look.x * 0.08, -0.09);
  float dN = ell(p, nc, vec2(0.105, 0.085));
  float noseFill = 1.0 - sstep(-aa, aa, dN);
  float noseLine = stroke(dN, 0.035, aa) * (1.0 - sstep(nc.y, nc.y + 0.06, p.y));
  // mouth: a wide smile with creases at its corners, open below it, with a tongue
  float x = p.x - look.x * 0.05;
  float ys = -0.36 + 0.62 * x * x;
  float smile = brush(p.y - ys, x, 0.62, 0.05, aa);
  float crease = stroke(length(vec2(abs(x) - 0.60, p.y + 0.10)) - 0.085, 0.028, aa) * step(0.60, abs(x)) * step(-0.16, p.y);
  float dBowl = ell(vec2(x, p.y), vec2(0.02, -0.40), vec2(0.36 + 0.07 * laugh, 0.42 + 0.10 * laugh));
  float below = 1.0 - sstep(ys - 0.03 - aa, ys - 0.03 + aa, p.y);
  float mouth = (1.0 - sstep(-aa, aa, dBowl)) * below;
  float mouthLine = stroke(dBowl, 0.045, aa) * below;
  vec2 tc = vec2(0.03, -0.70 - 0.07 * laugh);
  float dT = ell(vec2(x, p.y), tc, vec2(0.21, 0.17));
  float tongue = mouth * (1.0 - sstep(-aa, aa, dT));
  float tongueLine = mouth * max(stroke(dT, 0.03, aa), stroke(x - tc.x, 0.014, aa) * tongue * (1.0 - sstep(tc.y - 0.02, tc.y + 0.06, p.y)));
  float cheek = (1.0 - sstep(0.0, 0.17, length(vec2(abs(x) - 0.56, p.y + 0.02)))) * 0.38;
  vec3 dark = lin(vec3(0.15, 0.08, 0.06));
  vec3 f = c;
  f = mix(f, lin(vec3(0.97, 0.56, 0.52)), cheek);
  f = mix(f, f * vec3(1.0, 0.86, 0.84), noseFill * 0.8);
  f = mix(f, lin(vec3(0.99, 0.97, 0.91)), white);
  f = mix(f, dark, max(eyeLine, pupil));
  f = mix(f, dark, mouth);
  f = mix(f, lin(vec3(0.96, 0.60, 0.52)), tongue);
  f = mix(f, dark, max(max(brow, arch), max(max(noseLine, tongueLine), max(smile, max(crease, mouthLine)))));
  float inFace = has * (1.0 - step(1.3, length(p)));
  // ---- arms: flagged short loops are thin hoses with a white gloved fist ----
  float arm = (1.0 - step(0.5, kind)) * step(0.25, h);
  float fr = max(abs(s.face.y), 1e-3);
  float u = (s.phys.x - s.face.x) / fr;
  float glove = arm * (1.0 - sstep(0.86, 0.92, abs(u)));
  vec3 g = lin(vec3(0.98, 0.96, 0.90)) * (0.84 + 0.18 * L) * (0.93 + 0.14 * wash);
  float gaa = clamp(fwidth(u), 0.004, 0.04);
  float cuff = stroke(abs(u) - 0.62, 0.05, gaa);                                   // rolled cuffs at both wrists
  float ar = fract(s.around + 0.5) - 0.5;                                          // around the fist, 0 on its top
  float fingers = max(stroke(ar * 6.283, 0.06, 0.03), max(stroke((ar - 0.11) * 6.283, 0.06, 0.03), stroke((ar + 0.11) * 6.283, 0.06, 0.03)));
  fingers *= (1.0 - sstep(0.28, 0.36, abs(u)));
  g = mix(g, dark, max(cuff, fingers) * 0.9);
  c = mix(c, g, glove);
  return mix(c, f, inFace);
}`,
  ink: { ...baseInk, color: [0.2, 0.12, 0.08], color2: [0.26, 0.15, 0.09], width: 3.0, widthVar: 0.5, wobble: 0.3, pooling: 0.36, softness: 0.55, frequency: 0.55 },
};
