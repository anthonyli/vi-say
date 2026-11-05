// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {Img,staticFile} from 'remotion';
import geometry from '../../production/dragon-mouth-shapes.json';
const shapes=geometry.shapes;
export function DragonMouth({x=90,y=245,w=560,time=0,cues=[],closedFile='dragon-closed.png',neutralFile='dragon-neutral.png'}){
 let index=cues.findIndex(c=>time>=c.start&&time<c.end);if(index<0)index=Math.max(0,cues.length-1);
 const cue=cues[index]||{value:'X',start:0};const now=shapes[cue.value]||shapes.X;const before=shapes[cues[Math.max(0,index-1)]?.value]||shapes.X;
 const q=Math.max(0,Math.min(1,(time-cue.start)/geometry.transitionSeconds));const p=q*q*(3-2*q);const [width,height,round]=now.map((v,i)=>before[i]+(v-before[i])*p);const half=width/2;
 const top=round?-height*.30:height>1?12:22;const bottom=height>1?top+height:top;
 const r=Math.min(13,Math.max(4,height*.3)),dip=Math.min(9,height*.2);const path=round?`M${-half} 8 C${-half} ${-height*.3},${half} ${-height*.3},${half} 8 C${half} ${height*1.25},${-half} ${height*1.25},${-half} 8Z`:`M${-half+r} 0 C${-half*.35} ${dip} ${half*.35} ${dip} ${half-r} 0 Q${half+1} -1 ${half} ${r} C${half*.80} ${height*1.3} ${-half*.80} ${height*1.3} ${-half} ${r} Q${-half-1} -1 ${-half+r} 0Z`;
 const mask=geometry.maskCss;
 return <div style={{position:'absolute',left:x,top:y,width:w,height:w*geometry.imageSize[1]/geometry.imageSize[0],zIndex:15}}><Img src={staticFile(closedFile)} style={{position:'absolute',width:'100%'}}/><Img src={staticFile(neutralFile)} style={{position:'absolute',width:'100%',maskImage:mask,WebkitMaskImage:mask}}/><svg width="100%" height="100%" viewBox={`0 0 ${geometry.imageSize.join(' ')}`} style={{position:'absolute',inset:0}}><defs><linearGradient id="mouth-inner" x2="0" y2="1"><stop stopColor="#361317"/><stop offset="1" stopColor="#8e352e"/></linearGradient><clipPath id="mouth-shape"><path d={path}/></clipPath></defs><g transform={`translate(${geometry.origin.join(' ')}) rotate(${geometry.rotationDegrees})`}>{height<1?<path d="M-83 0Q0 44 85 0" fill="none" stroke="#697f42" strokeWidth={cue.value==='A'?3:2.5} strokeLinecap="round"/>:<><path d={path} fill="url(#mouth-inner)" stroke="#5c703e" strokeWidth="1.6" strokeLinejoin="round"/><g clipPath="url(#mouth-shape)"><ellipse cx="4" cy={height*.87} rx={width*.31} ry={height*.30} fill="#d66c63"/><ellipse cx="5" cy={height*.75} rx={width*.22} ry={height*.13} fill="#ed9081" opacity=".7"/>{!round&&height>28&&<><path d="M-58 10Q-50 15-39 14Q-43 29-48 29Q-53 29-58 10Z" fill="#f8eccb"/><path d="M39 13Q49 13 57 8Q54 27 49 28Q44 29 39 13Z" fill="#f8eccb"/></>}</g></>}</g></svg></div>;
}
