// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React, {useId} from 'react';
import styles from '../../../production/bot-styles.json';
import {sampleBotMotion} from '../../effects/motion.mjs';

export function PlayfulBot({position=[0,0],size=160,variant='pentagon',time=0,phase=0,label,action='look',compression=0,angle=0,color}) {
  const unique=useId().replace(/[^a-z\d]/gi,'');
  const skin=styles[variant];
  if(!skin)throw new Error(`Unknown bot variant: ${variant}`);
  const k=skin.eyeKind,m=sampleBotMotion(time,action,phase,compression),gradient=`toy-${unique}`;
  return <div style={{position:'absolute',left:position[0],top:position[1],width:size,height:size,zIndex:12}}>
    <div style={{position:'absolute',left:'16%',right:'12%',bottom:-5,height:18,borderRadius:'50%',background:'#18374c22',filter:'blur(7px)',transform:`scale(${m.shadowX},${m.shadowY})`}}/>
    <div style={{width:'100%',height:'100%',transform:`translate(${m.x}px,${m.y}px) rotate(${m.angle+angle}deg) scale(${m.scaleX},${m.scaleY})`,transformOrigin:'50% 92%'}}>
      <svg width="100%" height="100%" viewBox="0 0 220 195">
        <defs><linearGradient id={gradient} x1=".1" y1="0" x2=".9" y2="1"><stop stopColor={color??skin.color}/><stop offset=".72" stopColor={color??skin.color}/><stop offset="1" stopColor={color?`color-mix(in srgb, ${color} 85%, #183a56)`:skin.shadow}/></linearGradient></defs>
        <path d={skin.path} fill={`url(#${gradient})`} stroke="#ffffff55" strokeWidth="1.4"/>
        {k===0?<g transform={`translate(${m.eyeX} 0) translate(0 88) scale(1 ${m.blink}) translate(0 -88)`}><ellipse cx="76" cy="86" rx="8" ry="6" fill="#1b2024"/><ellipse cx="131" cy="86" rx="8" ry="6" fill="#1b2024"/></g>
          :<g transform={`translate(${m.eyeX} 0) rotate(${k===1?-27:k===2?-16:k===3?22:0} 124 72) translate(0 72) scale(1 ${m.blink}) translate(0 -72)`}>
            {k===4?<><ellipse cx="105" cy="78" rx="11" ry="10" fill="#fff"/><ellipse cx="144" cy="68" rx="9" ry="8" fill="#fff"/></>:<>
              <rect x={k===3?94:108} y={k===3?65:44} width="15" height={k===1?23:33} rx="8" fill="#fff"/>
              <rect x={k===3?125:144} y={k===3?65:44} width="15" height={k===1?23:33} rx="8" fill="#fff"/>
            </>}
          </g>}
      </svg>
    </div>
    {label&&<div style={{position:'absolute',top:size+12,left:-60,right:-60,textAlign:'center',fontSize:21,fontWeight:800,color:'#214765'}}>{label}</div>}
  </div>;
}
