import { ArtStyle, baseInk } from '../types';

/**
 * Assembly — the chain as the pieces it is put together from, after the provenance strips of the oracle-diff
 * paper (each residue coloured by the protein its fragment was retrieved from).
 * Every helix and every strand is its own piece of matte paper in one of the paper's ten source colours;
 * the loops that join them are grey. Flat colour with a little paper tooth, the underside a shade darker,
 * a dark ink outline. Science mode keeps the true ribbon and marks where one piece ends and the next begins;
 * art mode cuts the pieces apart, straightens the helices and lays everything flat, like parts set out
 * before assembly. The colours number the pieces of this chain; they are not a record of where a piece
 * came from.
 */
export const assemblyStyle: ArtStyle = {
  id: 'assembly',
  label: 'Assembly',
  technique: 'Cut-paper pieces: each helix and strand a matte piece in one of ten source colours of the oracle-diff paper, loops grey, dark ink outline.',
  mesh: 'smooth',
  ribbon: { helixWidth: 2.9, helixThickness: 0.5, strandWidth: 2.9, strandThickness: 0.5, arrowWidth: 4.2, coilWidth: 0.8, coilThickness: 0.4, coilFlatness: 6, flatness: 10, runs: true },
  art: {
    note: 'parts set out before assembly: each helix is one straight bar, each strand one arrow, cut apart from its neighbours and laid flat; the grey loops still say what joins what.',
    ribbon: { smooth: { helix: 8, strand: 3, coil: 3 }, face: 'all', gap: 1.8, runs: true, helixWidth: 4.2, strandWidth: 3.6, arrowWidth: 5.4, coilWidth: 0.7, coilThickness: 0.3 },
  },
  surfaceGLSL: /* glsl */ `
vec3 piece(float i){
  i = mod(i, 10.0);
  return i < 0.5 ? vec3(0.141, 0.541, 0.541) : i < 1.5 ? vec3(0.608, 0.482, 0.710) : i < 2.5 ? vec3(0.722, 0.537, 0.180)
       : i < 3.5 ? vec3(0.369, 0.561, 0.243) : i < 4.5 ? vec3(0.761, 0.333, 0.478) : i < 5.5 ? vec3(0.498, 0.702, 0.702)
       : i < 6.5 ? vec3(0.761, 0.690, 0.831) : i < 7.5 ? vec3(0.851, 0.753, 0.541) : i < 8.5 ? vec3(0.639, 0.749, 0.561)
       : vec3(0.871, 0.608, 0.702);
}
vec3 shadeSurface(Surface s){
  float X = s.phys.x, Y = s.phys.y;
  vec3 ink = vec3(0.149, 0.176, 0.200);
  vec3 c = s.ss < 0.5 ? vec3(0.545, 0.565, 0.596) : piece(floor(s.run.y + 0.5) * 3.0 + s.chain * 5.0);   // loops grey; pieces step through the ten colours
  if (abs(s.faceY) < 0.45) return lin(mix(c * 0.55, ink, 0.25));                 // the cut edge of the paper
  c *= s.faceY < 0.0 ? 0.80 : 1.0;                                               // the underside
  c *= 0.94 + 0.10 * fbm2(vec2(X * 0.9, Y * 2.2) + s.chain * 3.0);               // paper tooth
  c *= 1.0 - 0.10 * sstep(0.80, 1.0, abs(s.across));                             // a little shade towards the cut
  // where one piece ends and the next begins
  float joint = s.ss > 0.5 && s.run.y > 0.5 ? max(1.0 - sstep(0.0, 0.035, s.run.x), sstep(0.965, 1.0, s.run.x)) : 0.0;
  return lin(mix(c, ink, 0.55 * joint));
}`,
  ink: { ...baseInk, color: [0.149, 0.176, 0.2], color2: [0.149, 0.176, 0.2], width: 1.0, softness: 0.4 },
};
