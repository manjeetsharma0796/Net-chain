# NetChain decks

Two decks, both generated with [PptxGenJS](https://gitbrent.github.io/PptxGenJS/)
(the "create from scratch" path of the Anthropic `pptx` skill), 16:9, dark theme.

- **`NetChain-Pitch.pptx`** (`build-deck.mjs`) — a tight 12-slide hackathon pitch.
- **`NetChain-DeepDive.pptx`** (`deep-dive-deck.mjs`) — a 19-slide platform deep dive
  with hand-drawn flow/architecture diagrams and **10 real screenshots of the live app**
  (in `screens/`, captured from netchain.vercel.app via Playwright): dashboard, netting
  graph gross+net, obligations, bilateral "pending acceptance", privacy 404, the settled
  settlement page (settled legs + real tx id), policy + maker-checker, audit, hero.
  Both were QA'd per the `pptx` skill (render to images, fresh-eyes subagent bug-hunt, fix,
  re-verify).

## `NetChain-Pitch.pptx`

A 12-slide hackathon pitch deck.

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

## `NetChain-DeepDive.pptx`

```bash
cd docs/deck
npm i pptxgenjs
node deep-dive-deck.mjs   # -> NetChain-DeepDive.pptx  (reads screens/*.png)
```

Screenshots live in `screens/`; re-capture them from the live app if the UI changes
(the generator embeds them by path at build time). `arrow()` normalizes geometry with
`flipH/flipV`, right-to-left / bottom-to-top connectors would otherwise produce negative
OOXML `cx/cy` and make PowerPoint refuse to open the file.
