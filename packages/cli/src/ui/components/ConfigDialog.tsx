/**
 * @license
 * Copyright 2025 Vibe
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface ConfigDialogProps {
  /** Callback function when a config item is selected */
  onSelect: (value: string | undefined) => void;
  /** Available terminal height for layout calculations */
  availableTerminalHeight?: number;
}

export function ConfigDialog({
  onSelect,
  availableTerminalHeight: _availableTerminalHeight,
}: ConfigDialogProps): React.JSX.Element {
  // Generate config items
  const configItems = [
    { label: t('Scopus API'), value: 'scopus', key: 'scopus' },
    { label: t('Serper API'), value: 'serper', key: 'serper' },
    { label: t('Telegram Channel'), value: 'telegram', key: 'telegram' },
    { label: t('Whatsapp Channel'), value: 'whatsapp', key: 'whatsapp' },
  ];

  const handleConfigSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect],
  );

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onSelect(undefined);
      }
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Box flexDirection="column" flexGrow={1}>
        <Text bold wrap="truncate">
          {'> '}
          {t('Configuration Menu')}
        </Text>
        <Box height={1} />
        <RadioButtonSelect
          items={configItems}
          initialIndex={0}
          onSelect={handleConfigSelect}
          isFocused={true}
          maxItemsToShow={10}
          showScrollArrows={false}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary} wrap="truncate">
          {t(
            '(Use arrow keys or numbers to select, Enter to confirm, Esc to exit)',
          )}
        </Text>
      </Box>
    </Box>
  );
}
