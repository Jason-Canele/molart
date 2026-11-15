# molart

Artist-inspired renderings of real protein structures, in the browser.

molart loads a PDB or mmCIF file, draws the usual protein cartoon, and then redraws the same
structure in 21 styles: reimaginations inspired by Schiele, Picasso, Klimt, Van Gogh, Dalí, Monet,
Hokusai, O'Keeffe, Warhol, Pollock, Kandinsky, Matisse, Mondrian and da Vinci, plus sumi-e, glass,
frosted, cartoon, surface and ASCII styles. The pictures are original procedural drawings; no
artist's work is reproduced.

- **Coordinates never change.** Every effect lives in display geometry and shaders.
- **Science | Art.** Science mode keeps the ribbon geometry; art mode (opt-in, labelled) lets a
  style reshape the drawn ribbon.
- **Per chain.** Each chain can have its own style and mode.
- **Local.** Files you open stay in your browser. Fetching by PDB ID is an explicit button and
  goes to files.rcsb.org.
- **Export.** White-background PNG up to 4K.

## Run

Requires Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Command line

Renders with the same code as the app, in headless Chromium
(`npx playwright-core install chromium`).

```sh
node cli/molart.mjs render public/samples/1TIM.cif --style klimt --width 2400 --height 2400 --output klimt.png
node cli/molart.mjs gallery public/samples/1TIM.cif --size 2048 --output-dir outputs/
node cli/molart.mjs styles
```

## Tests

```sh
npm test             # unit tests
npm run test:e2e     # browser tests (needs a build and Chromium)
```

## Website

`.github/workflows/pages.yml` builds the app and deploys it to GitHub Pages on every push to
`main`, once Pages is enabled for the repository (Settings → Pages → Source: GitHub Actions).

## Credits

- [three.js](https://threejs.org) (MIT) for WebGL rendering.
- The ASCII style is inspired by [ascii-fold](https://github.com/mitsenkov/ascii-fold) by
  Maxim Tsenkov (MIT). No code was copied.
- Sample structures in `public/samples/` (1TIM, 3CHY, 1UBQ, 4HHB) are unmodified downloads from
  the [RCSB PDB](https://www.rcsb.org) (CC0 1.0).

## License

MIT, see [LICENSE](LICENSE).
