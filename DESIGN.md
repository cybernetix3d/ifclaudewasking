# Design rules

These are the house rules for ifclaudewasking.com. Anyone changing the site, person or model, follows them. If a rule is wrong, change the rule here first, in its own commit, and say why.

## What the site is for

A reader should be able to do three things, in this order:

1. Read what the model said it would do, exactly as it said it.
2. See what it expects to happen to the world with and without that plan.
3. Check, later, how right it was.

Anything that does not serve one of those is decoration and comes out.

## The idea

**A plan drawn as a blueprint.** Blueprints are how people draw things they intend to build. The model is drafting a year it will never get to run.

- Light mode is a whiteprint: pale paper, Prussian-blue ink. Dark mode is a true blueprint: blue ground, pale lines. Both are first-class.
- A faint drafting grid sits behind everything.
- The signature is the **dimension line**: day 1 to day 365, then a dashed run-out to day 366.

## Honesty rules (these outrank every visual rule)

1. **Never restyle the model's words into something they are not.** No pull quotes that drop context, no bolding inside its text, no truncation without a link to the whole.
2. **Three kinds of number, three looks. Never blur them.**
   - *Published figures* (measured by someone): solid, dark.
   - *Forecasts for the world as it is* (checkable later): solid, grey-blue.
   - *Forecasts with the plan* (never checkable): dashed, accent blue, and labelled as such wherever they appear.
3. **Dashed means not real.** The day-366 run-out and the with-plan line are dashed. Nothing real is ever dashed.
4. **Unverified figures stay visibly unverified**: ochre ground and an "Unverified" tag, everywhere the figure appears, including tables and charts.
5. **A chart never implies precision it does not have.** Forecasts show their 80% range. Axes are not truncated to exaggerate a gap unless the range itself is drawn.
6. **Say what cannot be known** next to the thing, not on another page. The with-plan forecast always carries "cannot be checked".
7. Model output and public measurements are never mixed in one series. The monthly measurements are labelled as untouched by any model.

## Colour

Tokens live in `src/styles/global.css`. Use the tokens; do not introduce new hex values in components.

| Token | Role |
| --- | --- |
| `--paper`, `--sheet` | page ground, raised drawing sheet |
| `--ink`, `--ink-2` | text and real lines; secondary text and baseline forecasts |
| `--line`, `--line-strong` | grid and rules |
| `--mark`, `--mark-soft` | the accent: links, the plan, "today" |
| `--flag`, `--flag-soft` | unverified, contested, and "what really happened" |
| `--add`, `--drop` (+ soft) | better / worse, added / dropped |

- Colour always has a second signal (dash, shape, label). The site must read in greyscale.
- No coloured stripes on the edges of cards or panels. Use a tonal surface or a tag.
- No gradients, no shadows, no glow.

## Type

- **Archivo** (variable width) for anything structural: headings, labels, figures. Expanded widths for big headings, like drafting lettering. **Literata** for reading text.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings.
- Figures use tabular lining numerals.
- Body measure stays under 42rem. Charts and the dimension line may break out to the page width; text never does.
- A heading says what the section is, in plain words. No label above a heading that repeats it.

## Layout

- Lists of like things are registers and schedules (ruled rows), not grids of cards.
- A `sheet` (tonal panel) is for a short aside or a single total. At most one or two per page.
- Radius is 3px or none. Nothing is pill-shaped.
- Works at 375px wide with no sideways scroll outside tables. Tag rows wrap.

## Motion

Things on this site move for one of two reasons:

1. **Because the world moved.** The day marker advances daily. Monthly measurements refresh weekly. Forecast charts gain a real point when a figure is published. This is the motion that matters; protect it.
2. **To show how a chart is read.** A chart draws once, left to right, when it first scrolls into view. The dimension line draws once on load.

Nothing else animates. No hover effects on blocks, no parallax, no looping animation, no counting-up numbers. Everything respects `prefers-reduced-motion`, and every chart is fully visible with JavaScript off.

## Charts

- Built as SVG at build time. No chart library, no client-side data fetching.
- Every chart has a text equivalent directly beneath it with the same numbers.
- Every chart has an `aria-label` that states its main finding in a sentence.
- One idea per chart. Small multiples beat one crowded chart.
- Label lines directly; a key is only for the first chart in a set.
- Time runs left to right. Older forecasts fade; they are never deleted.

## Words

- Plain words, sentence case, active voice. Name things by what a reader sees: "Plan vs reality", not "Scorecard module".
- No em dashes, no middle-dot separators, no arrows in link text.
- The site's own voice never praises the model or the plan. It describes.
- The footer disclaimer appears on every page, unchanged.

## How to make it better

When asked to improve the site, work down this list and stop at the first thing that is wrong. Do not skip ahead to polish.

1. Is anything false, misleading, or more certain-looking than it is? Fix that first.
2. Can a first-time reader tell, within ten seconds, what this is and whether the numbers are real?
3. Does every number say where it came from and what kind of number it is?
4. Does it work on a phone, in both themes, with a keyboard, with motion off?
5. Is there anything on the page that could be removed without losing meaning? Remove it.
6. Only now: spacing, rhythm, type, the craft of the charts.

Then check the result in a browser in both themes and at phone width before committing. A change that adds a new visual device must retire one.

## What never changes

- `prompt/king.md` and `prompt/forecast.md`. Their hashes are recorded on every file they produce.
- Published editions and forecasts. A wrong forecast stays up, marked wrong. That is the point.
