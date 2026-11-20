// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {captionSegments} from '../effects/captions.mjs';

export function ComicCaptions({caption, options = {}}) {
  if (!caption) return null;
  const bilingual = options.bilingual ?? true;
  if (bilingual && !caption.en?.trim()) throw new Error('Bilingual caption requires an English translation');

  const highlight = {
    color: options.highlightColor ?? '#ffe18c', fontWeight: 900,
    textShadow: '0 0 14px #eab55420', background: options.highlightBackground,
  };
  function line(text, keywords, stripPunctuation = false) {
    return captionSegments(text, {stripPunctuation, keywords, protectedTerms: options.protectedTerms})
      .map((part, i) => <span key={i} style={part.highlight ? highlight : undefined}>{part.text}</span>);
  }
  return <div style={{position:'absolute', bottom:options.bottom ?? 70, left:'13.5%', right:'13.5%',
    textAlign:'center', zIndex:500, pointerEvents:'none'}}>
    <div style={{display:'inline-block', maxWidth:'100%', background:'#050914ed', color:'#fff',
      padding:options.padding ?? '10px 25px', border:`${options.borderWidth ?? 1}px solid #d4dffd22`,
      borderRadius:options.borderRadius ?? 13, boxShadow:options.shadow ?? '0 4px 16px #0005', whiteSpace:'pre-wrap'}}>
      <div lang="zh" style={{fontSize:options.fontSize ?? 36, fontWeight:700, lineHeight:options.lineHeight ?? 1.5}}>
        {line(caption.text, caption.keywords ?? options.keywords, options.stripPunctuation ?? true)}
      </div>
      {bilingual && <div lang="en" style={{fontSize:options.fontSizeEn ?? 26, fontWeight:600,
        lineHeight:options.lineHeight ?? 1.3, marginTop:options.lineGap ?? 2}}>
        {line(caption.en, caption.keywordsEn ?? options.keywordsEn)}
      </div>}
    </div>
  </div>;
}
