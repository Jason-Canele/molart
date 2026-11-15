import { ArtStyle, baseInk } from '../types';

/**
 * Wassily Kandinsky — colour composition on the protein bands.
 * Ribbons are cut into sections with diagonal boundaries, each a translucent watercolour-like
 * field of red, orange, yellow, blue, cream or black; concentric circles and fine black lines
 * are laid on the bands (never floating beside them); helices lean warm, strands cool.
 */
export const kandinskyStyle: ArtStyle = {
  id: 'kandinsky',
  label: 'Kandinsky',
  technique: 'Bands cut diagonally into translucent red/yellow/blue/cream/black fields, concentric circles and fine black lines laid on the ribbons; warm helices, cool strands.',
  mesh: 'smooth',
  ribbon: { helixWidth: 3.0, helixThickness: 0.24, strandWidth: 2.8, strandThickness: 0.26, arrowWidth: 4.1, coilWidth: 1.1, coilThickness: 0.24, coilFlatness: 8, flatness: 12 },
  art: {
    note: 'point, line and plane: helices are circles, strands triangles, loops straight lines meeting at sharp angles.',
    fit: 0.33,
    ribbon: { smooth: { helix: 8, strand: 4 }, path: 'polyline', sharp: true, face: 'all', outline: { helix: { kind: 'disc', max: 10.5 }, strand: { kind: 'taper' } }, helixThickness: 0.4, strandWidth: 4.6, coilWidth: 0.45, coilThickness: 0.4 },
  },
  surfaceGLSL: /* glsl */ `
vec3 kcol(float h, bool warm){
  if (warm) return h < 0.34 ? vec3(0.86, 0.22, 0.12) : (h < 0.6 ? vec3(0.96, 0.58, 0.12) : (h < 0.82 ? vec3(0.98, 0.82, 0.25) : vec3(0.96, 0.92, 0.80)));
  return h < 0.5 ? vec3(0.12, 0.36, 0.70) : (h < 0.65 ? vec3(0.96, 0.92, 0.80) : (h < 0.8 ? vec3(0.22, 0.48, 0.62) : vec3(0.98, 0.80, 0.22)));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  // diagonal section boundaries
  float slant = (hash11(floor(X / 4.0) + s.seed) - 0.5) * 0.8;
  float secLen = 4.0 + 8.0 * hash11(floor(X / 7.0) * 1.3 + s.seed);
  float sec = floor((X + Y * slant) / secLen);
  bool warm = s.ss < 1.5;
  // each element keeps its own flat hue: red helices, blue sheets, yellow loops
  float elk = hash11(floor(X / 30.0) + s.chain * 17.0 + s.seed);
  vec3 c = s.ss > 1.5 ? vec3(0.12, 0.31, 0.61) : (s.ss > 0.5 ? (elk < 0.5 ? vec3(0.84, 0.16, 0.16) : (elk < 0.8 ? vec3(0.12, 0.31, 0.61) : vec3(0.95, 0.76, 0.19))) : vec3(0.95, 0.76, 0.19));
  float acc = hash11(sec * 2.31 + s.seed + s.chain * 3.0);
  if (acc > 0.94 && fract((X + Y * slant) / secLen) < 0.12) c = vec3(0.96, 0.52, 0.12);                // rare orange accent
  else if (acc > 0.86 && fract((X + Y * slant) / secLen) < 0.08) c = vec3(0.07);   // thin black band across the ribbon
  // concentric circles on some sections (Kandinsky's "several circles")
  // concentric rings (Kandinsky's "Several Circles") centred on the band
  float ringId = floor(X / 17.0);
  float rc = (ringId + 0.5) * 17.0 + (hash11(ringId + s.seed) - 0.5) * 7.0;
  if (s.ss > 0.5 && hash11(ringId * 2.7 + s.chain + s.seed) > 0.35) {
    vec2 q = vec2(X - rc, Y);
    float r = length(q) * 0.62;   // large targets, wider than the band: seen as arcs crossing it
    if (r < 3.0) {
      c = r < 0.75 ? vec3(0.98, 0.80, 0.18) : (r < 1.5 ? vec3(0.86, 0.20, 0.12) : (r < 2.25 ? vec3(0.12, 0.34, 0.68) : vec3(0.96, 0.92, 0.80)));
      for (int k = 1; k <= 4; k++) if (abs(r - float(k) * 0.75) < 0.07) c = vec3(0.06, 0.06, 0.08);
    }
  }
  // a few long straight black lines along the band
  if (abs(Y - (hash11(floor(X / 18.0) * 3.3) - 0.5) * 1.6) < 0.07 && hash11(floor(X / 18.0) * 5.9) > 0.45) c = vec3(0.05);
  // triangles and checker strips: small black-and-cream geometric passages on the loops and strands
  float gid = floor(X / 11.0);
  float gh = hash11(gid * 4.1 + s.chain * 2.0 + s.seed);
  float gu = fract(X / 11.0) * 11.0;
  if (s.ss < 0.5 || s.ss > 1.5) {
    if (gh > 0.72 && gu < 3.2) { float chk = mod(floor(gu / 0.8) + floor((Y + 4.0) / 0.8), 2.0); c = chk > 0.5 ? vec3(0.06) : vec3(0.96, 0.92, 0.80); }
    else if (gh < 0.22 && gu < 3.0 && abs(Y) < (3.0 - gu) * 0.45) c = vec3(0.86, 0.20, 0.12);   // a red wedge pointing along the chain
  }
  return lin(c);
}`,
  ink: { ...baseInk, color: [0.07, 0.07, 0.07], color2: [0.07, 0.07, 0.07], width: 1.5, widthVar: 0.0, breaks: 0.0, softness: 0.35, frequency: 1.0 },
};
