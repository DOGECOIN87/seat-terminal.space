# Seat Terminal

**https://seat-terminal.space** — the concourse for the Seat lines. Choose your line:

| Gate | Line | Service | Site |
| --- | --- | --- | --- |
| A | Seat Airlines — *Hold more. Fly higher.* | SA350 · Nonstop | https://seat-airlines.space |
| B | Seat Railway — *Hold more. Ride longer.* | SR350 · Express | https://seat-railway.space |

A small static page: a split-flap hero board, a live departures board, a gate card per line and a "coming soon" row. It only links to the lines; neither line's code lives here.

## Live data

Market cap and 5-minute move come straight from Jupiter's keyless token API (`https://api.jup.ag/tokens/v2/search`), fetched in the browser every 30 s and paused while the tab is hidden. If the API fails, figures show "—".

**Mint addresses live in one place: [`src/lines.ts`](src/lines.ts).** To move Seat Railway to its own token, change its `mint` there and nothing else.

Destination comes from market cap: under $1M "In the weather" (Airlines) / "In the country" (Railway), $1M Clouds, $10M Space, $50M Moon, $100M Mars.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173 (the CSP is stripped in dev only)
npm run build    # type-check + build to dist/
npm run preview  # serve dist/ with the production CSP
```

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to GitHub Pages. `public/CNAME` sets the custom domain.

---

An independent project. Not affiliated with any real airline, railway operator or the SEAT car brand. Neither Seat site ever asks your wallet to approve a transaction.
