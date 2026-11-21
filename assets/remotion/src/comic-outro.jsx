// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Brick, Burst, COMIC_PALETTE as colors, Dots, Frame, RayBurst, clamp, ease} from './comic-kit';
import template from '../../production/outro.json';

const brickColors = [colors.blue, colors.purple, colors.red];

/**
 * The shared interaction outro: one brick per action, landing on the measured
 * word of the final narration. Used by the narrated comic theme and by the
 * recorded-video outro so both routes end identically.
 */
export function ComicOutro({time, duration, enterAt = 0, actions, brand = 'vi-say', character = false,
  title = template.title, subtitle = template.subtitle}) {
  if (!Array.isArray(actions) || actions.length !== template.items.length) {
    throw new Error('ComicOutro needs one measured action time per outro item');
  }
  const entrance = ease((time - enterAt) / .46);
  return <AbsoluteFill style={{background:colors.yellow, color:colors.ink, overflow:'hidden'}}>
    <Dots size={32} opacity={.14}/>
    <RayBurst x={935} y={605}/>
    <Frame x={151} y={101} w={1600} h={795} rotate={-.9}><Dots size={35} opacity={.06}/></Frame>
    <div style={{position:'absolute', left:286, right:286, top:128, textAlign:'center', opacity:entrance,
      transform:`translateY(${(1-entrance)*28}px)`}}>
      <div style={{fontSize:31, fontWeight:900}}>{brand}</div>
      <div style={{fontSize:91, fontWeight:900, lineHeight:1.44}}>{title}</div>
      <div style={{fontSize:35, fontWeight:700}}>{subtitle}</div>
    </div>
    <Burst x={230} y={405} size={119} color={colors.purple} scale={entrance}/>
    {/* With the dragon standing at the right, its burst moves up so the head stays clear. */}
    <Burst x={character ? 1585 : 1512} y={character ? 150 : 385} size={character ? 112 : 128} scale={entrance}/>
    <Brick x={423} y={810} w={1004} h={50} text="" at={-1} t={time}/>
    {template.items.map((item, i) =>
      <Brick key={item.anchor} x={481 + 44*i} y={693 - 118*i} w={905 - 88*i} h={94}
        color={brickColors[i]} text={item.text} sub={item.detail} at={actions[i].at} t={time} angle={i===1?-6:6}/>)}
    <AbsoluteFill style={{background:colors.ink, opacity:clamp((time-duration+.33)/.33), zIndex:510}}/>
  </AbsoluteFill>;
}
