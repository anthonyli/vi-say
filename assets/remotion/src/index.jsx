// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {MotionVideo, videoMetadata} from './video';

const Root = () =>
  <Composition id="NarratedVideo" component={MotionVideo}
    durationInFrames={30} fps={30} width={1920} height={1080}
    calculateMetadata={({props}) => videoMetadata(props)}/>;

registerRoot(Root);
