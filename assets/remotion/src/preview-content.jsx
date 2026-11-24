// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import {MotionVideo, videoMetadata} from './video';
import {RecordedComic, recordedMetadata} from './recorded-comic';
import {previewShaderUnavailableReason} from './gl-transition';
import {sceneTransitionSettings} from '../cartoon-motion.mjs';
import {isGLTransition} from '../gl-transitions.mjs';

function usesShader(doc, isRecorded) {
  if (isRecorded) return (doc.steps ?? []).some((step, index) => index > 0 && isGLTransition(step.transition ?? 'gl:CrossZoom'));
  return (doc.cartoonScenes ?? []).some((scene, index) => index > 0 &&
    isGLTransition(sceneTransitionSettings(scene, index, doc).name));
}

export default function previewContent({props, recorded}) {
  return {
    component: recorded ? RecordedComic : MotionVideo,
    inputProps: props,
    meta: recorded ? recordedMetadata(props) : videoMetadata(props),
    captions: props.captions,
    title: props.podcast?.title,
    shaderUnavailable: usesShader(props, recorded) ? previewShaderUnavailableReason() : null,
  };
}
