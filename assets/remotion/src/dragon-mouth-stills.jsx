// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {DragonMouth} from './dragon-mouth';
import geometry from '../../production/dragon-mouth-shapes.json';

function MouthStill({cue='X'}) {
  return <AbsoluteFill><DragonMouth x={0} y={0} w={geometry.imageSize[0]} time={1} cues={[{start:0,end:2,value:cue}]}/></AbsoluteFill>;
}

registerRoot(()=><Composition id="DragonMouth" component={MouthStill} width={geometry.imageSize[0]} height={geometry.imageSize[1]} fps={30} durationInFrames={1} defaultProps={{cue:'X'}}/>);
