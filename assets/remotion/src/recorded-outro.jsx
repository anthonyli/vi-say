// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {AbsoluteFill, Composition, Img, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brick, Burst, COMIC_PALETTE as colors, Dots, Frame, RayBurst, clamp, ease} from './comic-kit';
import {ComicCaptions} from './comic-captions';
import GLScenePair from './gl-transition';
import template from '../../production/outro.json';

const brickColors = [colors.blue, colors.purple, colors.red];

function Bricks({doc, time}) {
  const entrance = ease((time - doc.transitionSeconds + .24) / .46);
  return <AbsoluteFill style={{background:colors.yellow, color:colors.ink, overflow:'hidden'}}>
    <Dots size={32} opacity={.14}/>
    <RayBurst x={935} y={605}/>
    <Frame x={151} y={101} w={1600} h={795} rotate={-.9}><Dots size={35} opacity={.06}/></Frame>
    <div style={{position:'absolute', left:286, right:286, top:128, textAlign:'center', opacity:entrance,
      transform:`translateY(${(1-entrance)*28}px)`}}>
      <div style={{fontSize:31, fontWeight:900}}>vi-say</div>
      <div style={{fontSize:91, fontWeight:900, lineHeight:1.44}}>{template.title}</div>
      <div style={{fontSize:35, fontWeight:700}}>{template.subtitle}</div>
    </div>
    <Burst x={230} y={405} size={119} color={colors.purple} scale={entrance}/>
    <Burst x={1512} y={385} size={128} scale={entrance}/>
    <Brick x={423} y={810} w={1004} h={50} text="" at={-1} t={time}/>
    {template.items.map((item, i) =>
      <Brick key={item.anchor} x={481 + 44*i} y={693 - 118*i} w={905 - 88*i} h={94}
        color={brickColors[i]} text={item.text} sub={item.detail} at={doc.actions[i].at} t={time} angle={i===1?-6:6}/>)}
    <AbsoluteFill style={{background:colors.ink, opacity:clamp((time-doc.duration+.33)/.33), zIndex:510}}/>
  </AbsoluteFill>;
}

function RecordedOutro({doc}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const caption = doc.captions.find(cue => cue.start <= time && time < cue.end);
  return <AbsoluteFill style={{fontFamily:'"Source Han Sans SC", "PingFang SC", "Heiti SC", Arial, sans-serif'}}>
    {doc.font && <style>{`@font-face{font-family:"Source Han Sans SC";src:url("${staticFile(doc.font)}")}`}</style>}
    <GLScenePair name={doc.transition} frames={Math.round(doc.transitionSeconds*fps)} params={doc.transitionParams}
      before={<Img src={staticFile('last-frame.png')} style={{width:'100%',height:'100%'}}/>}
      after={<Bricks doc={doc} time={time}/>}/>
    <ComicCaptions caption={caption} options={{fontSize:46,fontSizeEn:30,bottom:27,
      lineHeight:1.18,lineGap:3,padding:'10px 24px',keywords:template.items.map(x=>x.anchor),
      keywordsEn:['comment','follow','like']}}/>
  </AbsoluteFill>;
}

registerRoot(function Root() {
  return <Composition id="RecordedOutro" component={RecordedOutro} width={1920} height={1080}
    fps={30} durationInFrames={240}
    defaultProps={{doc:{duration:8,fps:30,transitionSeconds:.7,transition:'gl:GridFlip',
      actions:template.items.map((item,i)=>({anchor:item.anchor,at:2+i})),captions:[]}}}
    calculateMetadata={({props:{doc}}) => ({fps:doc.fps,durationInFrames:Math.round(doc.duration*doc.fps)})}/>;
});
