// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function splitTerms(text, terms) {
  const unique=[...new Set(terms.filter(Boolean))].sort((a,b)=>b.length-a.length);
  return unique.length?text.split(new RegExp(`(${unique.map(escaped).join('|')})`,'gi')):[text];
}

export function captionText(text, options={}) {
  if (!options.stripPunctuation) return text;
  // Brand punctuation and English spaces survive display punctuation removal.
  const terms=[...(options.protectedTerms??[]),...(options.keywords??[])];
  return splitTerms(text,terms).map((part,i)=>i%2?part:part.replace(/\p{P}/gu,' '))
    .join('').replace(/[^\S\n]+/g,' ').trim();
}

export function captionSegments(text, options={}) {
  return splitTerms(captionText(text,options),options.keywords??[])
    .map((part,i)=>({text:part,highlight:Boolean(i%2)})).filter(part=>part.text.length);
}
