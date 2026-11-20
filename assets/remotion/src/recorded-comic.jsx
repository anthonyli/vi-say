// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {AbsoluteFill,Audio,Img,Freeze,OffthreadVideo,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Frame,Bubble,Brick,Dots,RayBurst,COMIC_PALETTE as C} from './comic-kit';
import {ComicCaptions} from './comic-captions';
import GLScenePair from './gl-transition';

export function recordedMetadata({duration}) {
 return {width:1920,height:1200,fps:30,durationInFrames:Math.ceil(duration*30)};
}

// Recorded footage stays continuous. Title, cues and keywords are episode inputs.
// Canvas: 1920 x 1200. No implicit speed changes or injected audio gaps.
export function RecordedComic({title,cover,video,videoFrames,coverFrames,audio,captions,keywords,keywordsEn,steps,duration,captionOptions={}}){
 const f=useCurrentFrame(),t=f/30;
 const config=useVideoConfig();
 if(config.fps!==30||config.width!==1920||config.height!==1200)throw new Error("RecordedComic requires 1920x1200 at 30fps");
 if(["keywords","keywordsEn","bilingual"].some(k=>k in captionOptions))throw new Error("captionOptions only controls appearance");
 if(!cover?.title||!coverFrames)throw new Error('RecordedComic requires an opening cover');
 if(!keywords?.length)throw new Error('RecordedComic requires episode caption keywords');
 const cue=captions.find(c=>t>=c.start&&t<c.end);
 const active=Math.max(0,steps.findLastIndex(s=>t>=s.start));
 const panel=i=><AbsoluteFill style={{background:C.cream}}><Dots/><Bubble x={18} y={32} w={342} h={220} fontSize={34} fill={[C.yellow,C.blue,C.purple,C.red][i%4]}><span style={{whiteSpace:"pre-line"}}>{steps[i].label}</span></Bubble><div style={{position:'absolute',top:310,left:28,right:24,fontSize:25,fontWeight:800,lineHeight:1.6,whiteSpace:"pre-line"}}>{steps[i].detail}</div></AbsoluteFill>;
 return <AbsoluteFill style={{background:C.cream,color:C.ink,fontFamily:'PingFang SC'}}><Dots/>
 {f<coverFrames&&cover.image?<AbsoluteFill style={{background:'#FFE600'}}><Img src={staticFile(cover.image)} style={{width:'100%',height:'100%',objectFit:'contain'}}/></AbsoluteFill>:f<coverFrames?<AbsoluteFill style={{background:C.yellow}}><RayBurst/><Dots opacity={.09}/><div style={{position:'absolute',left:110,top:170,width:1060,fontSize:112,fontWeight:950,lineHeight:1.28,whiteSpace:'pre-line',textShadow:'6px 6px 0 white'}}>{cover.title}</div><Bubble x={1180} y={150} w={590} h={210} fontSize={51} fill={C.white}><span style={{whiteSpace:"pre-line"}}>{cover.subtitle}</span></Bubble>{cover.bricks.map((s,i)=><Brick key={i} x={1160-i*30} y={790-i*145} w={570} h={110} text={s} color={[C.blue,C.red,C.purple][i%3]} at={i*.35} t={t} angle={-5+i*4}/>)}<div style={{position:'absolute',left:120,top:730,fontSize:37,fontWeight:850,background:C.purple,padding:'18px 32px',border:`5px solid ${C.ink}`,boxShadow:`9px 9px 0 ${C.ink}`}}>{cover.tag}</div></AbsoluteFill>:<>
 <div style={{position:'absolute',left:32,top:26,fontSize:44,fontWeight:950}}>{title}</div>
 <Frame x={25} y={100} w={1430} h={930} fill={C.white} style={{boxSizing:'content-box'}}><Sequence from={coverFrames}>{f-coverFrames<videoFrames?<OffthreadVideo src={staticFile(video)} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<Freeze frame={videoFrames-1}><OffthreadVideo src={staticFile(video)} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Freeze>}</Sequence></Frame>
 <div style={{position:'absolute',left:1535,top:115,width:380,height:510,overflow:'hidden'}}>{steps.map((s,i)=><Sequence key={i} from={Math.round(s.start*30)} durationInFrames={Math.max(1,Math.round(((steps[i+1]?.start??duration)-s.start)*30))}>{i?<GLScenePair name={s.transition??'gl:CrossZoom'} params={s.params} frames={18} before={panel(i-1)} after={panel(i)}/>:panel(i)}</Sequence>)}</div>
 {steps.slice(Math.max(0,active-3),active+1).map((s,i)=><Brick key={i} x={1540} y={930-i*104} w={325} h={78} text={s.brick} small color={[C.yellow,C.blue,C.purple,C.red][i]} at={s.start} t={t} angle={i%2?5:-5}/>)}
 </>}
 <ComicCaptions caption={cue} options={{keywords,keywordsEn,bilingual:true,...captionOptions}}/>
 <Audio src={staticFile(audio)}/>
 </AbsoluteFill>;
}
