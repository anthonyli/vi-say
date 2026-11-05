// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Add implemented effects here. The default rotation pool lives in style.json.
// Each effect receives eased progress; timing and completion are owned by motion.
export const BUSINESS_TRANSITIONS = Object.freeze({
  converge: p => ({opacity:p,clipPath:`inset(${(1-p)*40}% ${(1-p)*35}% round ${24*(1-p)}px)`}),
  focus: p => ({opacity:p,transform:`scale(${1.13-.13*p})`,filter:`blur(${(1-p)*6}px)`}),
  handoff: p => ({clipPath:`inset(0 0 0 ${(1-p)*100}%)`,transform:`translateX(${(1-p)*480}px)`,filter:`blur(${(1-p)*4}px)`}),
  zoom: p => ({opacity:p,transform:`scale(${.78+.22*p})`,filter:`blur(${(1-p)*9}px)`}),
  evidence: p => ({opacity:p,transform:`perspective(2400px) rotateY(${(1-p)*-4}deg) scale(${.96+.04*p})`,filter:`blur(${(1-p)*3}px)`}),
  report: p => ({opacity:p,transform:`perspective(2500px) rotateY(${(1-p)*-8}deg) translateY(${(1-p)*160}px)`,transformOrigin:'50% 100%'}),
  merge: p => ({opacity:p,transform:`scale(${1.1-.1*p})`,filter:`blur(${(1-p)*5}px)`}),
  iris: p => ({clipPath:`circle(${p*125}% at 50% 46%)`}),
});
export const CARTOON_TRANSITIONS = Object.freeze({
  ...BUSINESS_TRANSITIONS,
  slide: p => ({transform: `translateX(${(1-p)*1920}px)`}),
  radial: p => ({clipPath: `circle(${p*150}% at 70% 55%)`}),
  wipe: p => ({clipPath: `inset(0 ${(1-p)*100}% 0 0)`}),
  flip: p => ({transform: `perspective(2400px) rotateY(${(1-p)*90}deg)`,
    transformOrigin: 'left center', backfaceVisibility: 'hidden'}),
});

export const hasCartoonTransition = name => typeof name === 'string' && Object.hasOwn(CARTOON_TRANSITIONS, name);

export function validateTransitionPool(names) {
  if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length ||
      names.some(name => !hasCartoonTransition(name))) {
    throw new Error('Cartoon transition pool must contain unique implemented effect names');
  }
  return names;
}
