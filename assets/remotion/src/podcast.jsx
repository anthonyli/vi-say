// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile,
  useCurrentFrame, useVideoConfig} from 'remotion';
import {podcastFrameAt} from '../podcast-contract.mjs';
import {defaultPodcastCalloutStyle, podcastCalloutStyles} from '../podcast-callout-styles.mjs';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};

function Shot({shot, source}) {
  const {fps} = useVideoConfig();
  const assetStyle = {width: '100%', height: '100%', display: 'block', objectFit: shot.video ? 'cover' : 'contain'};
  return <AbsoluteFill role={shot.label ? 'group' : undefined} aria-label={shot.label}>
    {shot.video
      ? <OffthreadVideo src={staticFile(shot.video)} trimBefore={Math.round((shot.videoStart ?? 0) * fps)}
        muted pauseWhenBuffering style={assetStyle}/>
      : <Img src={staticFile(shot.image)} style={assetStyle}/>}
    <div style={{position: 'absolute', bottom: 32, left: 44, maxWidth: 390, padding: '7px 12px',
      borderRadius: 6, background: '#0c1018e8', color: '#fff', fontSize: 19, lineHeight: 1.25,
      fontWeight: 600, overflowWrap: 'anywhere'}}>
      {shot.source ?? source}{shot.sourceTime && <span style={{whiteSpace: 'nowrap'}}> · {shot.sourceTime}</span>}
    </div>
  </AbsoluteFill>;
}

function Highlight({cue, frames, accent, theme}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ramp = Math.max(1, Math.min(Math.round(fps * .24), Math.floor(frames / 3)));
  const entry = interpolate(frame + 1, [0, ramp], [0, 1], clamp);
  const exit = interpolate(frames - frame, [0, ramp], [0, 1], clamp);
  const [vertical, horizontal] = (cue.position ?? 'top-right').split('-');
  const border = `${theme.borderWidth}px solid ${theme.border}`;
  return <div style={{position: 'absolute', [horizontal]: 64, [vertical]: vertical === 'top' ? 76 : 176,
    maxWidth: 560, width: 'max-content', boxSizing: 'border-box', padding: '20px 26px 22px',
    color: theme.foreground, background: theme.background, border, borderRadius: theme.radius,
    boxShadow: theme.shadow, overflowWrap: 'anywhere',
    transform: `translateY(${(1 - entry) ** 2 * 14}px)`, opacity: Math.min(entry, exit)}}>
    <span aria-hidden="true" style={{position: 'absolute', [horizontal]: 34, bottom: -8,
      width: 16, height: 16, background: theme.background, borderRight: border, borderBottom: border,
      transform: 'rotate(45deg)'}}/>
    <div style={{display: 'inline-block', borderRadius: 999, padding: '5px 13px 6px', fontSize: 24,
      background: theme.labelBackground ?? accent, color: theme.labelColor, fontWeight: 800,
      lineHeight: 1.15}}>{cue.label}</div>
    <div style={{marginTop: 10, fontSize: 42, lineHeight: 1.22, fontWeight: 900, textWrap: 'balance'}}>{cue.text}</div>
    {cue.detail && <div style={{marginTop: 9, color: theme.detail, fontSize: 25,
      lineHeight: 1.38}}>{cue.detail}</div>}
  </div>;
}

export function PodcastHighlights({doc}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {podcast} = doc;
  const accent = doc.accent ?? '#ffbc79';
  const theme = podcastCalloutStyles[podcast.calloutStyle ?? defaultPodcastCalloutStyle];
  const activeCue = podcast.highlights.find(({start, end}) =>
    frame >= podcastFrameAt(start, fps) && frame < podcastFrameAt(end, fps));
  return <AbsoluteFill style={{background: doc.bg ?? '#101318', overflow: 'hidden'}}>
    {podcast.shots.map(shot => <Sequence key={shot.start} from={podcastFrameAt(shot.start, fps)}
      premountFor={Math.round(fps * .5)} styleWhilePremounted={{opacity: 0}}
      durationInFrames={podcastFrameAt(shot.end, fps) - podcastFrameAt(shot.start, fps)}>
      <Shot shot={shot} source={podcast.source}/>
    </Sequence>)}
    {activeCue && <Sequence key={activeCue.start} from={podcastFrameAt(activeCue.start, fps)}
      durationInFrames={podcastFrameAt(activeCue.end, fps) - podcastFrameAt(activeCue.start, fps)}>
      <Highlight cue={activeCue} frames={podcastFrameAt(activeCue.end, fps) - podcastFrameAt(activeCue.start, fps)}
        accent={accent} theme={theme}/>
    </Sequence>}
    {doc.reviewBadgeVisible && <div style={{position: 'absolute', right: 44, top: 18,
      padding: '5px 11px', background: '#0c1018e8', color: '#fff', fontSize: 20, fontWeight: 700}}>未听审候选</div>}
  </AbsoluteFill>;
}
