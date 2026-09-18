# Visual system · Motor Agéntico

> Internal design document. A summary is in the README.

Five minutes of reading. If you are going to touch a screen, read all of it first.

## Identity

**A single interface accent, cyan `#22D3EE`**, over almost-black backgrounds with a cold tint. The golden reference we
come from contributed its **composition** (brackets, mono micro-labels, terminal
header, skies with constellations), never its colour.

On top of that single accent there are now two more layers of colour, each with its rule:

1. **Section tint** (`SECTION_TONE` in `Parts.tsx`): each screen has a
   semantic colour: the review violet, memory green, money amber, connections
   cyan. It tints the hero and the pieces that preside over THAT screen, nothing
   more. It is not a theme: the interface is still cyan.
2. **Brand tint** (`TINT` in `Brands.tsx`): Claude is coral, OpenAI green,
   Obsidian violet. The single-accent rule governs the interface, not other
   people's logos: painting Claude cyan would invent an identity it does not
   have. Monochrome brands (Notion, Resend, Ollama) go in bone, not with a fake
   colour.

A tint **never colours long text**: at that size the contrast is not
guaranteed. It tints backgrounds (subtle gradient), borders, logos and seals.

## Tokens

| role | value | what for |
|---|---|---|
| `--pit` | `#05070A` | the background of everything |
| `--floor` | `#07090B` | the sidebar |
| `--card` | `#0C1116` | content surface |
| `--card-high` | `#111820` | raised surface, chips, tiles |
| `--amber` | `#22D3EE` | the accent (the name is inherited; the colour is cyan) |
| `--spend` | `#FBBF24` | money going out · money section, **and no other** |
| `--saving` | `#34D399` | money that stays · correct · memory section |
| `--alert` | `#FB7185` | really billed · error · limits at 92 % |
| `--review` | `#A78BFA` | running · the nightly review section |
| `--text` | `#F3F5F7` | 17:1 over the pit |
| `--text-2` | `#93A3B0` | 7.5:1, secondary body |
| `--text-3` | `#6E7D8A` | 4.6:1, the minimum that is still text |

Brand tints are not CSS tokens: they live in `TINT` (`Brands.tsx`) because
they are brand data, not theme decisions. The pieces receive them through the
`--tint` custom property, which the components set: nobody writes it by hand.

## The pieces and when to use each

Everything lives in `src/components/Parts.tsx`, except the Constellation, which
has its own file (`Constellation.tsx`) because it is generative code: seeded
geometry, nothing to do with the data pieces. A decision taken so as not to
inflate Parts.tsx with 100 lines of PRNG; if Parts grows again, the next
natural cut is to split out the formatters (`usd`, `tok`, `ago`…).

| piece | what it is | the rule |
|---|---|---|
| `Section` | THE section header: eyebrow · title · note, with the meta on the title line | only one for the ten screens. Anatomy and rules in "The final seam" below. |
| `Label` | the small mono tag INSIDE a card | it is **no longer** a header: if it heads a `<section>`, the piece is `Section`. |
| `Panel` | surface with `tint`, `selected`, `frame`, `href` | the tint is a very subtle corner gradient, not a coloured background. `selected` is the strong state (it fills with the tint, like the violet Obsidian card in the reference): **one per group**. `frame` (brackets) only on the 2-3 pieces that preside over a screen. |
| `Card` | the classic surface | it still exists; `Panel` is its superset. New code uses `Panel`. |
| `Tile` | the rounded square with a brand's logo and its tint | `live=false` switches it off entirely: an unconfigured connection looks grey, not in its party colour. |
| `Badge` | rectangular seal (`LAUNCHAGENT`, category badge) | it classifies. It does not breathe. |
| `Capsule` | status pill (`LIVE`, `ACTIVE`) | `beat` adds the breathing dot, and only for what is happening NOW. A capsule that beats in forty places beats in none. |
| `Gauge` | donut with the percentage in the centre | without a known ceiling, the ring stays open and says "—": never a made-up percentage. One-word captions: the circle is 74 px. |
| `LimitBar` | "LIMIT 5H · 25 / 900" with a bar | three truths, three drawings: proportion if there is a ceiling; empty bar + "no public ceiling" if there is not; `NoData` if not even the usage is known. From 92 % it paints itself in `--alert`. |
| `Rail` | row of action cards with icon, title, note and arrow | the "attention now". At most 4; with more, it is a list, not a rail. |
| `Constellation` | star field + constellations for section heroes | **deterministic by seed** (mulberry32): the server and the client paint the same sky and React does not complain. `Math.random()` in render is forbidden in the whole project for this same reason. It is tinted with the section tone. |
| `NoData` | "no data" inline, dashed underline, reason in the title | the gap of ONE figure. `Empty` is still the one for whole sections. |

## Honesty before completeness

The rule in PRODUCT.md governs any visual decision. No piece accepts a zero
as a substitute for "I don't know": `Gauge` accepts `part=null`, `LimitBar`
accepts `used=null` and `ceiling=null`, and `NoData` exists for the inline
gap. If you are about to pass a `0` that is really a "there is no data", you
are using the wrong piece.

## What this dashboard does NOT do

- **A LOOSE small-caps label over every section.** The AI tic of 2026: a
  small label repeated ten times does not create hierarchy, it makes uniform
  noise. Nuanced in the August seam: the eyebrow is still forbidden **as a
  headline**, but it does exist as the first line of `Section`, above a real
  title and with the section's colour dot. What separates one thing from the
  other is that here the eyebrow never goes alone: if you delete the 19 px
  title and leave the small caps acting as the header, you are back to the tic.
  Mono small caps, on their own, are still for data and seals.
- **Cards inside cards.** Never.
- **Grids of identical cards** when a table says more.
- **Tints on long text, or tints without a reason.** Colour always means
  something: a brand, a section, a state.
- **Decorative motion.** The only things that move on their own: the graph
  while it settles, the `beat` dot of what is alive, and the twinkle of a few
  stars; all three switch off with `prefers-reduced-motion`.

## Motion and accessibility

- 150–250 ms, `ease-out`. The transition communicates a change of state, that is all.
- Hover only under `@media (hover: hover) and (pointer: fine)`.
- Link-card press: `scale(.985)` on `:active`, cancelled with
  `prefers-reduced-motion`.
- Global cyan `:focus-visible`: you navigate with the keyboard or you do not navigate.
- AA contrast on all text: `--text-3` (4.6:1) is the floor. Brand tints do
  not go below it because they are never applied to running text.

## Typography

One family for the interface (`ui-sans-serif`/SF Pro) and **mono for
everything that is data**: figures, paths, schedules, seals. It is not
decorative: it separates what is read from what is checked. Fixed rem scale,
ratio ~1.2, no `clamp()`: it is always viewed on the same laptop.

## The showroom (retired)

There was a temporary page with all the pieces together. It is not part of
this public copy: the real screens have already adopted the pieces.

---

# The final seam (24 August 2026)

Five agents redesigned the five areas separately and each one arrived with its
own dialect. This section is what was unified afterwards, and it is
**normative**: if you are going to add a screen, copy it from here and do not
invent a sixth way.

## One single section header

There were four ways of titling: a mono label, a `/ Title`, a badge with an
`<h2>` next to it and a lower-case title. Now there is one, `Section`, and its
anatomy does not change from screen to screen:

```
· EYEBROW                                             meta on the right
[badge] Section title
The two-line paragraph that says what this is and where it comes from.
```

| part | prop | rule |
|---|---|---|
| eyebrow | `eyebrow` | mono small caps with the dot in the **section tint**. Optional, but it never goes alone. |
| badge | `badge` | only when the section **is** a category (a route in /connections, a scope in /skills). |
| title | `children` | 19 px, `font-light`, `tracking-tight`. Sentence case and **no final full stop**: it is a label, not a sentence. |
| note | `note` | 12 px, `--text-3`, at most two lines. It explains the figure, it does not repeat it. |
| meta | `meta` | it goes on the **title line**, not at the foot of the block. A string is wrapped in `.label` on its own; anything else is painted as is (a `Badge`, a `Capsule`, the ROI box). If you pass JSX and want the label look, add the `<span className="label">` yourself. |

`Section` accepts `level` for compatibility with the old calls and ignores it.
There are not two header sizes: there is one.

**`Label` is no longer a header.** It used to forward to `Section` and that is
why the labels inside a card came out at 15 px, competing with the title of the
section that contained them. Now it is what it says it is: the small mono tag
INSIDE a card ("by day", "by model", "what you have set up"). The rule is about
place, not taste:

- is it inside a `Card`/`Panel`? → `Label`.
- does it head a whole `<section>`? → `Section`.

## The five section colour families

`SECTION_TONE` is not nine loose colours: it is five families, and the
sections that tell the same story share a tint **on purpose**.

| family | colour | sections |
|---|---|---|
| cyan | `#22D3EE` | home · connections |
| amber | `#FBBF24` | money, **and only money** |
| blue | `#38BDF8` | tools · activity |
| aquamarine | `#5EEAD4` | skills · inventory |
| green | `#34D399` | memory |
| violet | `#A78BFA` | review |

`skills` used to be amber, which in this house means money: it read as a
third spend screen and dragged the whole of /skills into the reference's gold,
which is exactly what we wanted to avoid. Skills is a catalogue of what you
have, just like inventory, and now it shows. **Before giving a section a new
colour, check whether it fits a family that already exists.**

## The sidebar is the colour legend

The active entry fills with the tint of **its** section, not a fixed cyan, so
the sidebar teaches the colour code without spending a line explaining it: you
go into Memory and the pill is green, the same green as the hero you are
looking at. The order of the list is that of the families, so going down the
sidebar walks the scale.

The two machines (`Assistant`) fill the same way, with their brand colour
(gold for Hermes, pink for OpenClaw). Before, their only "you are here" sign
was a border one shade lighter, invisible next to the nine filled pills, and
on `/machines/…` the sidebar seemed to have no active item at all.

Text of the active pill: `#080C10`. The six tints are light, so the contrast is
more than enough on all six.

## The header always has the same height

`Header` is **a 54 px row that does not wrap**. With `flex-wrap` it measured
52 px on `/` and on `/review` but 78 px on the routes with long names
(`/connections`, `/tools`, `/machines/…`), so each screen's hero started at a
different height: the most visible seam of the ten when going through them in a row.

What does not fit steps back in reverse order of importance, never pushing a
second line:

| element | from |
|---|---|
| index freshness | always: it is the antidote to showing yesterday's numbers |
| search | always |
| streak | `xl` |
| date range | `2xl` |

## The heroes

The nine screens with a hero use `Hero` (or `CatalogHero` on top of it). None
is laid out by hand: `Hero` redefines `--amber` with the section tint inside
the card, and the tinted brackets come from there. The review's was the only
one built by hand, and that is why its brackets came out cyan over a violet hero.

The hero's eyebrow is a `Badge` in the section colour, with the `meta` in
`.label` next to it. Always that pair, in that order.

## Next's disc

`devIndicators: false` in `next.config.ts`. The dashboard is never deployed and
it is used daily locally, so the indicator in the bottom-left corner is not a
passing annoyance: it is permanent, and it lands right on top of the sidebar's
footer, covering its privacy notice on every route. If anyone ever sees it covered again, this was reverted.
