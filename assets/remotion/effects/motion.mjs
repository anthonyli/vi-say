// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

export const clamp = value => Math.max(0, Math.min(1, value));
export const lerp = (a, b, p) => a + (b - a) * p;
export const ease = value => {const p=clamp(value); return p*p*p*(10+p*(-15+6*p));};
export const progress = (time, at=0, seconds=.65) => ease((time-at)/seconds);
export const pop = (time, at=0, seconds=.7) => {const p=clamp((time-at)/seconds); return 1-Math.exp(-7*p)*Math.cos(10*p);};

export function sampleBotMotion(time, action='idle', phase=0, compression=0) {
  const cycle=((time-phase)%3.25+3.25)%3.25;
  const hopping=['hop','work','celebrate'].includes(action);
  const launch=hopping&&cycle<.95?Math.sin(Math.PI*cycle/.95):0;
  const impact=hopping?Math.exp(-(((cycle-1.02)/.12)**2)):0;
  const anticipation=hopping?Math.exp(-(((cycle-3.1)/.10)**2)):0;
  const scaleY=1+.18*launch-.20*impact-.10*anticipation-.14*clamp(compression);
  const peek=action==='peek'?Math.sin(time*1.7+phase)*9:0;
  const head=action==='look'?Math.sin(time*1.8+phase)*10:Math.sin(time*1.2+phase)*2;
  return {
    x:action==='nudge'?Math.sin(Math.PI*clamp((time-phase)/.55))*25:0,
    y:-launch*62,scaleY,scaleX:1/Math.sqrt(scaleY),
    angle:(action==='work'?-8*Math.sin(time*2+phase):head+peek)+(action==='spin'?360*ease((time-phase)/.7):0),
    eyeX:(action==='peek'?9:5)*Math.sin(time*.9+phase),
    blink:1-.94*Math.max(0,1-Math.abs(((time+phase)%4.2)-3.8)/.075),
    shadowX:1-launch*.35,shadowY:1-launch*.2,
  };
}

/** A pose is sampled from time, so seeking backwards has no hidden state. */
export function trackPose(effect, time) {
  const initial={position:effect.position??[0,0],size:effect.size??160,angle:effect.angle??0,compression:effect.compression??0};
  let before={at:0,...initial};
  for (const frame of effect.keyframes??[]) {
    const after={...before,...frame};
    if (time<frame.at) {
      const p=progress(time,before.at,frame.at-before.at);
      return {position:before.position.map((v,i)=>lerp(v,after.position[i],p)),size:lerp(before.size,after.size,p),angle:lerp(before.angle,after.angle,p),compression:lerp(before.compression,after.compression,p)};
    }
    before=after;
  }
  return before;
}

export function actorPose(effect, previous, time) {
  const target=trackPose(effect,time);
  if (!previous) return target;
  const p=progress(time,effect.at??0,effect.travelSeconds??.95);
  return {...target,position:target.position.map((v,i)=>lerp(previous.position[i],v,p))
    .map((v,i)=>i===1?v-Math.sin(Math.PI*p)*(effect.arc??85):v),size:lerp(previous.size,target.size,p)};
}

export function actionAt(effect, time) {
  const action=(effect.actions??[]).find(a=>time>=a.at&&time<a.at+a.duration);
  return action?{name:action.name,time:time-action.at,hideLabel:action.hideLabel??false}
    :{name:effect.action??'look',time:time-(effect.at??0),hideLabel:false};
}

export function flowState(effect, time) {
  return {gather:progress(time,effect.gatherAt,effect.gatherSeconds??1.05),
    summary:progress(time,effect.summaryAt,effect.summarySeconds??.65),
    send:progress(time,effect.sendAt,effect.sendSeconds??1.1)};
}

export function counterValue(effect,time) {
  const p=progress(time,effect.at??0,effect.seconds??1.5);
  if(p>=1)return effect.value;
  const value=lerp(effect.from??0,effect.value,p);
  return Number.isInteger(effect.value)?Math.round(value):Number(value.toPrecision(4));
}

export function routePoint(points, time, at=0, seconds=4, loop=false) {
  const age=Math.max(0,time-at);
  const p=loop?(age%seconds)/seconds:clamp(age/seconds);
  const segment=Math.min(points.length-2,Math.floor(p*(points.length-1)));
  const q=ease(p*(points.length-1)-segment),a=points[segment],b=points[segment+1];
  return [lerp(a[0],b[0],q),lerp(a[1],b[1],q)-Math.sin(Math.PI*q)*60];
}

export function effectTimes(effect) {
  const at=effect.at??0;
  if (effect.type==='flow') return [effect.gatherAt,effect.gatherAt+(effect.gatherSeconds??1.05),effect.summaryAt+(effect.summarySeconds??.65),effect.sendAt+(effect.sendSeconds??1.1)];
  if (effect.type==='route') return [at,at+(effect.seconds??4)/2,at+(effect.seconds??4)];
  if (effect.type==='pointer') return effect.points.map(p=>p.at+.1);
  if (effect.type==='list') return effect.items.map(item=>item.at+.55);
  if (effect.type==='focus') return effect.events.map(e=>e.at+.15);
  if (effect.type==='connection'||effect.type==='counter') return [at,at+(effect.seconds??1.5)/2,at+(effect.seconds??1.5)];
  return [at+.35,...(effect.actions??[]).map(a=>a.at+Math.min(a.duration/2,.7)),...(effect.keyframes??[]).map(k=>k.at)];
}
