# NetChain pitch deck

`NetChain-Pitch.pptx`, a 12-slide hackathon pitch deck (16:9), generated from
`build-deck.mjs` with [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) (the
"create from scratch" path of the Anthropic `pptx` skill).

Slides: title/thesis, the problem, the intersection thesis, the netting flow,
the four money moments (live 404 privacy, atomic settle, bilateral confirmation,
MCP bounded agent), the honest privacy model, live-Canton proof, market/positioning,
and the close. Content tracks `docs/DEMO_SCRIPT.md` and `docs/PRODUCT_RESEARCH.md`.

## Regenerate

```bash
cd docs/deck
npm i pptxgenjs          # not a repo dependency, this is a one-off authoring tool
node build-deck.mjs      # -> NetChain-Pitch.pptx
```

Edit `build-deck.mjs` (colors are in the `C` object at the top; each slide is its
own block) and re-run. Keep it in sync with `docs/DEMO_SCRIPT.md` when the demo changes.
