// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import {MotionVideo, videoMetadata} from './video';
import {RecordedComic, recordedMetadata} from './recorded-comic';
import {previewShaderUnavailableReason} from './gl-transition';
import {sceneTransitionSettings} from '../cartoon-motion.mjs';
import {captionAtTime, firstCaptionFrame} from '../effects/captions.mjs';
import {isGLTransition} from '../gl-transitions.mjs';

window.remotion_staticBase = new URL('media', window.location.href).pathname.replace(/\/$/, '');
const preview = window.viSayPreview;
if (!preview?.props) throw new Error('预览缺少 timeline.js');
const {props, recorded} = preview;

function clock(frames, fps) {
  const seconds = Math.max(0, Math.round(frames / fps));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function secondsLabel(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function usesShader(doc, isRecorded) {
  if (isRecorded) return (doc.steps ?? []).some((step, index) => index > 0 && isGLTransition(step.transition ?? 'gl:CrossZoom'));
  return (doc.cartoonScenes ?? []).some((scene, index) => index > 0 &&
    isGLTransition(sceneTransitionSettings(scene, index, doc).name));
}

const shaderUnavailable = usesShader(props, recorded) ? previewShaderUnavailableReason() : null;

function ReviewPlayer() {
  const playerRef = useRef(null);
  const frameRef = useRef(0);
  const lastAudibleVolume = useRef(1);
  const meta = recorded ? recordedMetadata(props) : videoMetadata(props);
  const captions = props.captions ?? [];
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  frameRef.current = frame;
  const cue = captionAtTime(captions, frame / meta.fps);
  const soundOff = muted || volume === 0;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return undefined;
    const onFrame = event => setFrame(event.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = event => {
      const next = event.detail.volume;
      if (next > 0) lastAudibleVolume.current = next;
      setVolume(next);
    };
    const onMute = event => setMuted(event.detail.isMuted);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onPause);
    player.addEventListener('volumechange', onVolume);
    player.addEventListener('mutechange', onMute);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onPause);
      player.removeEventListener('volumechange', onVolume);
      player.removeEventListener('mutechange', onMute);
    };
  }, []);

  const toggle = event => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) player.pause();
    else player.play(event);
  };
  const seekTo = next => {
    const target = Math.min(meta.durationInFrames - 1, Math.max(0, next));
    setFrame(target);
    playerRef.current?.seekTo(target);
  };

  const toggleSound = () => {
    const player = playerRef.current;
    if (!player) return;
    if (soundOff) {
      if (volume === 0) player.setVolume(lastAudibleVolume.current);
      player.unmute();
    } else {
      player.mute();
    }
  };

  useEffect(() => {
    const onKey = event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (event.code === 'Space') {
        event.preventDefault();
        const player = playerRef.current;
        if (!player) return;
        if (player.isPlaying()) player.pause();
        else player.play(event);
      } else if (event.code === 'ArrowRight') seekTo(frameRef.current + meta.fps);
      else if (event.code === 'ArrowLeft') seekTo(frameRef.current - meta.fps);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meta.durationInFrames, meta.fps]);

  return <main data-preview="synced-playback">
    <h1>{props.podcast?.title ?? '视频预览'}</h1>
    {shaderUnavailable
      ? <p className="warn">当前浏览器无法使用 {shaderUnavailable}，前审以叠化代替 shader 转场。</p>
      : null}
    <div className="stage" style={{aspectRatio: `${meta.width} / ${meta.height}`, width: `min(100%, calc((100vh - 280px) * ${meta.width} / ${meta.height}))`}}
      onClick={toggle}>
      <Player ref={playerRef} component={recorded ? RecordedComic : MotionVideo} inputProps={props}
        compositionWidth={meta.width} compositionHeight={meta.height}
        fps={meta.fps} durationInFrames={meta.durationInFrames}
        controls={false} clickToPlay={false} spaceKeyToPlayOrPause={false}
        initiallyMuted={false} initialVolume={1} acknowledgeRemotionLicense
        numberOfSharedAudioTags={8}
        style={{width: '100%'}}
        errorFallback={({error}) => <p className="warn" role="alert">播放失败。{error.message}</p>}
        renderLoading={() => <p className="loading">正在准备画面和声音</p>}/>
      {props.podcast || playing ? null : <button type="button" className="play" onClick={event => { event.stopPropagation(); toggle(event); }}>
        播放
        <small>画面、字幕和口播一起开始</small>
      </button>}
    </div>
    <div className="transport">
      <button type="button" onClick={toggle}>{playing ? '暂停' : '播放'}</button>
      <span className="time">{clock(frame, meta.fps)} / {clock(meta.durationInFrames, meta.fps)}</span>
      <input aria-label="进度" type="range" min={0} max={Math.max(0, meta.durationInFrames - 1)} value={Math.min(frame, Math.max(0, meta.durationInFrames - 1))}
        onChange={event => seekTo(Number(event.target.value))}/>
      <button type="button" onClick={toggleSound}>{soundOff ? '打开声音' : '静音'}</button>
      <input aria-label="音量" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
        onChange={event => {
          const next = Number(event.target.value);
          setVolume(next);
          playerRef.current?.setVolume(next);
          if (next > 0 && muted) playerRef.current?.unmute();
        }}/>
      <button type="button" onClick={() => playerRef.current?.requestFullscreen()}>全屏</button>
    </div>
    {captions.length ? <details><summary>字幕导航</summary><ol className="cues">
      {captions.map((item, index) => {
        const target = firstCaptionFrame(item, meta.fps, meta.durationInFrames);
        return <li key={index} className={item === cue ? 'active' : undefined}>
          <button type="button" disabled={target === null} onClick={() => seekTo(target)}>
            <span>{secondsLabel(item.start)}</span>
            {item.text}
            {target === null && <small>无可显示帧</small>}
          </button>
        </li>;
      })}
    </ol></details> : null}
  </main>;
}

createRoot(document.getElementById('root')).render(<ReviewPlayer/>);
