import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * A split-flap departure board, re-implemented after the one in Seat Airlines.
 *
 * Each cell is a drum of flaps hinged across its middle. Changing a letter
 * drops the last few flaps before it one after another, so columns land at
 * different moments. Animation runs off refs in one requestAnimationFrame
 * loop — no React render per flap.
 *
 * With prefers-reduced-motion the board does not flip: each phrase simply
 * replaces the last on the same schedule.
 *
 * The board is decorative (aria-hidden). The page carries the real heading.
 */

const DRUM = ` ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-/:()%.,!?&$'`;
const BLANK = 0;
const FLIP_MS = 90;
const FLIPS_MIN = 3;
const FLIPS_MAX = 7;
const STAGGER_MS = 40;
const JITTER_MS = 70;
const SETTLE_MS = 200;
const INTRO_MS = 400;

const UPPER = 0;
const LOWER = 1;
const FALL = 2;
const RISE = 3;

interface Drum {
  glyphs: HTMLElement[];
  printed: number[];
  lower: HTMLElement;
  fall: HTMLElement;
  rise: HTMLElement;
  drawn: 'fall' | 'rise' | null;
  at: number;
  next: number;
  target: number;
  state: 'idle' | 'waiting' | 'turning' | 'settling';
  from: number;
  rate: number;
}

const face = (at: number) => (at === BLANK ? '' : DRUM[at]);

/** A phrase centred in the board's width, one drum position per cell. */
function layout(phrase: string, cols: number): number[] {
  const text = phrase.toUpperCase();
  const left = Math.floor((cols - text.length) / 2);
  return Array.from({ length: cols }, (_, c) => {
    const at = DRUM.indexOf(text[c - left] ?? ' ');
    return at < 0 ? BLANK : at;
  });
}

function print(d: Drum, which: number, at: number) {
  if (d.printed[which] === at) return;
  d.printed[which] = at;
  d.glyphs[which].textContent = face(at);
}

function turn(d: Drum) {
  print(d, UPPER, d.next);
  print(d, LOWER, d.at);
  print(d, FALL, d.at);
  print(d, RISE, d.next);
}

function aim(d: Drum, target: number, when: number) {
  d.target = target;
  const distance = (target - d.at + DRUM.length) % DRUM.length;
  if (distance === 0) return;
  const flips = Math.min(distance, FLIPS_MIN + Math.floor(Math.random() * (FLIPS_MAX - FLIPS_MIN + 1)));
  d.next = (target - flips + 1 + DRUM.length) % DRUM.length;
  d.state = 'waiting';
  d.from = when;
  d.rate = FLIP_MS * (0.9 + Math.random() * 0.2);
}

function draw(d: Drum, which: Drum['drawn']) {
  if (d.drawn === which) return;
  d.drawn = which;
  d.fall.style.visibility = which === 'fall' ? 'visible' : '';
  d.rise.style.visibility = which === 'rise' ? 'visible' : '';
}

function setLeaf(leaf: HTMLElement, degrees: number, shade: number) {
  leaf.style.transform = `rotateX(${degrees.toFixed(2)}deg)`;
  leaf.style.setProperty('--shade', shade.toFixed(3));
}

/** One flip, p of the way through: the flap accelerates as it falls. */
function paint(d: Drum, p: number) {
  const angle = 180 * Math.min(1, p) ** 1.35;
  if (angle < 90) {
    draw(d, 'fall');
    setLeaf(d.fall, -angle, (angle / 90) * 0.5);
  } else {
    draw(d, 'rise');
    setLeaf(d.rise, 180 - angle, ((180 - angle) / 90) * 0.45);
  }
  const cast = angle < 90 ? angle / 90 : (180 - angle) / 90;
  d.lower.style.setProperty('--cast', (cast * 0.3).toFixed(3));
}

function settle(d: Drum, s: number) {
  const lift = 14 * Math.sin(Math.PI * s) * (1 - s);
  draw(d, 'rise');
  setLeaf(d.rise, lift, (lift / 90) * 0.45);
  d.lower.style.removeProperty('--cast');
}

function rest(d: Drum) {
  d.state = 'idle';
  draw(d, null);
  d.lower.style.removeProperty('--cast');
  print(d, UPPER, d.at);
  print(d, LOWER, d.at);
}

const Flap = ({ at }: { at: number }) => (
  <span className="flap">
    <span className="flap__half flap__half--upper"><span className="flap__glyph">{face(at)}</span></span>
    <span className="flap__half flap__half--lower"><span className="flap__glyph">{face(at)}</span></span>
    <span className="flap__half flap__half--upper flap__leaf"><span className="flap__glyph" /></span>
    <span className="flap__half flap__half--lower flap__leaf"><span className="flap__glyph" /></span>
  </span>
);

const prefersStill = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  phrases: readonly string[];
  /** Ms each phrase stays up once landed. */
  hold?: number;
}

const SplitFlapBoard = memo(function SplitFlapBoard({ phrases, hold = 2600 }: Props) {
  const board = useRef<HTMLDivElement>(null);
  const [still] = useState(prefersStill);
  const cols = Math.max(1, ...phrases.map((p) => p.length));
  const [opening] = useState(() =>
    still ? layout(phrases[0] ?? '', cols) : new Array<number>(cols).fill(BLANK),
  );

  useEffect(() => {
    const host = board.current;
    if (!host || !phrases.length) return;

    const drums = Array.from(host.querySelectorAll<HTMLElement>('.flap'), (root): Drum => {
      const glyphs = Array.from(root.querySelectorAll<HTMLElement>('.flap__glyph'));
      const halves = root.querySelectorAll<HTMLElement>('.flap__half');
      const at = Math.max(BLANK, DRUM.indexOf(glyphs[UPPER].textContent || ' '));
      return {
        glyphs, lower: halves[1], fall: halves[2], rise: halves[3], at,
        printed: [at, at, -1, -1], drawn: null,
        next: at, target: at, state: 'idle', from: 0, rate: FLIP_MS,
      };
    });

    let shown = still ? 0 : -1;
    let raf = 0;
    let timer = 0;
    let onScreen = !('IntersectionObserver' in window);

    // The opening phrase ("SEAT TERMINAL") holds longest.
    const holdFor = (i: number) => (i === 0 ? hold * 1.6 : hold);

    const queue = (wait: number) => {
      window.clearTimeout(timer);
      timer = 0;
      if (!onScreen || document.hidden) return;
      timer = window.setTimeout(() => {
        timer = 0;
        show((shown + 1) % phrases.length);
      }, wait);
    };

    const frame = (now: number) => {
      raf = 0;
      let moving = false;
      for (const d of drums) {
        if (d.state === 'waiting') {
          if (now < d.from) {
            moving = true;
            continue;
          }
          d.state = 'turning';
          turn(d);
        }
        if (d.state === 'turning') {
          while (now - d.from >= d.rate) {
            d.from += d.rate;
            d.at = d.next;
            if (d.at === d.target) {
              d.state = 'settling';
              print(d, UPPER, d.at);
              print(d, LOWER, d.at);
              print(d, RISE, d.at);
              break;
            }
            d.next = (d.at + 1) % DRUM.length;
          }
          if (d.state === 'turning') {
            turn(d);
            paint(d, (now - d.from) / d.rate);
          }
        }
        if (d.state === 'settling') {
          const s = (now - d.from) / SETTLE_MS;
          if (s >= 1) rest(d);
          else settle(d, s);
        }
        if (d.state !== 'idle') moving = true;
      }
      if (moving) raf = requestAnimationFrame(frame);
      else queue(holdFor(shown));
    };

    function show(index: number) {
      shown = index;
      const cells = layout(phrases[index], cols);
      if (still) {
        drums.forEach((d, k) => {
          d.at = d.next = d.target = cells[k];
          rest(d);
        });
        queue(holdFor(index));
        return;
      }
      const start = performance.now();
      drums.forEach((d, k) => {
        if (d.state !== 'idle') {
          d.target = cells[k];
          return;
        }
        aim(d, cells[k], start + k * STAGGER_MS + Math.random() * JITTER_MS);
      });
      if (!raf) raf = requestAnimationFrame(frame);
    }

    const wake = () => {
      if (raf || timer) return;
      queue(shown < 0 ? INTRO_MS : holdFor(shown));
    };
    const sleep = () => {
      window.clearTimeout(timer);
      timer = 0;
    };

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) wake();
        else sleep();
      })
      : null;
    observer?.observe(host);
    const onVisibility = () => (document.hidden ? sleep() : wake());
    document.addEventListener('visibilitychange', onVisibility);
    if (!observer) wake();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      for (const d of drums) rest(d);
    };
  }, [still, phrases, cols, hold]);

  return (
    <div ref={board} className="board" aria-hidden="true" style={{ '--cols': cols } as CSSProperties}>
      <div className="board__housing">
        <div className="board__row">
          {opening.map((at, c) => <Flap key={c} at={at} />)}
        </div>
      </div>
    </div>
  );
});

export default SplitFlapBoard;
