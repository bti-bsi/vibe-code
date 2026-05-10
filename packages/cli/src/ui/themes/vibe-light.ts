/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const vibeLightColors: ColorsTheme = {
  type: 'light',
  Background: '#FFF8E7',
  Foreground: '#241805',
  LightBlue: '#D4A63A',
  AccentBlue: '#F2C14E',
  AccentPurple: '#FFD76A',
  AccentCyan: '#C69214',
  AccentGreen: '#8E7A1C',
  AccentYellow: '#B8860B',
  AccentRed: '#f07171',
  AccentYellowDim: '#7A5A08',
  AccentRedDim: '#993333',
  DiffAdded: '#F4E7A1',
  DiffRemoved: '#f07171',
  Comment: '#8C6A22',
  Gray: '#A88A44',
  GradientColors: ['#7A5600', '#D4A63A', '#FFE8A3'],
};

export const VibeLight: Theme = new Theme(
  'Vibe Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: vibeLightColors.Background,
      color: vibeLightColors.Foreground,
    },
    'hljs-comment': {
      color: vibeLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: vibeLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: vibeLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: vibeLightColors.AccentCyan,
    },
    'hljs-number': {
      color: vibeLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: vibeLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: vibeLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: vibeLightColors.AccentBlue,
    },
    'hljs-section': {
      color: vibeLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: vibeLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: vibeLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: vibeLightColors.LightBlue,
    },
    'hljs-name': {
      color: vibeLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: vibeLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: vibeLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: vibeLightColors.AccentCyan,
    },
    'hljs-link': {
      color: vibeLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: vibeLightColors.AccentRed,
    },
    'hljs-addition': {
      color: vibeLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: vibeLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: vibeLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: vibeLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: vibeLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: vibeLightColors.AccentRed,
    },
  },
  vibeLightColors,
  lightSemanticColors,
);
