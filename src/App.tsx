import SplitFlapBoard from './SplitFlapBoard';
import { COMING_SOON, LINES, type Line } from './lines';
import {
  EMPTY_QUOTE, carriagesFor, formatCap, formatChange, useQuotes, worldFor, type Feed, type Quote,
} from './market';

const PHRASES = ['SEAT TERMINAL', 'CHOOSE YOUR', 'LINE', 'NOW BOARDING'] as const;
const MINTS = LINES.map((l) => l.mint);

function timeOf(d: Date | null): string {
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}

function host(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Destination as the board prints it, plus the railway's carriage count. */
function destination(line: Line, q: Quote): { world: string; detail: string | null } {
  const world = worldFor(line.worlds, q.marketCap);
  if (!world) return { world: '—', detail: null };
  if (line.id === 'railway') {
    const n = carriagesFor(q.marketCap);
    return { world: world.name, detail: n == null ? null : `${n} carriage${n === 1 ? '' : 's'}` };
  }
  return { world: world.name, detail: null };
}

function Change({ pct }: { pct: number | null }) {
  const dir = pct == null ? '' : pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  return (
    <span className={`change ${dir}`}>
      {formatChange(pct)}
      <span className="change__window"> 5m</span>
    </span>
  );
}

function LiveMarker({ feed }: { feed: Feed }) {
  const label =
    feed.status === 'live' ? `Live — market data updated ${timeOf(feed.updatedAt)}`
      : feed.status === 'offline' ? 'Market feed unavailable right now'
        : 'Connecting to live market data';
  return (
    <span className={`live live--${feed.status}`} title={label}>
      <span className="live__dot" aria-hidden="true" />
      Live
      <span className="sr-only">: {label}</span>
    </span>
  );
}

function DeparturesBoard({ feed }: { feed: Feed }) {
  return (
    <section className="section" aria-labelledby="departures-title" id="departures">
      <div className="section__head">
        <h2 id="departures-title" className="section__title">Departures</h2>
        <p className="section__meta mono">
          Updated <time dateTime={feed.updatedAt?.toISOString()}>{timeOf(feed.updatedAt)}</time>
          <span aria-hidden="true"> · </span>refreshes every 30 s
        </p>
      </div>
      <div className="departures">
        <table className="dep" role="table">
          <caption className="sr-only">
            Departures: each Seat line, its service code, its current destination worked out from market cap, its live
            market cap, its status, and a link to its gate.
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">Line</th>
              <th role="columnheader" scope="col">Service</th>
              <th role="columnheader" scope="col">Destination</th>
              <th role="columnheader" scope="col" className="num">Market cap</th>
              <th role="columnheader" scope="col">Status</th>
              <th role="columnheader" scope="col" className="dep__gate-col">Gate</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {LINES.map((line) => {
              const q = feed.quotes[line.mint] ?? EMPTY_QUOTE;
              const dest = destination(line, q);
              return (
                <tr role="row" key={line.id} className={`dep__row dep__row--${line.id}`}>
                  <th scope="row" role="rowheader" className="dep__line">
                    <img src={line.logo} alt="" width="40" height="40" className="dep__logo" />
                    <span>{line.name}</span>
                  </th>
                  <td role="cell" data-label="Service" className="mono">
                    <span>{line.service}<span className="dim"> · {line.serviceNote}</span></span>
                  </td>
                  <td role="cell" data-label="Destination" className="dep__dest">
                    <span>
                      <span className="board-text">{dest.world}</span>
                      {dest.detail && <span className="dim mono"> · {dest.detail}</span>}
                    </span>
                  </td>
                  <td role="cell" data-label="Market cap" className="num mono">
                    <span>
                      <span className="cap">{formatCap(q.marketCap)}</span> <Change pct={q.change5m} />
                    </span>
                  </td>
                  <td role="cell" data-label="Status">
                    <span className="status">Boarding</span>
                  </td>
                  <td role="cell" className="dep__gate">
                    <a className="btn btn--gate" href={line.url} aria-label={`Go to gate ${line.gate}: ${line.name} at ${host(line.url)}`}>
                      <span className="btn__gate mono" aria-hidden="true">{line.gate}</span>
                      Go to gate <span aria-hidden="true">→</span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GateEmbed({ line }: { line: Line }) {
  return (
    <article className={`gate gate--${line.id}`} aria-labelledby={`gate-${line.id}-title`}>
      <div className="gate__top">
        <p className="gate__letter mono">Gate {line.gate}</p>
        <img src={line.logo} alt={line.logoAlt} width="72" height="72" className="gate__logo" />
      </div>
      <h3 id={`gate-${line.id}-title`} className="gate__name">{line.name}</h3>
      <p className="gate__service mono">{line.service} · {line.serviceNote}</p>
      <div className="gate__embed">
        <iframe
          src={line.url}
          title={`${line.name} — live`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          className="gate__iframe"
        />
      </div>
      <a className="btn btn--board" href={line.url} target="_blank" rel="noopener noreferrer">
        Open {host(line.url)} <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function ComingSoon() {
  return (
    <section className="section" aria-labelledby="soon-title">
      <div className="section__head">
        <h2 id="soon-title" className="section__title">Coming soon</h2>
        <p className="section__meta mono">Future services · not yet scheduled</p>
      </div>
      <ul className="soon">
        {COMING_SOON.map((s) => (
          <li key={s.name} className="soon__row">
            <span className="soon__name">{s.name}</span>
            <span className="mono dim">{s.service}</span>
            <span className="soon__status mono">Not yet scheduled</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const feed = useQuotes(MINTS);
  return (
    <>
      <a className="skip" href="#departures">Skip to departures</a>
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Seat Terminal, home">
          <span className="wordmark__seat">SEAT</span> <span className="wordmark__terminal">TERMINAL</span>
        </a>
        <LiveMarker feed={feed} />
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="sr-only">Seat Terminal — choose your line</h1>
          <p className="hero__eyebrow mono">Concourse · all gates open</p>
          <SplitFlapBoard phrases={PHRASES} />
          <p className="hero__lede">
            Two lines, both flown by the market. Hold more and your seat moves up the cabin — or up the train.
            Pick a gate.
          </p>
        </section>

        <DeparturesBoard feed={feed} />

        <section className="section" aria-labelledby="gates-title">
          <div className="section__head">
            <h2 id="gates-title" className="section__title">Gates</h2>
          </div>
          <div className="gates">
            {LINES.map((line) => (
              <GateEmbed key={line.id} line={line} />
            ))}
          </div>
        </section>

        <ComingSoon />
      </main>

      <footer className="footer">
        <p className="footer__title">Seat Terminal — home of the Seat lines</p>
        <ul className="footer__links">
          {LINES.map((l) => (
            <li key={l.id}><a href={l.repo}>{l.name} on GitHub</a></li>
          ))}
        </ul>
        <p className="footer__note">Neither site ever asks your wallet to approve a transaction.</p>
        <p className="footer__fine">
          An independent project. Not affiliated with any real airline, railway operator or the SEAT car brand.
          Market data from Jupiter.
        </p>
      </footer>
    </>
  );
}
