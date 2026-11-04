// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Add implemented effects here. The default rotation pool lives in style.json.
// Each effect receives eased progress; timing and completion are owned by motion.
export const CARTOON_TRANSITIONS = Object.freeze({
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
