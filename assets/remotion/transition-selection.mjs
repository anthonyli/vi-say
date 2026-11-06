// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {TRANSITION_NAMES,canonicalTransition,validateTransitionPool} from './cartoon-transitions.mjs';

// Preferences rank the unused effects; they never remove effects from a cycle.
export const SCENE_TRANSITION_GROUPS=Object.freeze({
  continuity:['gl:Fade','wipe','slide'],
  detail:['gl:CrossZoom','gl:DreamyZoom','gl:CrossWarp','radial','gl:CircleIris'],
  document:['gl:BookFlip','gl:InvertedPageCurl','flip'],
  spatial:['gl:Cube','gl:Doorway','gl:Swap','gl:DirectionalWarp'],
  structure:['converge','gl:GridFlip','gl:WindowSlices','gl:Mosaic','gl:BowTieHorizontal'],
  data:['gl:WindowSlices','gl:WindowBlinds','gl:GridFlip','gl:Mosaic','wipe'],
  digital:['gl:GlitchMemories','gl:GlitchDisplace','gl:Pixelize','gl:Hexagonalize'],
  organic:['gl:WaterDrop','gl:Ripple','gl:Swirl','gl:Morph','gl:InkBleed','gl:Wind'],
  chapter:['gl:StarWipe','gl:PolkaDotsCurtain','gl:BurnThrough','gl:FilmBurn'],
});
const TEXT_RULES={
  continuity:/继续|延续|接着|保持|衔接|总结|回顾|\b(continue|continuity|recap|summary)\b/i,
  detail:/细节|聚焦|放大|特写|推近|局部|深入|\b(detail|focus|zoom|close[- ]?up)\b/i,
  document:/文档|报告|档案|翻页|阅读|论文|书页|\b(document|report|dossier|page|paper|pdf)\b/i,
  spatial:/空间|立体|旋转|进入|穿过|镜头|\b(space|spatial|rotate|rotation|enter|camera|3d)\b/i,
  structure:/流程|关系|节点|结构|汇聚|合并|分流|编排|\b(flow|network|node|structure|merge|workflow)\b/i,
  data:/数据|图表|指标|统计|对比|趋势|仪表盘|\b(data|chart|metric|compare|trend|dashboard)\b/i,
  digital:/故障|报错|错误|代码|像素|数字化|扫描|\b(glitch|error|code|pixel|digital|scan)\b/i,
  organic:/液体|水滴|波纹|涟漪|漩涡|墨迹|形变|流体|\b(liquid|water|ripple|swirl|ink|morph|fluid)\b/i,
  chapter:/章节|新篇|新主题|下一节|开场|揭幕|\b(chapter|section|opening|reveal)\b/i,
};
const EFFECT_INTENTS={focus:'detail',document:'document',chart:'data',counter:'data',scan:'digital',
  network:'structure',flow:'structure',connection:'structure',route:'structure','panel-merge':'structure','node-editor':'structure'};

export function sceneTransitionIntents(previous,scene){
  const weights=new Map();
  const add=(intent,weight)=>weights.set(intent,Math.max(weights.get(intent)??0,weight));
  const text=[scene.title,scene.subtitle,scene.kicker,scene.label,
    ...(scene.items??[]).flatMap(item=>[item.text,item.detail])].filter(v=>typeof v==='string').join(' ');
  for(const [intent,pattern] of Object.entries(TEXT_RULES))if(pattern.test(text))add(intent,100);
  for(const effect of scene.effects??[])if(EFFECT_INTENTS[effect.type])add(EFFECT_INTENTS[effect.type],120);
  if(scene.kind==='cta')add('continuity',130);
  if(scene.kind==='demo')add('detail',20);
  if(scene.kind==='steps')add('structure',20);
  if(previous&&((scene.image&&scene.image===previous.image)||(scene.video&&scene.video===previous.video)))add('continuity',90);
  return [...weights].map(([intent,weight])=>({intent,weight})).sort((a,b)=>b.weight-a.weight);
}

export function shuffledTransitionPool(seed='dragon-series',pool=TRANSITION_NAMES){
  const kinds=[...validateTransitionPool(pool)];let hash=2166136261;
  for(const c of seed)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  for(let i=kinds.length-1;i>0;i--){hash=(Math.imul(hash,1664525)+1013904223)>>>0;const j=hash%(i+1);[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}
  return kinds;
}

/** Plan in chronological order once, independent of render-worker/frame order. */
export function selectSceneTransitions(doc,pool=TRANSITION_NAMES){
  const scenes=doc.cartoonScenes??[];
  const ordered=shuffledTransitionPool(doc.transitionSeed??scenes[0]?.title??'dragon-series',pool);
  const fresh=()=>new Map(ordered.map(name=>[canonicalTransition(name),name]));
  let remaining=fresh(),cycle=1,last;
  return scenes.map((scene,index)=>{
    if(!index)return {name:scene.transition??'converge'};
    if(!remaining.size){remaining=fresh();cycle++;}
    if(scene.transition!==undefined){
      last=canonicalTransition(scene.transition);remaining.delete(last);
      return {name:scene.transition,...(scene.transitionSelection?{selection:scene.transitionSelection}:{})};
    }
    const intents=sceneTransitionIntents(scenes[index-1],scene);
    const candidates=[...remaining].filter(([name])=>remaining.size===1||name!==last).map(([canonical,name])=>{
      const match=intents.find(({intent})=>SCENE_TRANSITION_GROUPS[intent].includes(canonical));
      return {canonical,name,match,score:match?.weight??0};
    });
    // Stable sorting leaves the seeded order in place for equal relevance.
    candidates.sort((a,b)=>b.score-a.score);
    const chosen=candidates[0];remaining.delete(chosen.canonical);last=chosen.canonical;
    return {name:chosen.name,selection:{source:chosen.match?'scene':'rotation',
      ...(chosen.match?{intent:chosen.match.intent}:{}),cycle}};
  });
}
