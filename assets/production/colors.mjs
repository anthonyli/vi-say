// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import style from './style.json' with {type:'json'};
// A set of allowed colors, with descriptive names only: no status/risk semantics.
export const PALETTE=Object.freeze({...style.palette});
export const ALLOWED_COLORS=Object.freeze(Object.values(PALETTE));
