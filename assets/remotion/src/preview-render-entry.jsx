// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import {Composition, getInputProps, registerRoot} from 'remotion';

// Set up the same data that timeline.js supplies before loading a custom module.
// Some existing compositions read this value during module initialization.
const preview = getInputProps();
window.viSayPreview = preview;
const factory = require('vi-say-preview-composition').default;
const {component, inputProps, meta} = factory(preview);

registerRoot(() => <Composition id="ApprovedPreview" component={component}
  defaultProps={inputProps} {...meta}/>);
