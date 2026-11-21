// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {AbsoluteFill, Composition, Img, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ComicCaptions} from './comic-captions';
import {ComicOutro} from './comic-outro';
import GLScenePair from './gl-transition';
import template from '../../production/outro.json';

function RecordedOutro({doc}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const caption = doc.captions.find(cue => cue.start <= time && time < cue.end);
  return <AbsoluteFill style={{fontFamily:'"Source Han Sans SC", "PingFang SC", "Heiti SC", Arial, sans-serif'}}>
    {doc.font && <style>{`@font-face{font-family:"Source Han Sans SC";src:url("${staticFile(doc.font)}")}`}</style>}
    <GLScenePair name={doc.transition} frames={Math.round(doc.transitionSeconds*fps)} params={doc.transitionParams}
      before={<Img src={staticFile('last-frame.png')} style={{width:'100%',height:'100%'}}/>}
      after={<ComicOutro time={time} duration={doc.duration} enterAt={doc.transitionSeconds-.24} actions={doc.actions}/>}/>
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
