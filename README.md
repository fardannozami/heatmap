# TM Chrono Heatmap — React + Vite

Recreation of the TM Chrono Heatmap UI using the HTML file supplied in this conversation.

## Data provenance

The six period datasets were recovered from the Base64-packed payload embedded in the supplied HTML. The source metadata says:
- Last updated: `2026.10.23 23:56`
- Spread assumption: `3 pip`
- Periods: 3 months, 6 months, 1 year, 2 years, 3 years, 5 years
- Targets: ±50 to ±500 pip

`public/data/heatmap.json` contains recovered source values, not generated/simulated market data. The app does not fetch live prices and does not recalculate probabilities from an external market feed. Treat the values as historical statistics from the supplied file, not a prediction or trading recommendation.

## Requirements

- Node.js 20.19+ or 22.12+ recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`. You can deploy that folder to any static host such as Nginx, Cloudflare Pages, Netlify, or Vercel.

## Included features

- Period selector with the six recovered periods
- 1,440 time rows from `00:00` through `23:59`
- Ten pip target columns
- Direction/probability heatmap with intensity colors
- Search by time and direction filter
- Click any cell to inspect direction, probability, observations, and void count
- Responsive dark dashboard layout

## Notes

This is a frontend recreation of the supplied source. It does not reproduce any original server-side password/access-control behavior. Do not publish any restricted data unless you have permission to do so.

### Additional view from `tmchronoheatmap2`

- Toggle to **Perbandingan periode · ±50 pip** to compare the six historical periods side by side at the ±50 pip target, matching the layout embedded in the newly supplied `Trader Minoritas Chrono Heatmap 2` HTML.
- This view uses the same recovered dataset; it does not add a new live data source.
