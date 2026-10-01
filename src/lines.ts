/**
 * Every line the terminal serves, in one place.
 *
 * The mint addresses live here and nowhere else. Both lines currently ride
 * the same token; if Seat Railway moves to its own, change its `mint` below
 * and nothing else.
 */

export interface World {
  /** Lowest market cap (USD) at which this world is reached. */
  from: number;
  name: string;
  /** Screenshot of the line in this world, under public/. */
  image: string;
}

export interface Line {
  id: 'airlines' | 'railway';
  name: string;
  gate: 'A' | 'B';
  service: string;
  serviceNote: string;
  url: string;
  repo: string;
  logo: string;
  logoAlt: string;
  exterior: string;
  tagline: string;
  pitch: string;
  /** Solana token mint whose market cap drives the line. */
  mint: string;
  /** Lowest world first. */
  worlds: readonly World[];
}

/** The same five worlds above $1M for every line; only the ground below differs. */
function worlds(id: Line['id'], ground: { name: string; image: string }): World[] {
  return [
    { from: 0, ...ground },
    { from: 1_000_000, name: 'Clouds', image: `/img/${id}-2-clouds.jpg` },
    { from: 10_000_000, name: 'Space', image: `/img/${id}-3-space.jpg` },
    { from: 50_000_000, name: 'Moon', image: `/img/${id}-4-moon.jpg` },
    { from: 100_000_000, name: 'Mars', image: `/img/${id}-5-mars.jpg` },
  ];
}

export const LINES: readonly Line[] = [
  {
    id: 'airlines',
    name: 'Seat Airlines',
    gate: 'A',
    service: 'SA350',
    serviceNote: 'Nonstop',
    url: 'https://seat-airlines.space',
    repo: 'https://github.com/DOGECOIN87/Seat-Airlines',
    logo: '/seat-airlines-logo.png',
    logoAlt: 'Seat Airlines logo',
    exterior: '/img/airlines-exterior.jpg',
    tagline: 'Hold more. Fly higher.',
    pitch:
      'A 3D airliner flown by its market cap — the 178 biggest holders get seats in rank order, and every seat is a billboard.',
    mint: 'AWJCyg9PrMtYju9yaQmdQLcwrGobHMTv9JU3mo4upump',
    worlds: worlds('airlines', { name: 'In the weather', image: '/img/airlines-1-weather.jpg' }),
  },
  {
    id: 'railway',
    name: 'Seat Railway',
    gate: 'B',
    service: 'SR350',
    serviceNote: 'Express',
    url: 'https://seat-railway.space',
    repo: 'https://github.com/DOGECOIN87/seat-railway',
    logo: '/seat-railway-logo.svg',
    logoAlt: 'Seat Railway logo',
    exterior: '/img/railway-exterior.jpg',
    tagline: 'Hold more. Ride longer.',
    pitch:
      'A 3D train whose length is its market cap — a carriage at every 1-2-5 step, up to 14 carriages at $200M — on a grade set by the five-minute move.',
    mint: 'AWJCyg9PrMtYju9yaQmdQLcwrGobHMTv9JU3mo4upump',
    worlds: worlds('railway', { name: 'In the country', image: '/img/railway-1-country.jpg' }),
  },
];

/** Future lines. Shown greyed out, never linked. */
export const COMING_SOON: readonly { name: string; service: string }[] = [
  { name: 'Seat Cruises', service: 'SC350' },
  { name: 'Seat Rockets', service: 'SX350' },
];
