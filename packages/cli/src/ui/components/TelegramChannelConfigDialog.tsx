/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { TextInput } from './shared/TextInput.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { SettingScope } from '../../config/settings.js';
import { t } from '../../i18n/index.js';
import process from 'node:process';

interface TelegramChannelConfigDialogProps {
  /** Callback to close the dialog */
  onClose: () => void;
}

type DialogMode =
  | 'edit-token'
  | 'edit-allowed-users'
  | 'edit-cwd'
  | 'edit-instructions'
  | 'edit-channel-id';

/**
 * Dialog for configuring a Telegram channel.
 */
export function TelegramChannelConfigDialog({
  onClose,
}: TelegramChannelConfigDialogProps): React.JSX.Element {
  const settings = useSettings();

  const [dialogMode, setDialogMode] = useState<DialogMode>('edit-token');
  const [token, setToken] = useState('');
  const [allowedUsers, setAllowedUsers] = useState('');
  const [cwd, setCwd] = useState(process.cwd());
  const [instructions, setInstructions] = useState(
    'You are a concise coding assistant responding via Telegram. Keep responses short.',
  );
  const [channelId, setChannelId] = useState('my-telegram');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        if (dialogMode === 'edit-token') {
          onClose();
        } else {
          // Go back to previous step
          setErrorMessage(null);
          switch (dialogMode) {
            case 'edit-allowed-users':
              setDialogMode('edit-token');
              break;
            case 'edit-cwd':
              setDialogMode('edit-allowed-users');
              break;
            case 'edit-instructions':
              setDialogMode('edit-cwd');
              break;
            case 'edit-channel-id':
              setDialogMode('edit-instructions');
              break;
          }
        }
      }
    },
    { isActive: true },
  );

  const saveConfig = useCallback(() => {
    const trimmedToken = token.trim();
    const trimmedChannelId = channelId.trim();

    if (!trimmedToken) {
      setErrorMessage(t('Bot token cannot be empty.'));
      setDialogMode('edit-token');
      return;
    }
    if (!trimmedChannelId) {
      setErrorMessage(t('Channel ID cannot be empty.'));
      setDialogMode('edit-channel-id');
      return;
    }

    const config = {
      type: 'telegram',
      token: trimmedToken,
      senderPolicy: 'allowlist',
      allowedUsers: allowedUsers
        .split(',')
        .map((u) => u.trim())
        .filter((u) => u !== ''),
      sessionScope: 'user',
      cwd: cwd.trim(),
      instructions: instructions.trim(),
      groupPolicy: 'disabled',
      groups: {
        '*': { requireMention: true },
      },
    };

    settings.setValue(
      SettingScope.User,
      `channels.${trimmedChannelId}`,
      config,
    );
    onClose();
  }, [token, allowedUsers, cwd, instructions, channelId, settings, onClose]);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Telegram Channel Configuration')}</Text>

      {dialogMode === 'edit-token' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('1. Telegram Bot Token')}</Text>
          <Box marginTop={1}>
            <TextInput
              value={token}
              onChange={setToken}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-allowed-users');
              }}
              placeholder={t('Enter bot token from @BotFather')}
            />
          </Box>
        </Box>
      )}

      {dialogMode === 'edit-allowed-users' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('2. Allowed User List (comma separated)')}
          </Text>
          <Box marginTop={1}>
            <TextInput
              value={allowedUsers}
              onChange={setAllowedUsers}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-cwd');
              }}
              placeholder={t('Enter numeric user IDs, e.g. 1234567, 8901234')}
            />
          </Box>
        </Box>
      )}

      {dialogMode === 'edit-cwd' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('3. Project Directory')}</Text>
          <Box marginTop={1}>
            <TextInput
              value={cwd}
              onChange={setCwd}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-instructions');
              }}
              placeholder={t('Path to your project')}
            />
          </Box>
        </Box>
      )}

      {dialogMode === 'edit-instructions' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('4. Model Instructions')}</Text>
          <Box marginTop={1}>
            <TextInput
              value={instructions}
              onChange={setInstructions}
              onSubmit={() => {
                setErrorMessage(null);
                setDialogMode('edit-channel-id');
              }}
              placeholder={t('Enter model instructions')}
              height={3}
            />
          </Box>
        </Box>
      )}

      {dialogMode === 'edit-channel-id' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>{t('5. ID Channel')}</Text>
          <Box marginTop={1}>
            <TextInput
              value={channelId}
              onChange={setChannelId}
              onSubmit={saveConfig}
              placeholder={t('my-telegram')}
            />
          </Box>
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.status.error}>✕ {errorMessage}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to continue, Esc to go back/close')}
        </Text>
      </Box>
    </Box>
  );
}
