// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Speech-cued effects: breathing cue cards, spotlight, hand-drawn sketch,
// typewriter, stamp and checklist. Every value derives from time, so the
// HTML review, seeking and parallel render workers show identical frames.
import React from 'react';
import {COMIC_PALETTE as C, cueState, drawProgress, easeInOut, fitFont, lerp, popIn, shake, spotlightAt,
  stampIn, textUnits, typedCount} from '../../effects/comic-motion.mjs';
import {GLASS} from './glass';
import {useComic, INK, comicColor, comicPanel} from './surface';

const glassPanel = (extra = {}) => ({background: 'linear-gradient(135deg,#ffffffe6,#f1f7ffcc)', border: '1px solid #c9dcf2',
  borderRadius: 22, boxShadow: '0 22px 60px #46699a2e', ...extra});
const CHIP_H = 58, CHIP_GAP = 14;
const chipWidth = title => Math.round(textUnits(title) * 25 + 78);

function CueCard({item, index, width, comic, breathing, accent, large = false}) {
  const badge = large ? 104 : 78, detailSize = large ? 31 : 26;
  const titleSize = fitFont(item.title, {width: width - badge - 90, height: large ? 140 : 110, max: large ? 64 : 46, min: 28, lineHeight: 1.2});
  const shadow = comic ? `${8 + (breathing - 1) * 280}px ${9 + (breathing - 1) * 280}px 0 ${INK}` : undefined;
  return <div style={{width, boxSizing: 'border-box', padding: large ? '34px 40px' : '24px 30px', display: 'flex', gap: large ? 30 : 22, alignItems: 'center',
    ...(comic ? comicPanel({boxShadow: shadow}) : glassPanel({boxShadow: `0 22px ${60 + (breathing - 1) * 1500}px ${accent}40`}))}}>
    <div style={{flex: '0 0 auto', width: badge, height: badge, borderRadius: comic ? 12 : badge / 2, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: badge * .5, fontWeight: 950, color: comic ? INK : '#fff',
      background: accent, border: comic ? `5px solid ${INK}` : 'none', transform: `rotate(${comic ? -4 : 0}deg)`}}>
      {item.icon ?? index + 1}</div>
    <div style={{minWidth: 0}}>
      <div style={{fontSize: titleSize, fontWeight: 900, lineHeight: 1.2, color: comic ? INK : GLASS.ink}}>{item.title}</div>
      {item.detail && <div style={{fontSize: detailSize, fontWeight: comic ? 700 : 500, lineHeight: 1.35, marginTop: 8,
        color: comic ? INK : GLASS.muted, opacity: comic ? .85 : 1}}>{item.detail}</div>}
    </div>
  </div>;
}

function Chip({item, comic, accent, opacity = 1}) {
  return <div style={{height: CHIP_H, width: chipWidth(item.title), boxSizing: 'border-box', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, fontSize: 25, fontWeight: 900, whiteSpace: 'nowrap', opacity,
    ...(comic ? {background: accent, border: `4px solid ${INK}`, borderRadius: 8, boxShadow: `4px 4px 0 ${INK}`, color: INK}
      : {background: `${accent}22`, border: `1px solid ${accent}88`, borderRadius: 40, color: GLASS.ink})}}>✓ {item.title}</div>;
}

/** focus: one big breathing card; earlier cards fly down into a chip row. stack: an accordion. */
export function CueCards({effect: e, time}) {
  const comic = useComic(), [x, y, w, h] = e.box, {states} = cueState(e.items, time);
  const accent = i => comic ? comicColor(e.items[i].color, i) : e.items[i].color ?? [GLASS.cyan, GLASS.coral, GLASS.purple][i % 3];
  if (e.mode === 'stack') {
    const collapsedH = 76, gap = 16;
    let top = y;
    return <>{e.items.map((item, i) => {
      const s = states[i];
      if (!s.visible) return null;
      const rowTop = top, folded = s.collapse;
      top += lerp(expandedHeight(item), collapsedH, folded) + gap;
      return <div key={i} style={{position: 'absolute', left: x, top: rowTop, width: w, zIndex: 14,
        opacity: s.enter.opacity, transform: `translateX(${(1 - s.enter.scale) * -60}px) scale(${s.breathing})`, transformOrigin: '0 50%'}}>
        {folded < .5 ? <div style={{opacity: 1 - folded * 2}}><CueCard item={item} index={i} width={w} comic={comic} breathing={s.breathing} accent={accent(i)}/></div>
          : <div style={{opacity: (folded - .5) * 2}}><Chip item={item} comic={comic} accent={accent(i)}/></div>}
      </div>;
    })}</>;
  }
  const cardWidth = Math.min(w, 1040), chipY = y + h - CHIP_H, cardHeight = 200;
  let chipX = x;
  const slots = e.items.map(item => {const slot = chipX; chipX += chipWidth(item.title) + CHIP_GAP; return slot;});
  return <>{e.items.map((item, i) => {
    const s = states[i];
    if (!s.visible) return null;
    const cardLeft = x + (w - cardWidth) / 2, cardTop = y + Math.max(0, (h - CHIP_H - 24 - cardHeight) / 2);
    if (s.collapse >= 1) return <div key={i} style={{position: 'absolute', left: slots[i], top: chipY, zIndex: 13}}>
      <Chip item={item} comic={comic} accent={accent(i)}/></div>;
    const q = s.collapse, scale = lerp(1, chipWidth(item.title) / cardWidth, q) * s.enter.scale * s.breathing;
    const left = lerp(cardLeft, slots[i], q), top = lerp(cardTop, chipY, q) + (1 - s.enter.scale) * 40;
    return <div key={i} style={{position: 'absolute', left, top, zIndex: 15 - Math.round(q), opacity: s.enter.opacity,
      transform: `scale(${scale}) rotate(${comic ? (1 - q) * (i % 2 ? 1.2 : -1.2) : 0}deg)`, transformOrigin: '0 0'}}>
      <div style={{opacity: 1 - easeInOut((q - .55) / .45)}}><CueCard item={item} index={i} width={cardWidth} comic={comic} breathing={s.breathing} accent={accent(i)} large/></div>
    </div>;
  })}</>;
}
const expandedHeight = item => (item.detail ? 176 : 132);
export const cueCardsHeight = items => items.length ? expandedHeight(items.at(-1)) + (items.length - 1) * (76 + 16) : 0;

/** Dim everything except a breathing ring that travels between regions. */
export function Spotlight({effect: e, time}) {
  const comic = useComic(), state = spotlightAt(e.events, time), mask = `spot-${React.useId().replace(/[^a-z\d]/gi, '')}`;
  if (!state) return null;
  const [x, y, w, h] = state.region, pad = 14 * state.ring, dim = e.dim ?? .55;
  const ring = comic ? C.yellow : '#ffffff';
  return <div style={{position: 'absolute', inset: 0, zIndex: 25, opacity: state.opacity, pointerEvents: 'none'}}>
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
      <defs><mask id={mask}><rect width="1920" height="1080" fill="#fff"/>
        <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx="18" fill="#000"/></mask></defs>
      <rect width="1920" height="1080" fill={comic ? INK : '#0b1626'} opacity={dim} mask={`url(#${mask})`}/>
      {comic && <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx="18" fill="none" stroke={INK} strokeWidth="14"/>}
      <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx="18" fill="none" stroke={ring}
        strokeWidth={comic ? 7 : 4} strokeDasharray={comic ? '22 12' : undefined} strokeDashoffset={-time * 40}
        style={comic ? undefined : {filter: 'drop-shadow(0 0 14px #ffffffcc)'}}/>
    </svg>
    {state.label && <div style={{position: 'absolute', left: x - pad, top: Math.max(10, y - pad - 70), padding: '10px 22px',
      fontSize: 30, fontWeight: 900, transform: `scale(${popIn(time, e.events[state.index].at + .3).scale})`, transformOrigin: '0 100%',
      ...(comic ? {background: C.yellow, color: INK, border: `5px solid ${INK}`, borderRadius: 8, boxShadow: `5px 5px 0 ${INK}`}
        : {background: '#ffffffee', color: GLASS.ink, borderRadius: 30, boxShadow: '0 10px 30px #0004'})}}>{state.label}</div>}
  </div>;
}

/** Hand-drawn ellipse, box or underline, drawn as one pen stroke, then a label pops. */
export function Sketch({effect: e, time}) {
  const comic = useComic(), [x, y, w, h] = e.region, p = drawProgress(time, e.at ?? 0, e.seconds ?? .6);
  const color = e.color ?? (comic ? C.red : GLASS.coral), cx = x + w / 2, cy = y + h / 2;
  const shape = e.shape ?? 'ellipse';
  let d;
  if (shape === 'underline') d = `M${x - 8} ${y + h + 10} Q${cx} ${y + h + 24} ${x + w + 12} ${y + h + 6}`;
  else if (shape === 'box') d = `M${x - 10} ${y - 6} L${x + w + 12} ${y - 12} L${x + w + 8} ${y + h + 10} L${x - 14} ${y + h + 6} Z M${x - 10} ${y - 6} L${x + 30} ${y - 8}`;
  else {
    const points = Array.from({length: 49}, (_, i) => {
      const a = (-.25 + i / 48 * 2.15) * Math.PI, wobble = 1 + .035 * Math.sin(i * 1.7);
      return `${(cx + Math.cos(a) * (w / 2 + 22) * wobble).toFixed(1)} ${(cy + Math.sin(a) * (h / 2 + 18) * wobble).toFixed(1)}`;
    });
    d = `M${points.join(' L')}`;
  }
  const label = e.label && p >= 1 ? popIn(time, (e.at ?? 0) + (e.seconds ?? .6)) : null;
  return <>
    <svg width="1920" height="1080" style={{position: 'absolute', inset: 0, zIndex: 24, pointerEvents: 'none'}}>
      {comic && <path d={d} pathLength="1" fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="1 1" strokeDashoffset={1 - p}/>}
      <path d={d} pathLength="1" fill="none" stroke={color} strokeWidth={comic ? 8 : 6} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="1 1" strokeDashoffset={1 - p}/>
    </svg>
    {label && <div style={{position: 'absolute', left: x + w + 30, top: y - 40, zIndex: 26, opacity: label.opacity,
      transform: `scale(${label.scale}) rotate(${comic ? -3 : 0}deg)`, transformOrigin: '0 100%', padding: '10px 22px',
      fontSize: 30, fontWeight: 900, whiteSpace: 'nowrap',
      ...(comic ? {background: C.white, color: INK, border: `5px solid ${INK}`, borderRadius: 8, boxShadow: `5px 5px 0 ${color}`}
        : {background: color, color: '#fff', borderRadius: 30})}}>{e.label}</div>}
  </>;
}

/** Text typed into an input bar with a blinking caret. */
export function Typewriter({effect: e, time}) {
  const comic = useComic(), chars = [...e.text], count = typedCount(e.text, time, e.at ?? 0, e.seconds);
  const width = e.width ?? 900, fontSize = e.fontSize ?? 34, caret = Math.floor((time - (e.at ?? 0)) * 2) % 2 === 0 || count < chars.length;
  return <div style={{position: 'absolute', left: e.position[0], top: e.position[1], width, boxSizing: 'border-box', zIndex: 14,
    display: 'flex', alignItems: 'center', gap: 16, padding: '20px 26px', fontSize, fontWeight: comic ? 800 : 600,
    ...(comic ? comicPanel() : glassPanel({borderRadius: 40}))}}>
    <span style={{color: comic ? C.red : GLASS.cyan, fontWeight: 950}}>{e.prompt ?? '›'}</span>
    <span style={{color: comic ? INK : GLASS.ink, whiteSpace: 'pre-wrap', flex: 1}}>{chars.slice(0, count).join('')}
      <span style={{display: 'inline-block', width: 4, height: fontSize * 1.05, marginLeft: 4, verticalAlign: 'text-bottom',
        background: comic ? INK : GLASS.cyan, opacity: caret ? 1 : 0}}/></span>
  </div>;
}

/** A rubber stamp slams down with a short shake. */
export function Stamp({effect: e, time}) {
  const comic = useComic(), at = e.at ?? 0, s = stampIn(time, at, e.angle ?? -12), jolt = shake(time, at + .32, {amplitude: 9});
  const size = e.size ?? 240, color = e.color ?? (comic ? '#e0402b' : GLASS.coral);
  const fontSize = Math.min(size * .3, size * .78 / Math.max(1, textUnits(e.text)));
  return <div style={{position: 'absolute', left: e.position[0] + jolt.x, top: e.position[1] + jolt.y, width: size, height: size * .46,
    zIndex: 27, opacity: s.opacity * .94, transform: `scale(${s.scale}) rotate(${s.rotate}deg)`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', boxSizing: 'border-box', border: `${size * .035}px solid ${color}`, borderRadius: size * .06,
    outline: `${size * .014}px solid ${color}`, outlineOffset: -size * .07, color, fontSize, fontWeight: 950, letterSpacing: 4,
    background: comic ? '#ffffffd0' : '#ffffff99', whiteSpace: 'nowrap'}}>{e.text}</div>;
}

/** Items tick off one by one; each tick is drawn as a pen stroke. */
export function Checklist({effect: e, time}) {
  const comic = useComic(), [x, y, w] = e.box, rowH = 78;
  return <div style={{position: 'absolute', left: x, top: y, width: w, zIndex: 14}}>{e.items.map((item, i) => {
    const appear = popIn(time, item.at - .25, .4), tick = drawProgress(time, item.at, .35), done = tick >= 1;
    return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22, height: rowH, opacity: .35 + .65 * appear.opacity}}>
      <svg width="58" height="58" viewBox="0 0 58 58" style={{flex: '0 0 auto', transform: `scale(${.7 + .3 * appear.scale})`}}>
        <rect x="5" y="5" width="48" height="48" rx={comic ? 8 : 14} fill={done ? (comic ? C.yellow : '#e7f6ee') : '#fff'}
          stroke={comic ? INK : '#9bb3cc'} strokeWidth={comic ? 5 : 2}/>
        <path d="M15 30 L25 40 L44 18" pathLength="1" fill="none" stroke={comic ? INK : '#2f9e6b'} strokeWidth={comic ? 7 : 5}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - tick}/>
      </svg>
      <span style={{fontSize: 34, fontWeight: done ? 900 : 700, color: comic ? INK : GLASS.ink, opacity: done ? 1 : .7}}>{item.text}</span>
    </div>;
  })}</div>;
}

export const CUE_EFFECT_RENDERERS = {
  'cue-cards': (e, t) => <CueCards effect={e} time={t}/>,
  spotlight: (e, t) => <Spotlight effect={e} time={t}/>,
  sketch: (e, t) => <Sketch effect={e} time={t}/>,
  typewriter: (e, t) => <Typewriter effect={e} time={t}/>,
  stamp: (e, t) => <Stamp effect={e} time={t}/>,
  checklist: (e, t) => <Checklist effect={e} time={t}/>,
};
