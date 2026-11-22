// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {glTransition} from '@gl-transitions/remotion';
import {AbsoluteFill,isHtmlInCanvasSupported,useCurrentFrame,useRemotionEnvironment} from 'remotion';
import {glOptions} from '../gl-transitions.mjs';

// The preview fallback keeps the transition timing visible without the shader.
function PreviewShaderMotion({before,after,frame,frames}){
  const p=frames<=1?1:frame/Math.max(1,frames-1);
  const eased=p*p*(3-2*p);
  return <AbsoluteFill>
    <AbsoluteFill style={{opacity:1-eased,transform:`scale(${1+eased*.06})`}}>{before}</AbsoluteFill>
    <AbsoluteFill style={{opacity:eased,transform:`translateY(${(1-eased)*36}px) scale(${.96+.04*eased})`}}>{after}</AbsoluteFill>
  </AbsoluteFill>;
}

function RealShader({before,after,name,params,frames}){
  return <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={frames}>{before}</TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={glTransition(glOptions(name,params))} timing={linearTiming({durationInFrames:frames})}/>
    <TransitionSeries.Sequence durationInFrames={frames+1}>{after}</TransitionSeries.Sequence>
  </TransitionSeries>;
}

class PreviewShaderBoundary extends React.Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <PreviewShaderMotion before={this.props.before} after={this.props.after} frame={this.props.frame} frames={this.props.frames}/>;
    return this.props.children;
  }
}

let unavailableReason;
export function previewShaderUnavailableReason() {
  if (unavailableReason !== undefined) return unavailableReason;
  if (!isHtmlInCanvasSupported()) {
    unavailableReason = 'Canvas Draw Element';
  } else {
    try {
      unavailableReason = document.createElement('canvas').getContext('webgl2') ? null : 'WebGL 2';
    } catch {
      unavailableReason = 'WebGL 2';
    }
  }
  return unavailableReason;
}

export default function GLScenePair({before,after,name,params,frames}){
  const frame=useCurrentFrame();
  const {isRendering}=useRemotionEnvironment();
  // The two sequences overlap at local frame zero, preserving authored starts.
  // At completion return the live incoming scene, with no residual canvas.
  if(frame>=frames)return after;
  const motion=<PreviewShaderMotion before={before} after={after} frame={frame} frames={frames}/>;
  if(!isRendering&&previewShaderUnavailableReason())return motion;
  if(!isRendering)return <PreviewShaderBoundary before={before} after={after} frame={frame} frames={frames}><RealShader before={before} after={after} name={name} params={params} frames={frames}/></PreviewShaderBoundary>;
  return <RealShader before={before} after={after} name={name} params={params} frames={frames}/>;
}
