// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React,{useContext} from 'react';
import {ComicTheme} from './comic-kit';
import {captionSegments} from '../effects/captions.mjs';

// Keywords are episode data. Both languages share one measured cue interval.
export function ComicCaptions({caption,options={}}){
 const C=useContext(ComicTheme);
 if(!caption)return null;
 const bilingual=options.bilingual??true;
 if(bilingual&&!caption.en?.trim())throw new Error('Bilingual caption requires an English translation');
 const line=(text,keywords,stripPunctuation=false)=>captionSegments(text,{stripPunctuation,keywords,protectedTerms:options.protectedTerms??[]}).map((part,i)=><span key={i} style={part.highlight?{color:options.highlightColor??'#a82920',fontWeight:900,background:options.highlightBackground??'#ffe18c',borderRadius:4,padding:'0 3px'}:undefined}>{part.text}</span>);
 return <div style={{position:'absolute',bottom:options.bottom??42,left:100,right:100,textAlign:'center',zIndex:500,pointerEvents:'none'}}>
 <div style={{display:'inline-block',maxWidth:'100%',color:C.ink,background:C.cream,padding:options.padding??'9px 28px',border:`${options.borderWidth??4}px solid ${C.ink}`,borderRadius:options.borderRadius??14,boxShadow:options.shadow??`6px 7px 0 ${C.ink}`}}>
 <div lang="zh" style={{fontSize:options.fontSize??38,fontWeight:800,lineHeight:options.lineHeight??1.3,overflowWrap:'break-word'}}>{line(caption.text,caption.keywords??options.keywords??[],options.stripPunctuation??true)}</div>
 {bilingual&&<div lang="en" style={{fontSize:options.fontSizeEn??25,fontWeight:600,lineHeight:options.lineHeight??1.3,marginTop:options.lineGap??5,overflowWrap:'normal'}}>{line(caption.en,caption.keywordsEn??options.keywordsEn??[])}</div>}
 </div></div>;
}
