import { ArtStyle, baseInk } from '../types';

/**
 * Salvador Dalí — surreal, polished, soft.
 * Scientific by default (deform = 0): only material/softness changes — liquid honey-gold
 * enamel with long sliding bands of reflected light along the ribbons, strands painted as a
 * teal sky with cream clouds, soft thin
 * contour. The opt-in "melt" slider deforms a *separate display mesh* (gravity sag + teardrop
 * drips, see geometry/dali.ts); atomic coordinates are never touched and the UI labels the
 * result as artistic interpretation.
 */
export const daliStyle: ArtStyle = {
  id: 'dali',
  label: 'Dalí',
  technique: 'Polished liquid-gold and sky-blue enamel with soft edges; optional, clearly-labelled melting of the display mesh (sag + drips).',
  mesh: 'melted',
  deformable: true,
  deformHint: 'Off at 0. Move the slider to melt the ribbons: sag and drips are where this style comes alive.',
  ribbon: { helixWidth: 2.9, helixThickness: 0.28, strandWidth: 2.7, strandThickness: 0.28, arrowWidth: 4.0, coilWidth: 1.1, coilThickness: 0.32, coilFlatness: 6, flatness: 8 },
  art: {
    note: 'the soft watches: each helix becomes a limp disc that sags into a hanging oval and drips, strung on thin round stilts between soft sky-painted strands, the whole figure drawn out tall (Melt on).',
    stretch: 1.4,
    deform: 0.8,
    ribbon: { smooth: { helix: 8, strand: 1, coil: 5 }, face: 'helix', outline: { helix: { kind: 'disc', max: 11 } }, helixThickness: 0.45, strandWidth: 2.6, arrowWidth: 3.8, coilWidth: 0.42, coilThickness: 0.42, coilFlatness: 2 },
  },
  surfaceGLSL: /* glsl */ `
vec3 ramp3(float w, vec3 dk, vec3 md, vec3 lt){
  vec3 c = mix(dk, md, sstep(0.05, 0.5, w));
  return mix(c, lt, sstep(0.55, 0.95, w));
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  float wrap = clamp((dot(s.n, normalize(KEY)) + 0.4) / 1.4, 0.0, 1.0);
  float graze = 1.0 - abs(dot(s.n, s.v));
  vec3 c;
  if (s.ss > 1.5 && s.ss < 2.5) {
    // beta sheets: smooth ivory / cream satin with faint blue-grey streaks along the strand
    // beta sheets: a Dalí sky painted on the strand - pale teal-blue deepening along it, with soft cream clouds
    float sky = sstep(0.2, 0.8, vnoise1(X * 0.05 + s.chain * 2.0 + s.seed));
    vec3 skyLo = mix(lin(vec3(0.42, 0.60, 0.66)), lin(vec3(0.24, 0.44, 0.58)), sky);
    vec3 skyHi = mix(lin(vec3(0.78, 0.88, 0.86)), lin(vec3(0.56, 0.74, 0.80)), sky);
    c = ramp3(wrap, skyLo * 0.75, skyLo, skyHi);
    float cloud = sstep(0.52, 0.74, fbm2(vec2(X * 0.10, Y * 0.55) + s.seed * 2.3));
    c = mix(c, lin(vec3(0.97, 0.93, 0.82)) * (0.72 + 0.28 * wrap), cloud * 0.85);
  } else {
    // helices / loops / drips: molten gold flowing into slate blue along the chain
    vec3 gold = ramp3(wrap, lin(vec3(0.55, 0.33, 0.06)), lin(vec3(0.88, 0.60, 0.16)), lin(vec3(0.98, 0.83, 0.44)));
    vec3 slate = ramp3(wrap, lin(vec3(0.17, 0.24, 0.33)), lin(vec3(0.33, 0.45, 0.57)), lin(vec3(0.62, 0.70, 0.78)));
    float b = sstep(0.42, 0.78, vnoise1(X * 0.07 + s.chain * 3.0 + s.seed));   // blue reaches most helices, long gradients
    b *= 1.0 - sstep(0.6, 1.0, abs(s.across)) * 0.3;
    // blend in perceptual space so the transition stays clean (no muddy mauve)
    c = lin(mix(pow(gold, vec3(1.0 / 2.2)), pow(slate, vec3(1.0 / 2.2)), s.ss > 2.5 ? 0.0 : b));
  }
  c = mix(c, c * 0.55, graze * graze * 0.4);
  // liquid surface: long soft bands of reflected light and shadow slide along the ribbon, as on poured metal
  float flow = fbm2(vec2(X * 0.045 + s.seed, Y * 0.9 + 0.6 * sin(X * 0.11)));
  c *= 0.80 + 0.42 * sstep(0.30, 0.72, flow);
  c += lin(vec3(1.0, 0.95, 0.80)) * 0.20 * sstep(0.70, 0.86, flow) * wrap;
  // satin sheen + a small crisp highlight
  c += lin(vec3(1.0, 0.96, 0.86)) * (blinn(s.n, s.v, 18.0) * 0.18 + step(0.94, max(dot(s.n, normalize(normalize(KEY) + s.v)), 0.0)) * 0.6);
  // faint oil-glaze brushwork along the ribbon
  c *= 0.97 + 0.05 * vnoise2(vec2(X * 0.5, Y * 3.0) + s.seed);
  return c;
}`,
  ink: {
    ...baseInk,
    color: [0.3, 0.2, 0.12],
    color2: [0.22, 0.28, 0.3],
    width: 1.0,
    widthVar: 0.2,
    opacity: 0.8,
    softness: 0.4,
    pooling: 0.08,
  },
};
