// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// One deterministic layout for every comic scene kind. The renderer and the
// validator both call it, so text overflow fails before any frame is rendered.
import {COMIC_LAYOUT as L, COMIC_PALETTE as C, fitFont} from './effects/comic-motion.mjs';

export const COMIC_TONES = Object.freeze({
  yellow: C.yellow, blue: C.blue, cream: C.cream, purple: C.purple, red: C.red, white: C.white,
});
const DEFAULT_TONE = Object.freeze({hero: 'yellow', demo: 'cream', steps: 'blue', stage: 'cream', cta: 'yellow'});
const fail = message => {throw new Error(`comic: ${message}`);};

/** Marker colour that stays visible on each scene background. */
export const markerColor = tone => (tone === 'yellow' ? C.white : C.yellow);

export function comicLayout(scene, {character = true} = {}) {
  const tone = scene.tone ?? DEFAULT_TONE[scene.kind];
  if (!Object.hasOwn(COMIC_TONES, tone)) fail(`unsupported tone ${tone}`);
  const layout = {tone, background: COMIC_TONES[tone], marker: markerColor(tone)};
  if (scene.kind === 'hero') {
    const [x, y, w, h] = L.heroTitle;
    const width = character ? w : 1500;
    layout.title = {x, y, w: width, h, fontSize: fitFont(scene.title, {width, height: h, max: 118, min: 64, lineHeight: 1.18})};
    if (scene.subtitle) {
      const box = {x, y: 668, w: character ? 860 : 1500, h: 150};
      layout.subtitle = {...box, fontSize: fitFont(scene.subtitle, {width: box.w - 64, height: box.h - 40, max: 46, min: 28, lineHeight: 1.3})};
    }
    return layout;
  }
  if (scene.kind === 'cta' && scene.outroId) return {...layout, outro: true};
  const titleWidth = 1300;
  layout.header = {x: 70, y: 40, w: titleWidth, h: 104,
    fontSize: fitFont(scene.title, {width: titleWidth - 40, height: 96, max: 62, min: 40, lineHeight: 1.15})};
  if (scene.kind === 'demo' || scene.kind === 'stage') {
    const box = scene.mediaBox ?? (character ? L.media : [70, 200, 1780, 650]);
    layout.media = [...box];
    if (scene.subtitle && character) {
      const [bx, by, bw, bh] = L.sideBubble;
      layout.bubble = {x: bx, y: by, w: bw, h: bh, tail: 'left',
        fontSize: fitFont(scene.subtitle, {width: bw - 52, height: bh - 34, max: 40, min: 26, lineHeight: 1.3})};
    } else if (scene.subtitle) {
      layout.subtitleLine = {x: 76, y: 140, w: 1700,
        fontSize: fitFont(scene.subtitle, {width: 1700, height: 44, max: 32, min: 24, lineHeight: 1.2})};
    }
    if (scene.kind === 'stage') delete layout.media;
    return layout;
  }
  // steps and custom cta: one brick per point, stacked bottom-up beside the dragon.
  const count = scene.items.length;
  layout.bricks = scene.items.map((_, i) => ({x: 150 + i * 45, y: 700 - i * 150, w: 1060 - i * 90, h: 110}));
  if (layout.bricks.at(-1).y < 190) fail(`${count} bricks do not fit below the heading`);
  if (scene.subtitle && character) {
    const [bx, by, bw, bh] = L.sideBubble;
    layout.bubble = {x: bx, y: by, w: bw, h: bh, tail: 'left',
      fontSize: fitFont(scene.subtitle, {width: bw - 52, height: bh - 34, max: 40, min: 26, lineHeight: 1.3})};
  } else if (scene.subtitle) {
    layout.subtitleLine = {x: 76, y: 140, w: 1700,
      fontSize: fitFont(scene.subtitle, {width: 1700, height: 44, max: 32, min: 24, lineHeight: 1.2})};
  }
  return layout;
}

/** Validate the comic-only scene fields before rendering. */
export function validateComicScene(scene, {character = true} = {}) {
  if (scene.characterSide === 'left') fail('the comic layout keeps the dragon on the right; omit characterSide');
  if (scene.tone !== undefined && !Object.hasOwn(COMIC_TONES, scene.tone)) fail(`unsupported tone ${scene.tone}`);
  if (scene.highlight !== undefined) {
    if (typeof scene.highlight !== 'string' || !scene.highlight.trim() || !scene.title.includes(scene.highlight)) {
      fail('highlight must be a phrase copied from the scene title');
    }
  }
  if (scene.sourceLabel !== undefined && (typeof scene.sourceLabel !== 'string' || [...scene.sourceLabel].length > 30)) {
    fail('sourceLabel needs at most 30 characters');
  }
  return comicLayout(scene, {character});
}
