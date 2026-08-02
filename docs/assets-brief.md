# Landing page — image assets needed

The redesigned `docs/index.html` is asset-independent by default (the scroll story is built entirely from procedural WebGL particles — no images required for it to work and look complete). These two are optional polish on top; the page works fine without them, just slightly plainer.

Drop finished files at the paths below — filenames and dimensions matter, nothing else does.

---

## 1. `docs/assets/og-image.png`

**What it's for:** the preview card shown when this page's link is pasted into Slack, Discord, iMessage, X, LinkedIn, etc. Right now there isn't one, so shared links look bare.

**Spec:** exactly **1200×630px**, PNG, under ~300KB.

**Prompt to generate it:**
> A clean, modern social-share preview image for a student study app called "AI Note Maker." Dark charcoal background (#0a0a0b). Bold, oversized white sans-serif headline text reading "Turn 2am panic into an actual study system." positioned left-aligned with generous margin. To the right, a loose scattered field of small soft glowing dots/particles in white and mint-green (#34d399) that appear to be organizing into a subtle grid pattern — suggesting chaos becoming order. No literal notebook, laptop, or stock-photo imagery — keep it abstract, geometric, premium, like a Linear or Vercel marketing image. No logos or extra text beyond the headline.

## 2. `docs/assets/grain.png`

**What it's for:** a very subtle, tileable film-grain texture overlaid across the page at low opacity, for the tactile, premium "not just flat CSS" feel that sites like Active Theory use. Applied globally via CSS `background-blend-mode`, barely visible — texture, not decoration.

**Spec:** **256×256px**, PNG, seamlessly tileable, grayscale, mostly mid-gray noise (avoid pure black/white extremes so it stays subtle at low opacity in both light and dark mode).

**Prompt to generate it:**
> A seamless, tileable, 256x256 pixel film grain / noise texture. Fine, even, monochrome grain — like 35mm film stock or subtle static — mid-gray tones only, no strong contrast, no visible pattern repetition at the tile edges. Flat, no gradients, no vignette. Must tile edge-to-edge with no visible seam.

---

## Deliberately *not* asking for

- A hero illustration or mascot character — the WebGL particle scene already fills that role, and a static illustration would compete with it rather than add to it.
- Per-feature icons — the existing inline SVG icon set in the feature grid stays; it's cheap, crisp at any size, and themes automatically with `currentColor`.

If either file above is never uploaded, nothing breaks — the `<meta property="og:image">` tag and grain overlay are additive only.
