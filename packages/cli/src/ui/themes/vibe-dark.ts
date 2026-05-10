/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const vibeDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#050505',
  Foreground: '#F5E6B3',
  LightBlue: '#F6C453',
  AccentBlue: '#FFD166',
  AccentPurple: '#FFDF88',
  AccentCyan: '#D39A22',
  AccentGreen: '#C5A13A',
  AccentYellow: '#FFB800',
  AccentRed: '#F26D78',
  AccentYellowDim: '#8A6312',
  AccentRedDim: '#8B3A4A',
  DiffAdded: '#3A2D08',
  DiffRemoved: '#F26D78',
  Comment: '#8F7A3A',
  Gray: '#6E5A21',
  GradientColors: ['#050505', '#8A6312', '#FFD166'],
};

export const VibeDark: Theme = new Theme(
  'Vibe Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: vibeDarkColors.Background,
      color: vibeDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: vibeDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: vibeDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: vibeDarkColors.LightBlue,
    },
    'hljs-link': {
      color: vibeDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: vibeDarkColors.Foreground,
    },
    'hljs-string': {
      color: vibeDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: vibeDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: vibeDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: vibeDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: vibeDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: vibeDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: vibeDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: vibeDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  vibeDarkColors,
  darkSemanticColors,
);
