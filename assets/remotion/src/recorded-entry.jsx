// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {RecordedComic} from './recorded-comic';
registerRoot(()=> <Composition id="RecordedComic" component={RecordedComic}
 width={1920} height={1200} fps={30} durationInFrames={30}
 calculateMetadata={({props})=>({durationInFrames:Math.ceil(props.duration*30)})}/>);
