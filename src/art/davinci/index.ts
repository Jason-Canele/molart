import { ArtStyle, baseInk } from '../types';

/**
 * Leonardo da Vinci — sepia pen-and-wash study (on white; no parchment, no notes).
 * Iron-gall/sepia ink: parallel hatching that follows the form (lines run across the ribbon,
 * slanting with the band), a second crossing layer and a third in the deepest shadows; a pale
 * bistre wash; lit faces left as paper; thin sketchy pen contour with searching doubled lines.
 */
export const davinciStyle: ArtStyle = {
  id: 'davinci',
  label: 'da Vinci',
  technique: 'Sepia pen study: form-following parallel hatching with cross-hatching in the shadows, pale bistre wash, lit faces left as paper, thin searching doubled contour.',
  mesh: 'splatter',
  splatter: { seed: 0, skeins: false, flicks: false, drops: 0, sketch: { passes: 3, overshoot: 2.8, jitter: 0.22, radius: 0.045 } },
  ribbon: { helixWidth: 3.0, helixThickness: 0.22, strandWidth: 2.7, strandThickness: 0.24, arrowWidth: 4.0, coilWidth: 1.05, coilThickness: 0.24, coilFlatness: 8, flatness: 12 },
  art: {
    note: 'a study of the mechanism: each helix drawn as a true screw, its blade winding around the axis like the aerial screw; strands as sawn planks, loops as straight rods with knee joints.',
    ribbon: { smooth: { helix: 0, strand: 4 }, path: 'polyline', blockEnds: true, samplesPerResidue: 12, helixWidth: 0.7, helixThickness: 3.4, flatness: 12, strandWidth: 3.4, strandThickness: 0.8, coilWidth: 0.9, coilThickness: 0.9 },
  },
  surfaceGLSL: /* glsl */ `
float hatch(vec2 p, float angle, float spacing, float width, float seed){
  // hand-drawn hatching: per-patch angle drift, uneven spacing, strokes of varying length with pen lifts
  vec2 patch_ = floor(p / vec2(1.6, 0.9));
  float a = angle + (hash12(patch_ + seed) - 0.5) * 0.35;
  float u = cos(a) * p.x + sin(a) * p.y;
  float w = -sin(a) * p.x + cos(a) * p.y;
  float k = floor(u / spacing);
  float jit = (hash11(k * 1.37 + seed) - 0.5) * 0.45;                  // uneven line spacing
  float f = fract(u / spacing + jit + 0.08 * sin(mod(w * 1.3 + k, 6.2831853)));
  float l = abs(f - 0.5) * spacing;
  float wid = width * (0.6 + 0.8 * hash11(k * 2.11 + seed));           // pressure per stroke
  float seg = fract(w / (1.4 + 1.6 * hash11(k * 3.7 + seed)) + hash11(k * 5.3));
  float lift = step(0.05 + 0.08 * hash11(k * 9.1 + seed), seg);         // gaps where the pen lifts
  return (1.0 - sstep(wid * 0.5, wid * 0.5 + 0.015, l)) * lift;
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  vec3 sepiaInk = vec3(0.17, 0.09, 0.04);   // dark iron-gall ink
  if (s.ss > 2.5) return lin(sepiaInk);                             // sketch construction lines
  float L = halfLambert(s.n);
  float graze = 1.0 - abs(dot(s.n, s.v));
  float shade = clamp(1.0 - L + 0.55 * graze * graze + step(s.faceY, 0.0) * 0.15, 0.0, 1.2);
  // warm toned paper-and-wash: light ochre on the lit face, bistre/sepia wash in shade
  vec3 lt = vec3(0.95, 0.89, 0.74), md = vec3(0.78, 0.60, 0.38), dk = vec3(0.45, 0.29, 0.14);
  vec3 c = mix(lt, md, sstep(0.25, 0.65, shade));
  c = mix(c, dk, sstep(0.7, 1.05, shade));
  c *= 0.95 + 0.1 * fbm2(vec2(X * 0.25, Y * 1.4) + s.seed);          // uneven wash
  vec2 p = vec2(X, Y);
  // fine, dense parallel hatching (left-handed diagonal) building up with shade, cross-hatch only in the deepest shadow
  // hatching follows the form: strokes run across the ribbon, curving with it, and cover most of the surface
  float h1 = hatch(p, 1.35, 0.18, 0.065, s.seed) * sstep(0.12, 0.35, shade);
  float h3 = hatch(p, 0.9, 0.15, 0.05, s.seed + 7.0) * sstep(0.55, 0.75, shade);
  float h2 = hatch(p, -0.6, 0.2, 0.055, s.seed + 3.0) * sstep(0.78, 0.98, shade);
  float ink = max(max(h1 * 0.85, h3), h2 * 0.9);
  ink *= 0.75 + 0.25 * vnoise1(X * 0.5 + Y + s.seed);               // pen pressure varies
  c = mix(c, sepiaInk, ink * 0.92);
  return lin(c);
}`,
  ink: { ...baseInk, color: [0.14, 0.08, 0.04], color2: [0.24, 0.14, 0.06], width: 1.15, widthVar: 0.55, breaks: 0.08, double: 0.85, wobble: 1.4, softness: 0.28, frequency: 2.0 },
};
