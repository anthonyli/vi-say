// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React,{useContext} from 'react';
import {COMIC_PALETTE} from '../../effects/comic-motion.mjs';

/**
 * Which surface the shared effect primitives draw. Cards, platforms, paths,
 * lists and counters read it, so one effect library renders as outlined comic
 * bricks in the comic theme and as glass elsewhere — never mixed in one video.
 */
export const Surface=React.createContext('glass');
export const useComic=()=>useContext(Surface)==='comic';
export const INK=COMIC_PALETTE.ink;
export const COMIC_ACCENTS=[COMIC_PALETTE.blue,COMIC_PALETTE.red,COMIC_PALETTE.purple,COMIC_PALETTE.yellow];
/** Glass hues mapped to their comic counterparts, so authored colours stay meaningful. */
export function comicColor(color,index=0){
  const map={'#287fa3':COMIC_PALETTE.blue,'#bc657b':COMIC_PALETTE.red,'#8670b9':COMIC_PALETTE.purple,'#6e963d':'#7fd36e'};
  return map[color?.toLowerCase?.()]??color??COMIC_ACCENTS[index%COMIC_ACCENTS.length];
}
export const comicPanel=(extra={})=>({background:COMIC_PALETTE.white,border:`5px solid ${INK}`,borderRadius:10,boxShadow:`8px 9px 0 ${INK}`,...extra});
