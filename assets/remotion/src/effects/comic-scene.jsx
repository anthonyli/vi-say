// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Brick, Bubble, Burst, Dots, Frame, RayBurst} from '../comic-kit';
import {ComicOutro} from '../comic-outro';
import {MediaFrame} from './operations';
import {comicLayout} from '../../comic-layout.mjs';
import {COMIC_MOTION as M, COMIC_PALETTE as C, fitFont, idle, markerSweep, popIn, shakeAll, slam} from '../../effects/comic-motion.mjs';

const BRICK_COLORS = [C.yellow, C.red, C.purple];
const HEAD_AT = .06, MARK_AT = .55, BUBBLE_AT = .45;

/** Title text with an optional highlighter sweep over one phrase. */
function MarkedTitle({text, highlight, marker, time}) {
  if (!highlight) return text;
  const index = text.indexOf(highlight);
  const sweep = markerSweep(time, MARK_AT);
  return <>{text.slice(0, index)}<span style={{backgroundImage:`linear-gradient(${marker}, ${marker})`,
    backgroundRepeat:'no-repeat', backgroundPosition:'0 86%', backgroundSize:`${sweep*100}% 42%`,
    padding:'0 .06em', borderRadius:4}}>{highlight}</span>{text.slice(index + highlight.length)}</>;
}

function Header({scene, layout, time}) {
  const {x, y, w, h, fontSize} = layout.header;
  const s = slam(time, HEAD_AT);
  return <div style={{position:'absolute', left:x, top:y, width:w, height:h, display:'flex', alignItems:'center',
    zIndex:30, opacity:s.opacity, transform:`scale(${s.scale}) rotate(${s.rotate}deg)`, transformOrigin:'0 50%'}}>
    <div style={{fontSize, fontWeight:900, lineHeight:1.15, color:C.ink, letterSpacing:-1,
      textShadow:`4px 4px 0 ${layout.tone === 'cream' || layout.tone === 'white' ? C.yellow : C.white}`}}>
      <MarkedTitle text={scene.title} highlight={scene.highlight} marker={layout.marker} time={time}/>
    </div>
  </div>;
}

function Tag({text, right = 70, top = 52}) {
  if (!text) return null;
  return <div style={{position:'absolute', right, top, padding:'8px 20px', background:C.ink, color:C.white,
    fontSize:24, fontWeight:850, borderRadius:6, boxShadow:`5px 5px 0 ${C.yellow}`, zIndex:31}}>{text}</div>;
}

function SideBubble({layout, text, time, at = BUBBLE_AT}) {
  if (!layout.bubble) return null;
  const {x, y, w, h, fontSize, tail} = layout.bubble, p = popIn(time, at);
  if (!p.opacity) return null;
  return <div style={{position:'absolute', inset:0, opacity:p.opacity, zIndex:32,
    transform:`scale(${p.scale}) rotate(${idle(time, 1.3)}deg)`, transformOrigin:`${x + 60}px ${y + h + 30}px`}}>
    <Bubble x={x} y={y} w={w} h={h} tail={tail} fontSize={fontSize}><span style={{whiteSpace:'pre-line'}}>{text}</span></Bubble>
  </div>;
}

function SubtitleLine({layout, text, time}) {
  if (!layout.subtitleLine) return null;
  const {x, y, w, fontSize} = layout.subtitleLine, p = popIn(time, BUBBLE_AT);
  return <div style={{position:'absolute', left:x, top:y, width:w, fontSize, fontWeight:750, color:C.ink,
    opacity:p.opacity, zIndex:30}}>{text}</div>;
}

function Backdrop({layout, rays}) {
  return <>
    <AbsoluteFill style={{background:layout.background}}/>
    {rays && <RayBurst x={rays[0]} y={rays[1]}/>}
    <Dots opacity={layout.tone === 'cream' || layout.tone === 'white' ? .1 : .14}/>
  </>;
}

function Hero({scene, layout, time}) {
  const {title, subtitle} = layout, s = slam(time, HEAD_AT), p = popIn(time, BUBBLE_AT + .1);
  return <>
    <Backdrop layout={layout} rays={[1420, 520]}/>
    {(scene.label) && <div style={{position:'absolute', left:title.x, top:120, padding:'10px 24px', background:C.purple,
      border:`5px solid ${C.ink}`, boxShadow:`7px 7px 0 ${C.ink}`, fontSize:30, fontWeight:900, color:C.ink,
      opacity:popIn(time, 0).opacity, zIndex:31}}>{scene.label}</div>}
    <div style={{position:'absolute', left:title.x, top:title.y, width:title.w, height:title.h, display:'flex',
      alignItems:'center', zIndex:30, opacity:s.opacity, transform:`scale(${s.scale}) rotate(${s.rotate}deg)`,
      transformOrigin:'0 50%'}}>
      <div style={{fontSize:title.fontSize, fontWeight:950, lineHeight:1.18, color:C.ink, letterSpacing:-2,
        whiteSpace:'pre-line', textShadow:`6px 6px 0 ${C.white}`}}>
        <MarkedTitle text={scene.title} highlight={scene.highlight} marker={layout.marker} time={time}/>
      </div>
    </div>
    {subtitle && p.opacity > 0 && <div style={{position:'absolute', inset:0, zIndex:31, opacity:p.opacity,
      transform:`scale(${.9 + .1 * p.scale})`, transformOrigin:`${subtitle.x}px ${subtitle.y}px`}}>
      <Frame x={subtitle.x} y={subtitle.y} w={subtitle.w} h={subtitle.h} fill={C.white} rotate={-1.2}>
        <div style={{position:'absolute', inset:'14px 30px', display:'flex', alignItems:'center', fontSize:subtitle.fontSize,
          fontWeight:850, lineHeight:1.3, color:C.ink}}>{scene.subtitle}</div>
      </Frame>
    </div>}
  </>;
}

function Demo({scene, layout, time, doc}) {
  const [x, y, w, h] = layout.media, p = popIn(time, 0, .38);
  return <>
    <Backdrop layout={layout}/>
    <Header scene={scene} layout={layout} time={time}/>
    <Tag text={scene.label ?? doc.series}/>
    <SubtitleLine layout={layout} text={scene.subtitle} time={time}/>
    <div style={{position:'absolute', inset:0, opacity:p.opacity, transform:`scale(${.94 + .06 * p.scale})`,
      transformOrigin:`${x + w / 2}px ${y + h / 2}px`}}>
      <MediaFrame scene={scene} time={time} box={[x, y, w, h]} comic/>
      <div style={{position:'absolute', left:x + 22, top:y + h - 58, padding:'6px 14px', background:'#18233ce0',
        color:C.white, fontSize:19, fontWeight:700, borderRadius:5, zIndex:9}}>{scene.sourceLabel ?? '界面素材展示'}</div>
    </div>
    <SideBubble layout={layout} text={scene.subtitle} time={time}/>
  </>;
}

function Steps({scene, layout, time, doc}) {
  const impacts = scene.items.map(item => item.at + M.drop * .62);
  const offset = shakeAll(time, impacts, {amplitude: 5});
  return <>
    <Backdrop layout={layout} rays={[700, 980]}/>
    <AbsoluteFill style={{transform:`translate(${offset.x}px, ${offset.y}px)`}}>
      <Header scene={scene} layout={layout} time={time}/>
      <Tag text={scene.label ?? doc.series}/>
      <SubtitleLine layout={layout} text={scene.subtitle} time={time}/>
      {scene.items.map((item, i) => {
        const b = layout.bricks[i];
        return <Brick key={i} x={b.x} y={b.y} w={b.w} h={b.h} text={item.text} sub={item.detail ?? ''}
          color={item.color ?? BRICK_COLORS[i % BRICK_COLORS.length]} at={item.at} t={time} angle={i % 2 ? 5 : -5}/>;
      })}
    </AbsoluteFill>
    <SideBubble layout={layout} text={scene.subtitle} time={time}/>
  </>;
}

function Stage({scene, layout, time, doc}) {
  return <>
    <Backdrop layout={layout}/>
    <Header scene={scene} layout={layout} time={time}/>
    <Tag text={scene.label ?? doc.series}/>
    <SubtitleLine layout={layout} text={scene.subtitle} time={time}/>
    <SideBubble layout={layout} text={scene.subtitle} time={time}/>
  </>;
}

export function ComicScene({scene, doc, time}) {
  const character = doc.modules?.character?.mode !== 'none';
  const layout = comicLayout(scene, {character});
  if (layout.outro) return <ComicOutro time={time} duration={scene.end - scene.start} enterAt={.05}
    actions={scene.items} brand={doc.series ?? 'vi-say'} character={character}/>;
  const props = {scene, layout, time, doc};
  return <AbsoluteFill style={{color:C.ink, overflow:'hidden'}}>
    {scene.kind === 'hero' ? <Hero {...props}/> : scene.kind === 'demo' ? <Demo {...props}/> :
      scene.kind === 'stage' ? <Stage {...props}/> : <Steps {...props}/>}
  </AbsoluteFill>;
}

/** Reusable comic effects. Each one owns its entrance, so the generic fade is skipped. */
export const COMIC_EFFECT_RENDERERS = {
  bubble: (e, t) => {
    const w = e.width ?? 460, h = e.height ?? 150, p = popIn(t, e.at ?? 0);
    const fontSize = e.fontSize ?? fitFont(e.text, {width: w - 52, height: h - 34, max: 44, min: 24, lineHeight: 1.3});
    return <div style={{position:'absolute', inset:0, opacity:p.opacity,
      transform:`scale(${p.scale}) rotate(${idle(t, e.position[0] / 300)}deg)`,
      transformOrigin:`${e.position[0] + w / 2}px ${e.position[1] + h}px`}}>
      <Bubble x={e.position[0]} y={e.position[1]} w={w} h={h} tail={e.tail ?? 'left'} fontSize={fontSize} fill={e.color}>
        <span style={{whiteSpace:'pre-line'}}>{e.text}</span></Bubble>
    </div>;
  },
  burst: (e, t) => {
    const p = popIn(t, e.at ?? 0, .42), size = e.size ?? 150;
    return <div style={{position:'absolute', inset:0, opacity:p.opacity, transform:`rotate(${idle(t, 2.1, {degrees: 4})}deg)`,
      transformOrigin:`${e.position[0] + size / 2}px ${e.position[1] + size / 2}px`}}>
      <Burst x={e.position[0]} y={e.position[1]} size={size} text={e.text ?? ''} color={e.color} scale={p.scale}/>
    </div>;
  },
  brick: (e, t) => <Brick x={e.position[0]} y={e.position[1]} w={e.width ?? 600} h={e.height ?? 104}
    text={e.text} sub={e.detail ?? ''} color={e.color} at={e.at ?? 0} t={t} angle={e.angle ?? 0}/>,
};
export const COMIC_EFFECT_TYPES = Object.freeze(Object.keys(COMIC_EFFECT_RENDERERS));
