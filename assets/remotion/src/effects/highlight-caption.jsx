// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {ComicCaptions} from '../comic-captions';

export function HighlightCaption({text, cue = {text}, options = {}}) {
  return <ComicCaptions caption={cue} options={{
    ...options,
    stripPunctuation: options.stripPunctuation ?? false,
    bilingual: options.bilingual ?? Boolean(cue.en),
  }}/>;
}
