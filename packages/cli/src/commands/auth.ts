/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import {
  handleApiKeyAuth,
  showAuthStatus,
  handleGoogleAdcAuth,
} from './auth/handler.js';
import { t } from '../i18n/index.js';

const apiKeyCommand = {
  command: 'api-key',
  describe: t('Configure a custom API provider'),
  handler: async () => {
    await handleApiKeyAuth();
  },
};

const statusCommand = {
  command: 'status',
  describe: t('Show current authentication status'),
  handler: async () => {
    await showAuthStatus();
  },
};

const googleAdcCommand = {
  command: 'google-adc',
  describe: t('Authenticate using Google Application Default Credentials (ADC)'),
  handler: async () => {
    await handleGoogleAdcAuth();
  },
};

export const authCommand: CommandModule = {
  command: 'auth',
  describe: t('Configure a custom API provider'),
  builder: (yargs: Argv) =>
    yargs
      .command(apiKeyCommand)
      .command(statusCommand)
      .command(googleAdcCommand)
      .demandCommand(0) // Don't require a subcommand
      .version(false),
  handler: async () => {
    await handleApiKeyAuth();
  },
};
