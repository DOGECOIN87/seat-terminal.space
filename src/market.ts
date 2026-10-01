/**
 * Live market data, read in the browser from Jupiter's keyless token API —
 * the same endpoint both lines fly on (see src/lib/marketFeed.ts in either
 * line's repo).
 *
 * One request per distinct mint per refresh, however many lines share it.
 * Fields are read by name, at any depth, so a reshuffle of the response's
 * nesting does not blank the board. Anything missing or invalid leaves the
 * previous reading in place; nothing here throws into React.
 */

import { useEffect, useState } from 'react';

export interface Quote {
  /** USD market cap, or null when unknown. */
  marketCap: number | null;
  /** Price change over the last five minutes, in percent, or null. */
  change5m: number | null;
}

export const EMPTY_QUOTE: Quote = { marketCap: null, change5m: null };

const REFRESH_MS = 30_000;
/** After a 429, wait longer before asking again. */
const BACKOFF_MS = 90_000;

export function marketUrl(mint: string): string {
  return `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`;
}

type Json = unknown;

function* breadthFirst(root: Json): Generator<Record<string, unknown>> {
  const queue: Json[] = [root];
  let guard = 0;
  while (queue.length && guard++ < 5000) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!node || typeof node !== 'object') continue;
    const obj = node as Record<string, unknown>;
    yield obj;
    queue.push(...Object.values(obj));
  }
}

function findNumber(root: Json, keys: readonly string[]): number | null {
  for (const obj of breadthFirst(root)) {
    for (const key of keys) {
      const v = obj[key];
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n === 'number' && Number.isFinite(n)) return n;
    }
  }
  return null;
}

function findObject(root: Json, keys: readonly string[]): Json | null {
  for (const obj of breadthFirst(root)) {
    for (const key of keys) {
      const v = obj[key];
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    }
  }
  return null;
}

/** The five-minute window is found first, so another window's priceChange is never read by mistake. */
function readChange(body: Json): number | null {
  const window = findObject(body, ['stats5m', 'stats_5m', 'm5', '5m']);
  if (window) {
    const inside = findNumber(window, ['priceChange', 'price_change', 'change', 'priceChangePercentage']);
    if (inside !== null) return inside;
  }
  return findNumber(body, ['priceChange5m', 'price_change_5m', 'change5m']);
}

export function readQuote(json: Json, mint: string, previous: Quote): Quote {
  // A search answers with a list; prefer the entry for this exact mint.
  const own = Array.isArray(json)
    ? json.find((t) => !!t && typeof t === 'object' && (t as { id?: unknown }).id === mint)
    : undefined;
  const body = own ?? json;
  const marketCap = findNumber(body, ['mcap', 'marketCap', 'market_cap', 'fdv']);
  const change5m = readChange(body);
  return {
    // Zero is a parse failure, not a valuation.
    marketCap: marketCap && marketCap > 0 ? marketCap : previous.marketCap,
    change5m: change5m ?? previous.change5m,
  };
}

/**
 * Quotes for every mint, refreshed every 30 s while the tab is visible.
 * Returns a map from mint to its latest quote.
 */
export interface Feed {
  quotes: Record<string, Quote>;
  /** When the last successful reading arrived, or null. */
  updatedAt: Date | null;
  /** 'live' once a reading has arrived and the latest refresh succeeded. */
  status: 'connecting' | 'live' | 'offline';
}

export function useQuotes(mints: readonly string[]): Feed {
  const key = [...new Set(mints)].sort().join(',');
  const [feed, setFeed] = useState<Feed>({ quotes: {}, updatedAt: null, status: 'connecting' });

  useEffect(() => {
    const unique = key ? key.split(',') : [];
    if (!unique.length) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let latest: Record<string, Quote> = {};
    let alive = true;

    const fetchOne = async (mint: string, signal: AbortSignal): Promise<'ok' | 'limited' | 'failed'> => {
      try {
        const res = await fetch(marketUrl(mint), { headers: { accept: 'application/json' }, signal });
        if (res.status === 429) return 'limited';
        if (!res.ok) return 'failed';
        const json: Json = await res.json();
        latest = { ...latest, [mint]: readQuote(json, mint, latest[mint] ?? EMPTY_QUOTE) };
        return 'ok';
      } catch {
        // Offline, blocked, aborted or malformed: hold the last reading.
        return 'failed';
      }
    };

    const poll = async () => {
      if (!alive || document.visibilityState === 'hidden') return;
      controller?.abort();
      controller = new AbortController();
      const results = await Promise.all(unique.map((m) => fetchOne(m, controller!.signal)));
      if (!alive) return;
      const anyOk = results.includes('ok');
      setFeed((prev) => ({
        quotes: latest,
        updatedAt: anyOk ? new Date() : prev.updatedAt,
        status: anyOk ? 'live' : 'offline',
      }));
      const wait = results.includes('limited') ? BACKOFF_MS : REFRESH_MS;
      if (document.visibilityState === 'visible') timer = setTimeout(poll, wait);
    };

    const halt = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      controller?.abort();
    };

    const onVisibility = () => {
      halt();
      if (document.visibilityState === 'visible') void poll();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void poll();
    return () => {
      alive = false;
      halt();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [key]);

  return feed;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

/** $950, $163K, $2.40M, $1.20B. Unknown is an em dash. */
export function formatCap(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** +1.2% / −0.4%. Unknown is an em dash. */
export function formatChange(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '±';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** The world a line is in at a given market cap, or null if unknown. */
export function worldFor<W extends { from: number }>(worlds: readonly W[], cap: number | null): W | null {
  if (cap == null) return null;
  let current: W | null = null;
  for (const w of worlds) if (cap >= w.from) current = w;
  return current;
}

/** Seat Railway's consist: a carriage at every 1-2-5 step from $10K, up to 14 at $200M. */
const CARRIAGE_STEPS: readonly number[] = (() => {
  const steps: number[] = [];
  for (let decade = 10_000; steps.length < 14; decade *= 10) {
    for (const m of [1, 2, 5]) if (steps.length < 14) steps.push(decade * m);
  }
  return steps;
})();

export function carriagesFor(cap: number | null): number | null {
  if (cap == null) return null;
  let n = 0;
  while (n < CARRIAGE_STEPS.length && cap >= CARRIAGE_STEPS[n]) n++;
  return n;
}
