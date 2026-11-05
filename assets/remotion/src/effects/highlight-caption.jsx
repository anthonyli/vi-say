// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {captionSegments} from '../../effects/captions.mjs';

export function HighlightCaption({text,options={}}) {
  return <div style={{position:'absolute',left:260,right:260,bottom:70,zIndex:40,textAlign:'center'}}>
    <div style={{display:'inline-block',maxWidth:'100%',fontSize:36,fontWeight:700,lineHeight:1.5,color:'#fff',padding:'10px 25px',borderRadius:13,background:'#050914ed',border:'1px solid #d4dffd22',boxShadow:'0 4px 16px #0005',whiteSpace:'pre-wrap'}}>
      {captionSegments(text,options).map((part,i)=><span key={i} style={part.highlight?{color:'#ffe18c',fontWeight:900,textShadow:'0 0 14px #eab55420'}:undefined}>{part.text}</span>)}
    </div>
  </div>;
}
