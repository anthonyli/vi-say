// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Reusable comic-brick motion vocabulary. Every value is a pure function of
// time, so HTML previews, parallel render workers and seeking stay identical.

export const COMIC_PALETTE = Object.freeze({
  ink: '#18233c', yellow: '#ffdb42', blue: '#72ccf0', red: '#ff775f',
  cream: '#fffbef', purple: '#bda6f4', white: '#ffffff',
});

/** Fixed timing for the series. Episodes change content, not these defaults. */
export const COMIC_MOTION = Object.freeze({
  slam: .42, pop: .5, drop: .62, marker: .55, stagger: .14,
  push: Object.freeze({from: 1, to: 1.045}),
  shake: Object.freeze({amplitude: 7, seconds: .28}),
  idle: Object.freeze({degrees: .8, period: 3.6}),
});

/** Layout constants keep the 1920x1080 frame clear of captions and the dragon. */
export const COMIC_LAYOUT = Object.freeze({
  captionTop: 880,
  media: Object.freeze([70, 178, 1300, 664]),
  mediaWide: Object.freeze([70, 178, 1780, 664]),
  heroTitle: Object.freeze([100, 210, 900, 420]),
  sideBubble: Object.freeze([1395, 170, 470, 150]),
  character: Object.freeze({
    hero: Object.freeze({left: 1060, top: 150, width: 720, height: 740}),
    side: Object.freeze({left: 1430, top: 360, width: 420, height: 500}),
  }),
});

/**
 * Comic transitions suited to a bright, outlined palette. Shaders that fill the
 * frame with black (burn, glitch, reflection floors) are excluded, and any
 * background colour exposed by a shader matches the comic palette.
 */
export const COMIC_TRANSITION_POOL = Object.freeze([
  'gl:BookFlip', 'gl:GridFlip', 'gl:CrossZoom', 'gl:PolkaDotsCurtain',
  'gl:CircleIris', 'gl:StarWipe', 'slide', 'wipe',
]);
const rgba = hex => [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) / 255 * 1000) / 1000).concat(1);
export const COMIC_TRANSITION_PARAMS = Object.freeze({
  'gl:GridFlip': Object.freeze({bgcolor: rgba(COMIC_PALETTE.ink), size: [5, 3], dividerWidth: .03}),
  'gl:CrossZoom': Object.freeze({strength: .22}),
  'gl:CircleIris': Object.freeze({backColor: rgba(COMIC_PALETTE.yellow)}),
  'gl:StarWipe': Object.freeze({border_color: rgba(COMIC_PALETTE.ink), border_thickness: .012}),
  'gl:PolkaDotsCurtain': Object.freeze({dots: 16}),
});
/** The interaction outro enters the same way in every comic route. */
export const COMIC_OUTRO_TRANSITION = 'gl:GridFlip';

export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const lerp = (a, b, p) => a + (b - a) * p;
export const easeOutCubic = value => 1 - (1 - clamp(value)) ** 3;
export const easeInOut = value => {const p = clamp(value); return p * p * p * (10 + p * (-15 + 6 * p));};
export const easeOutBack = (value, overshoot = 1.70158) => {
  const p = clamp(value) - 1;
  return 1 + (overshoot + 1) * p ** 3 + overshoot * p ** 2;
};

/** Title punch: oversized, slightly overshoots below 1, then rests at 1. */
export function slam(time, at = 0, seconds = COMIC_MOTION.slam) {
  if (time < at) return {opacity: 0, scale: 1.32, rotate: -3};
  const p = clamp((time - at) / seconds);
  if (p >= 1) return {opacity: 1, scale: 1, rotate: 0};
  return {opacity: clamp(p * 3), scale: lerp(1.32, 1, easeOutBack(p, 2.2)), rotate: lerp(-3, 0, easeOutCubic(p))};
}

/** Bubble or sticker pop with a damped spring that lands exactly on 1. */
export function popIn(time, at = 0, seconds = COMIC_MOTION.pop) {
  if (time < at) return {opacity: 0, scale: 0};
  const p = clamp((time - at) / seconds);
  if (p >= 1) return {opacity: 1, scale: 1};
  return {opacity: clamp(p * 4), scale: 1 - Math.exp(-6 * p) * Math.cos(9 * p) * (1 - p)};
}

/**
 * A brick falls with gravity, squashes on contact and bounces once.
 * `impact` is a 0..1 pulse right after contact for bursts and camera shake.
 */
export function dropLand(time, at = 0, {seconds = COMIC_MOTION.drop, height = 850} = {}) {
  if (time < at) return {visible: false, y: -height, scaleX: 1, scaleY: 1, impact: 0, landed: false};
  const t = time - at, fall = seconds * .62;
  if (t < fall) {
    const p = t / fall;
    return {visible: true, y: -height * (1 - p * p), scaleX: 1, scaleY: 1 + .05 * p, impact: 0, landed: false};
  }
  const b = clamp((t - fall) / (seconds - fall));
  const squash = .13 * Math.exp(-(((t - fall) / .07) ** 2));
  const scaleY = 1 - squash;
  return {visible: true, y: b >= 1 ? 0 : -Math.sin(Math.PI * b) * 22 * (1 - b), scaleX: 1 / Math.sqrt(scaleY), scaleY,
    impact: clamp(1 - (t - fall) / .38), landed: true};
}

/** Decaying camera shake after an impact; zero outside its window. */
export function shake(time, at = 0, {amplitude = COMIC_MOTION.shake.amplitude, seconds = COMIC_MOTION.shake.seconds} = {}) {
  const t = time - at;
  if (t < 0 || t >= seconds) return {x: 0, y: 0};
  const decay = 1 - t / seconds;
  return {x: Math.sin(t * 95) * amplitude * decay, y: Math.cos(t * 71) * amplitude * .6 * decay};
}

/** Combine the shakes of several impacts (e.g. stacked bricks) into one offset. */
export function shakeAll(time, impacts, options) {
  return impacts.reduce((sum, at) => {const s = shake(time, at, options); return {x: sum.x + s.x, y: sum.y + s.y};}, {x: 0, y: 0});
}

/** Highlighter sweep progress for a marked title phrase. */
export const markerSweep = (time, at = 0, seconds = COMIC_MOTION.marker) => easeInOut((time - at) / seconds);

/** Slow push on screenshots so long demo holds never look frozen. */
export function push(time, duration, {from = COMIC_MOTION.push.from, to = COMIC_MOTION.push.to} = {}) {
  return lerp(from, to, easeInOut(time / Math.max(duration, .001)));
}

/** Gentle idle rotation for bubbles and stickers after they have settled. */
export function idle(time, phase = 0, {degrees = COMIC_MOTION.idle.degrees, period = COMIC_MOTION.idle.period} = {}) {
  return Math.sin((time + phase) * 2 * Math.PI / period) * degrees;
}

export const stagger = (index, at = 0, step = COMIC_MOTION.stagger) => at + index * step;

/** Approximate rendered width: CJK and full-width glyphs are 1em, Latin about .56em. */
export function textUnits(text) {
  let units = 0;
  for (const char of String(text)) units += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/.test(char) ? 1 : char === ' ' ? .3 : .56;
  return units;
}

/**
 * Largest font size in [min, max] whose wrapped text fits the box. Explicit
 * newlines are respected. Throws when even the minimum size overflows, so a
 * layout problem fails at validation rather than appearing in the final video.
 */
export function fitFont(text, {width, height, max, min, lineHeight = 1.2}) {
  const lines = String(text).split('\n');
  for (let size = max; size >= min; size -= 2) {
    const rows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(textUnits(line) * size / width)), 0);
    if (rows * size * lineHeight <= height) return size;
  }
  throw new Error(`comic: text does not fit ${width}x${height} at ${min}px: ${text}`);
}

// ---------------------------------------------------------------------------
// Speech-cued effect motion: breathing, exits, sequential cards, spotlight,
// sketching, typing and stamping. Shared by the comic and glass surfaces.

/** Gentle breathing scale once an element has settled. */
export function breathe(time, at = 0, {amount = .014, period = 2.4} = {}) {
  return time < at ? 1 : 1 + amount * Math.sin(2 * Math.PI * (time - at) / period);
}

/** 1 while visible, easing to 0 over `seconds` before `endAt`; 1 when no ending is set. */
export function exitProgress(time, endAt, seconds = .35) {
  return endAt === undefined ? 1 : easeInOut((endAt - time) / seconds);
}

/** Visual transform for a named exit at exit progress q (1 shown, 0 gone). */
export function exitStyle(kind, q) {
  if (!kind || kind === 'none' || q >= 1) return {opacity: 1, scaleX: 1, scaleY: 1, y: 0};
  if (kind === 'shrink') return {opacity: q, scaleX: .55 + .45 * q, scaleY: .55 + .45 * q, y: 0};
  if (kind === 'collapse') return {opacity: Math.min(1, q * 1.6), scaleX: 1, scaleY: Math.max(.02, q), y: 0};
  if (kind === 'fly') return {opacity: q, scaleX: 1, scaleY: 1, y: -(1 - q) * 60};
  return {opacity: q, scaleX: 1, scaleY: 1, y: 0};
}

/**
 * State of a speech-cued card sequence. Each item enters at `at`; when the
 * next one enters, the previous collapses over `collapse` seconds.
 */
export function cueState(items, time, {collapse = .45} = {}) {
  let active = -1;
  const states = items.map((item, i) => {
    const visible = time >= item.at;
    if (visible) active = i;
    const next = items[i + 1];
    const folded = next && time >= next.at ? easeInOut((time - next.at) / collapse) : 0;
    return {visible, enter: popIn(time, item.at), collapse: folded,
      breathing: visible && folded === 0 ? breathe(time, item.at + COMIC_MOTION.pop) : 1};
  });
  return {active, states};
}

/** Interpolated spotlight region between ordered events, with a breathing ring. */
export function spotlightAt(events, time, seconds = .45) {
  const index = events.findLastIndex(e => e.at <= time);
  if (index < 0) return null;
  const current = events[index], previous = events[index - 1] ?? current;
  const q = index === 0 ? 1 : easeInOut((time - current.at) / seconds);
  const region = current.region.map((v, i) => lerp(previous.region[i], v, q));
  return {index, region, opacity: index === 0 ? easeInOut((time - current.at) / seconds) : 1,
    ring: breathe(time, current.at, {amount: .04, period: 1.6}), label: q > .8 ? current.label : undefined};
}

/** Progress of a hand-drawn stroke (0..1). */
export const drawProgress = (time, at = 0, seconds = .6) => easeInOut((time - at) / seconds);

/** Characters typed so far; `seconds` defaults to a natural 16 characters per second. */
export function typedCount(text, time, at = 0, seconds) {
  const length = [...String(text)].length;
  const duration = seconds ?? Math.max(.4, length / 16);
  return Math.floor(length * clamp((time - at) / duration));
}

/** Stamp slam: falls from 2.4x, overshoots, then rests at the authored angle. */
export function stampIn(time, at = 0, angle = -12, seconds = .32) {
  if (time < at) return {opacity: 0, scale: 2.4, rotate: angle - 14};
  const p = clamp((time - at) / seconds);
  if (p >= 1) return {opacity: 1, scale: 1, rotate: angle};
  return {opacity: clamp(p * 2.5), scale: lerp(2.4, 1, easeOutBack(p, 1.4)), rotate: lerp(angle - 14, angle, easeOutCubic(p))};
}
