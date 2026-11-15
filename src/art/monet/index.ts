import { ArtStyle, baseInk } from '../types';

/**
 * Claude Monet — impressionist broken colour.
 * The ribbon dissolves into small, separate dabs of unmixed colour (teal, cerulean, ochre,
 * rose, lilac, sap green) laid in ribbon coordinates; paper shows between dabs; light is
 * carried by colour temperature (warm lights, cool shadows), not by dark values; no contour,
 * and the silhouette breaks into flecks (anchored dissolve).
 */
export const monetStyle: ArtStyle = {
  id: 'monet',
  label: 'Monet',
  technique: 'Broken colour: small separate dabs of teal, ochre, rose and lilac in ribbon coordinates, paper between them, warm lights and cool shadows, no contour, silhouette breaking into flecks.',
  mesh: 'splatter',
  splatter: { seed: 0, skeins: false, flicks: false, drops: 9, dropReach: 6, dropSize: 0.45 },
  ribbon: { helixWidth: 3.0, helixThickness: 0.3, strandWidth: 2.7, strandThickness: 0.32, arrowWidth: 4.0, coilWidth: 1.3, coilThickness: 0.4, coilFlatness: 4, flatness: 8 },
  art: {
    note: 'water lilies: helices float as round pads of broken colour, strands are long reflections, loops soft drifting stems.',
    fit: 0.3,
    ribbon: { smooth: { helix: 10, strand: 4, coil: 5 }, face: 'all', outline: { helix: { kind: 'disc', max: 10 }, strand: { kind: 'petal', amount: 0.5 }, coil: { kind: 'petal', amount: 0.5, min: 0.2 } }, helixThickness: 0.22, strandWidth: 4.4, strandThickness: 0.22, coilWidth: 0.9, coilThickness: 0.3, coilFlatness: 2, flatness: 2 },
  },
  surfaceGLSL: /* glsl */ `
vec3 dabColor(float k, bool warm, float ss){
  // each structure has its own key: strands deep cerulean/teal, helices saturated gold with rose and teal, loops mixed
  if (ss > 1.5 && ss < 2.5) {
    if (warm) return k < 0.35 ? vec3(0.36, 0.66, 0.82) : (k < 0.6 ? vec3(0.55, 0.80, 0.84) : (k < 0.8 ? vec3(0.20, 0.52, 0.70) : (k < 0.92 ? vec3(0.95, 0.78, 0.36) : vec3(0.92, 0.66, 0.66))));
    return k < 0.4 ? vec3(0.10, 0.38, 0.58) : (k < 0.7 ? vec3(0.15, 0.50, 0.62) : (k < 0.88 ? vec3(0.26, 0.34, 0.62) : vec3(0.36, 0.62, 0.52)));
  }
  if (ss > 0.5 && ss < 1.5) {
    if (warm) return k < 0.3 ? vec3(0.95, 0.72, 0.20) : (k < 0.48 ? vec3(0.98, 0.84, 0.46) : (k < 0.7 ? vec3(0.93, 0.60, 0.56) : (k < 0.88 ? vec3(0.38, 0.70, 0.74) : vec3(0.92, 0.52, 0.22))));
    return k < 0.35 ? vec3(0.20, 0.50, 0.62) : (k < 0.6 ? vec3(0.78, 0.46, 0.44) : (k < 0.8 ? vec3(0.40, 0.38, 0.64) : vec3(0.82, 0.58, 0.18)));
  }
  if (warm) return k < 0.3 ? vec3(0.95, 0.76, 0.34) : (k < 0.55 ? vec3(0.50, 0.75, 0.80) : (k < 0.78 ? vec3(0.93, 0.66, 0.62) : vec3(0.98, 0.88, 0.62)));
  return k < 0.4 ? vec3(0.18, 0.48, 0.62) : (k < 0.7 ? vec3(0.42, 0.42, 0.66) : vec3(0.36, 0.60, 0.50));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  if (s.ss > 2.5) return mix(vec3(1.0), lin(dabColor(fract((s.ss - 3.0) * 0.27 + s.res * 0.013), s.res > 0.0 && fract(s.res * 0.31) > 0.6, 2.0)), 0.75);
  float LS = 1.1, WS = 0.36;
  vec2 p = vec2(X / LS, Y / WS);
  vec2 base = floor(p);
  float best = -1.0; vec2 bestId = vec2(0.0); float bestE = 2.0;
  float best2 = -1.0; vec2 id2 = vec2(0.0); float e2 = 2.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = base + vec2(float(i), float(j));
    vec2 rnd = hash22(id + s.seed);
    vec2 d = (p - id - 0.5 - (rnd - 0.5) * 0.7) * vec2(LS, WS);
    float ang = hash12(id + 9.0) < 0.12 ? 1.2 + (hash12(id + 4.0) - 0.5) * 0.8 : (hash12(id + 4.0) - 0.5) * 0.6;   // ~30% cross the axis   // strokes follow the ribbon direction
    vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
    float sz = 0.3 + 0.75 * hash12(id * 2.9 + 1.0);   // capped length   // uneven sizes: some overlap heavily, some leave gaps
    float taper = 1.0 - 0.35 * clamp(r.x / sqrt(0.42 * sz) * 0.5 + 0.5, 0.0, 1.0);   // loaded end -> dragged tapered end
    float e = (r.x * r.x) / (0.95 * sz) + (r.y * r.y) / (0.055 * sz * taper * taper);   // long streaky strokes   // short comma strokes ~0.4x ribbon width   // ~2.6:1 elongated stroke
    if (e < 1.0) { float pri = hash12(id * 3.7);
      if (pri > best) { best2 = best; id2 = bestId; e2 = bestE; best = pri; bestId = id; bestE = e; }
      else if (pri > best2) { best2 = pri; id2 = id; e2 = e; } }
  }
  float L = halfLambert(s.n);
  if (abs(s.faceY) < 0.5) L = max(L, 0.5);   // thin side faces sit in the mixed band, never a solid shadow slab
  bool warm = L + (hash12(bestId * 1.3 + s.seed) - 0.5) * 0.22 > 0.57;   // wide mixed band where light meets shade
  vec3 paper = vec3(1.0);
  if (best < 0.0) return lin(dabColor(hash12(floor(p * 1.6) + 7.0), warm, s.ss));
  vec3 c = lin(dabColor(hash12(bestId * 2.1 + s.seed), warm, s.ss));
  vec3 under = lin(dabColor(hash12(floor(p * 0.5) + 7.0), warm, s.ss));
  // feathered oil dab: soft rim, bristle streaks inside, colour of the layer beneath bleeding through
  float bristle = vnoise2(vec2(X * 1.5, Y * 22.0) + bestId * 3.0);
  float a = sstep(1.0, 0.45, bestE) * (0.6 + 0.4 * bristle);
  vec3 ground = lin(dabColor(hash12(floor(p * 1.6) + 7.0), warm, s.ss));   // fine broken underlayer, never a solid patch
  if (best2 >= 0.0) ground = mix(ground, lin(dabColor(hash12(id2 * 2.1 + s.seed), warm, s.ss)), sstep(1.0, 0.7, e2));   // stroke beneath, no seam
  // soft, rounded top dab over the dab beneath (no hard facet edges)
  c *= 0.9 + 0.2 * bristle;
  vec3 col = mix(ground, c, sstep(1.0, 0.6, bestE));   // feathered, overlapping strokes
  // light builds the picture: where the light falls the paint is thin, pale and warm and the paper glows through;
  // in the shade the dabs stay dense, cool and saturated (blue-violet), so form comes from temperature and density
  float air = sstep(0.42, 0.78, fbm2(vec2(X * 0.16, Y * 0.5) + s.seed + s.chain * 3.0));
  float sun = sstep(0.42, 0.80, L);
  vec3 shade = mix(col, col * vec3(0.72, 0.78, 1.05) + vec3(0.02, 0.02, 0.08), 0.55);
  col = mix(shade, mix(col, vec3(1.0, 0.93, 0.74), 0.30), sun);
  float thin = 0.05 + 0.42 * sun + 0.24 * air * (0.4 + 0.6 * sun) + 0.20 * sstep(0.5, 1.0, bestE) * (1.0 - bristle);
  return mix(col, vec3(1.0), clamp(thin, 0.0, 0.82));
}`,
  ink: { ...baseInk, opacity: 0, width: 0, dissolve: 0.8, dissolveWidth: 5.0 },
};
