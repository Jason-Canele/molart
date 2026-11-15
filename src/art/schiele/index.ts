import { ArtStyle, baseInk } from '../types';

/**
 * Egon Schiele — expressive pen & wash.
 * Geometry: thin paper-like ribbons (wide helices/strands, flat narrow loops) so the turning
 * edges read as drawn lines.
 * Surface: watercolour wash in residue/Å coordinates — cream on broad lit faces, terracotta,
 * then burnt sienna/umber concentrated where the ribbon turns away; dry-brush striations along
 * the ribbon; granulated, blotchy sage on strands; ribbon side faces inked dark (pen borders);
 * short cross-contour hatching in the shadows.
 * Ink (composite pass): thin, crisp black/rust pen contour with nervous width, gaps and doubled
 * hairlines keyed to the occluding residue; slight wash misregistration.
 */
export const schieleStyle: ArtStyle = {
  id: 'schiele',
  label: 'Schiele',
  technique: 'Wiry, sketchy multi-stroke sepia contours over translucent watercolour: pale yellow-ochre helices turning to burnt sienna and brown at each twist, streaky sage strands, paper showing through, darker wet edges.',
  mesh: 'splatter',
  splatter: { seed: 0, skeins: false, flicks: false, drops: 0, sketch: { passes: 2, overshoot: 3.2, jitter: 0.26, radius: 0.035 } },
  ribbon: {
    helixWidth: 2.7,
    helixThickness: 0.16,
    strandWidth: 2.7,
    strandThickness: 0.22,
    arrowWidth: 4.1,
    coilWidth: 0.95,
    coilThickness: 0.2,
    coilFlatness: 8,
    flatness: 12,
  },
  art: {
    note: 'gaunt and angular: the figure is drawn tall and thin; each helix is one long bony limb swelling at its knuckles, loops are wiry and break at sharp elbows, strands are splayed fingers ending in points.',
    stretch: 1.4,
    ribbon: { smooth: { helix: 8 }, exaggerate: 0.45, path: 'polyline', sharp: true, outline: { helix: { kind: 'scallop', lobes: 2, amount: 0.38 }, strand: { kind: 'taper' }, coil: { kind: 'petal', amount: 0.6, min: 0.22 } }, helixWidth: 3.0, strandWidth: 3.3, coilWidth: 0.7 },
  },
  surfaceGLSL: /* glsl */ `
vec3 ramp4(float v, vec3 a, vec3 b, vec3 c, vec3 d){
  vec3 r = mix(a, b, sstep(0.0, 0.33, v));
  r = mix(r, c, sstep(0.3, 0.6, v));
  return mix(r, d, sstep(0.78, 1.0, v));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  float L = halfLambert(s.n);
  float graze = 1.0 - abs(dot(s.n, s.v));
  vec3 paper = vec3(0.985, 0.97, 0.94);
  vec3 sepia = vec3(0.24, 0.15, 0.10);
  if (s.ss > 2.5) return lin(sepia);                                // sketch construction lines
  if (abs(s.faceY) < 0.45) return lin(mix(sepia, vec3(0.55, 0.36, 0.22), 0.4));                      // ribbon edge = drawn line
  // watercolour coverage: uneven, leaves paper showing; darker pigment collects at the wash edge
  float patch_ = fbm2(vec2(X * 0.16, Y * 0.9) + s.seed * 1.7);
  float cover = sstep(0.46, 0.70, patch_);
  float wetEdge = 1.0 - sstep(0.0, 0.09, abs(patch_ - 0.36));
  float streak = fbm2(vec2(X * 0.22, Y * 2.2) + s.seed) - 0.5;   // broad, uneven brush passes   // brush streaks along the ribbon
  vec3 pig;
  float v;
  if (s.ss > 1.5) {
    // strands: translucent sage with darker green streaks
    v = clamp(0.3 + 0.4 * (1.0 - L) + 0.3 * graze + streak * 0.7, 0.0, 1.0);
    pig = ramp4(v, vec3(0.74, 0.78, 0.60), vec3(0.60, 0.67, 0.47), vec3(0.47, 0.54, 0.33), vec3(0.37, 0.42, 0.24));
  } else {
    // helices and loops: pale yellow-ochre on the lit face, orange, then burnt sienna to brown at each twist
    v = clamp(-0.2 + 1.35 * pow(graze, 1.1) + 0.35 * (1.0 - L) + (s.faceY < 0.0 ? 0.35 : 0.0) + streak * 0.3, 0.0, 1.0);
    pig = ramp4(pow(v, 0.85), vec3(0.93, 0.80, 0.42), vec3(0.90, 0.60, 0.20), vec3(0.75, 0.42, 0.16), vec3(0.35, 0.19, 0.09));
    // terracotta / brick-red accents in irregular touches, as in his figures
    float touch = sstep(0.60, 0.74, fbm2(vec2(X * 0.09, Y * 0.6) + s.seed * 5.3 + s.chain));
    pig = mix(pig, vec3(0.74, 0.27, 0.16), touch * 0.75);
    // cold, bruised passages: grey-green and dull violet, sparse
    float bruise = sstep(0.64, 0.76, fbm2(vec2(X * 0.07, Y * 0.5) + s.seed * 8.1 + s.chain * 2.0));
    pig = mix(pig, mix(vec3(0.46, 0.50, 0.40), vec3(0.50, 0.40, 0.48), step(0.5, hash11(floor(X / 20.0) + s.seed))), bruise * 0.7 * (1.0 - touch));   // wider orange-sienna band   // yellow-ochre, burnt sienna, dark brown
  }
  // translucent: paper glows through the wash; dark (turning) passages are more saturated and opaque
  float alpha = mix(0.04, 0.85, cover) * mix(0.45, 1.0, v);   // ~35% paper showing
  alpha = max(alpha, sstep(0.6, 0.9, v) * 0.9);   // dark turns stay saturated   // lit faces mostly paper
  float gap = sstep(0.62, 0.7, fbm2(vec2(X * 0.3, Y * 2.8) + s.seed * 3.1));   // white paper streaks inside the ribbon
  alpha *= 1.0 - gap * sstep(0.7, 0.4, v);
  vec3 c = mix(paper, pig, alpha);
  c = mix(c, pig * 0.8, wetEdge * 0.85);
  c *= 1.0 - 0.28 * sstep(0.78, 1.0, abs(s.across)) * sstep(0.05, 0.3, alpha);   // pigment pools along the ribbon edge                  // wet-edge pigment line
  // a few fine sepia hatch strokes in the darkest turns
  float hl = abs(fract(X * 1.6 + Y * 0.5 + vnoise1(X * 0.4 + s.seed) * 0.8) - 0.5);
  c = mix(c, sepia, (1.0 - sstep(0.02, 0.05, hl)) * sstep(0.75, 0.95, v) * 0.5);
  return lin(c);
}`,
  ink: {
    ...baseInk,
    color: [0.20, 0.13, 0.09],
    color2: [0.33, 0.18, 0.10],
    width: 0.4,
    widthVar: 0.6,
    breaks: 0.12,
    double: 0.95,
    wobble: 2.2,
    misregister: [1.4, -1.0],
    pooling: 0.1,
    softness: 0.3,
    frequency: 2.4,
  },


};
