// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {glTransition} from '@gl-transitions/remotion';
import {useCurrentFrame} from 'remotion';
import {glOptions} from '../gl-transitions.mjs';

export default function GLScenePair({before,after,name,params,frames}){
  const frame=useCurrentFrame();
  // The two sequences overlap at local frame zero, preserving authored starts.
  // At completion return the live incoming scene, with no residual canvas.
  if(frame>=frames)return after;
  return <TransitionSeries>
    <TransitionSeries.Sequence durationInFrames={frames}>{before}</TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={glTransition(glOptions(name,params))} timing={linearTiming({durationInFrames:frames})}/>
    <TransitionSeries.Sequence durationInFrames={frames+1}>{after}</TransitionSeries.Sequence>
  </TransitionSeries>;
}
