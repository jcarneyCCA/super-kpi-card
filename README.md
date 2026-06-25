# Super KPI Card — Tableau viz extension

A standardized CCA KPI card you drop onto a worksheet's Marks card. One extension, used many times on a
dashboard — each instance wired to a different metric/data source. Built for Pilot Project's incubator KPI
tracker (and reusable for any client / facility-monitor view).

Each card shows:
- **Title** (config override, else the field name)
- **Hero number** — aggregate of the trailing **4 complete weeks**
- **Comparison** vs the prior 4 weeks — ▲/▼ + change
- **ColumnSpark** — weekly bars + a 4-week rolling-average line on one shared scale

### Sum vs. Average (the $/% switch)
A single setting drives whether the card **sums** the weekly values (dollars, volume, cases, counts) or
**averages** them (efficiency %, yield %, rates). Sum mode shows the comparison as a relative %; Average mode
shows it as percentage **points**. The bars and rolling-average line are identical either way.

> The exact multi-week percentage is a ratio-of-sums, not a simple average of weekly %s — the card uses the
> simple average (good enough for the POC). Feed it the numerator/denominator later if a brand needs the precise figure.

## Files
| File | Role |
|------|------|
| `index.html` | The card. Worksheet mode, settings dialog (`?dialog=1`), and a standalone `?demo=1` preview. |
| `super-kpi-card.trex` | Viz-extension manifest (`<worksheet-extension>`, min-api-version **1.12**). |
| `tokens.js` | CCA colors/fonts/formats — **vendored from `@cca/viz`** (single brand source). |
| `column-spark.js` | The bars+line geometry — **vendored plain-JS port of `@cca/viz/utils/columnSpark.ts`**. |
| `tableau.extensions.1.latest.min.js` | Tableau Extensions API library (vendored locally — the CDN path 404s). |

The colors are **locked to CCA tokens** (no color pickers in the dialog) — that's deliberate: every instance
looks identical so a dashboard of these reads as one system. A dark "facility-monitor" variant can be added later.

## Local dev / verify (no Tableau needed)
```
cd apps/tableau-extensions/super-kpi-card
python -m http.server 8088
```
- Card demo (sample data): http://localhost:8088/index.html?demo=1
- The `?demo=1` mode renders the card core ($ Sum + % Average examples) so the visual can be verified
  without Tableau. The live worksheet data adapter still needs confirmation in **Tableau Desktop** (see below).

## Sideload in Tableau Desktop
Drop a continuous measure (weekly value) onto a worksheet, add a week-grain date, then on the **Marks card →
Add Extension → My Extensions** and pick `super-kpi-card.trex`. The `<source-location>` URL in the `.trex`
must point at where the files are actually served (localhost during dev, GitHub Pages in prod).

## Deploy (GitHub Pages)
- Serve the folder over HTTPS. Use a **versioned path**: `/v1/` is the stable lane client dashboards pin to;
  iterate on `/dev/` so a bad push never breaks live cards. Update `<source-location>` to the real URL.
- **Code updates** at that URL go live to every workbook on next load (no re-add). **Manifest changes**
  (encodings, id, the URL itself, version) require removing + re-adding the extension — so lock those early.
- On Tableau Cloud/Server an admin adds the domain to the safe list **once** (wildcard: `https://<domain>/.*`);
  after that, all future pushes deploy with no admin involvement. Tableau Desktop needs no allowlist.

## Bridge note
`tokens.js` + `column-spark.js` are vendored from `@cca/viz`; the geometry is shared (by copy) with the React
`ColumnSpark` primitive. When chart #2 lands, extract a single shared render-core both consume (the esbuild step
amortizes then). Until then, keep `column-spark.js` in sync with `apps/shared-libs/viz/utils/columnSpark.ts`.

## Needs Tableau-desktop validation
`loadWeeklyValues()` reads `getVisualSpecificationAsync()` + `getSummaryDataAsync()`; those API shapes were
written against the docs and need a real-desktop confirmation. The card math/render/aggregation is verified
independently via `?demo=1`.
