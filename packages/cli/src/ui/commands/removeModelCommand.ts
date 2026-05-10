/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpenDialogActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { t } from '../../i18n/index.js';

export const removeModelCommand: SlashCommand = {
  name: 'remove-model',
  get description() {
    return t('Remove a saved model configuration from settings.json');
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ['interactive'] as const,
  action: (): OpenDialogActionReturn => ({
    type: 'dialog',
    dialog: 'remove-model',
  }),
};
