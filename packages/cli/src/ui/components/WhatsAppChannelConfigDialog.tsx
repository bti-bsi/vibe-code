/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { TextInput } from './shared/TextInput.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { SettingScope } from '../../config/settings.js';
import { t } from '../../i18n/index.js';
import { WHATSAPP_SERVER_URL } from '../../services/whatsappServer.js';

interface WhatsAppChannelConfigDialogProps {
  onClose: () => void;
}

export function WhatsAppChannelConfigDialog({
  onClose,
}: WhatsAppChannelConfigDialogProps): React.JSX.Element {
  const settings = useSettings();
  const allowedNumbers = ((settings.merged as any).whatsapp_allowed ||
    []) as string[];

  const [phoneInput, setPhoneInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  const addNumber = useCallback(() => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;

    if (allowedNumbers.includes(trimmed)) {
      setErrorMessage(t('Number already added.'));
      return;
    }

    settings.setValue(SettingScope.User, 'whatsapp_allowed', [
      ...allowedNumbers,
      trimmed,
    ]);
    setPhoneInput('');
    setErrorMessage(null);
  }, [phoneInput, allowedNumbers, settings]);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('WhatsApp Channel Configuration')}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>{t('Server URL:')}</Text>
        <Text color={theme.text.accent}>{WHATSAPP_SERVER_URL}</Text>
        <Text color={theme.text.secondary}>
          {t('Open this URL in your browser to pair your WhatsApp account.')}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>{t('Allowed Phone Numbers:')}</Text>
        {allowedNumbers.length === 0 ? (
          <Text color={theme.text.secondary}>{t('(No numbers added)')}</Text>
        ) : (
          allowedNumbers.map((num) => (
            <Box key={num}>
              <Text>• {num} </Text>
              <Text color={theme.text.secondary}>
                (Press Enter to save to add, Ctrl+D to manage in settings)
              </Text>
            </Box>
          ))
        )}
        <Box marginTop={1}>
          <TextInput
            value={phoneInput}
            onChange={setPhoneInput}
            onSubmit={addNumber}
            placeholder={t(
              'Enter phone number (e.g., 62812...) and press Enter',
            )}
          />
        </Box>
      </Box>

      {errorMessage && (
        <Box marginTop={1} paddingX={1}>
          <Text color={theme.status.error}>✕ {errorMessage}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>{t('Esc to close')}</Text>
      </Box>
    </Box>
  );
}
