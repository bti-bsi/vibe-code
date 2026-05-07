/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import process from 'node:process';
import { useCallback, useContext, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import {
  AuthType,
  type ModelProvidersConfig,
  type ProviderModelConfig,
} from '@vibe-bti/vibe-code-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import { UIStateContext } from '../contexts/UIStateContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import { backupSettingsFile } from '../../utils/settingsUtils.js';
import { t } from '../../i18n/index.js';

type CustomModelAuthType =
  | AuthType.USE_OPENAI
  | AuthType.USE_ANTHROPIC
  | AuthType.USE_GEMINI;

type DialogMode = 'select-model' | 'confirm-remove';

interface RemoveModelDialogProps {
  onClose: () => void;
}

interface RemovableModelEntry {
  authType: CustomModelAuthType;
  config: ProviderModelConfig;
  envValue: string;
  key: string;
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return `(${t('not set')})`;
  if (trimmed.length <= 6) return '***';
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function getRemovableEntries(
  modelProviders: ModelProvidersConfig | undefined,
  mergedEnv: Record<string, unknown> | undefined,
): RemovableModelEntry[] {
  const authTypes: CustomModelAuthType[] = [
    AuthType.USE_OPENAI,
    AuthType.USE_ANTHROPIC,
    AuthType.USE_GEMINI,
  ];
  const entries: RemovableModelEntry[] = [];

  for (const authType of authTypes) {
    for (const [index, config] of (modelProviders?.[authType] ?? []).entries()) {
      const envValue =
        typeof config.envKey === 'string' &&
        typeof mergedEnv?.[config.envKey] === 'string'
          ? (mergedEnv[config.envKey] as string)
          : '';
      entries.push({
        authType,
        config,
        envValue,
        key: `${authType}::${config.id}::${config.envKey ?? ''}::${index}`,
      });
    }
  }

  return entries;
}

function isSameModelEntry(
  left: ProviderModelConfig,
  right: ProviderModelConfig,
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.baseUrl === right.baseUrl &&
    left.envKey === right.envKey
  );
}

function hasEnvKeyReference(
  modelProviders: ModelProvidersConfig,
  envKey: string,
): boolean {
  for (const configs of Object.values(modelProviders)) {
    for (const config of configs ?? []) {
      if (config.envKey === envKey) {
        return true;
      }
    }
  }
  return false;
}

export function RemoveModelDialog({
  onClose,
}: RemoveModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const uiState = useContext(UIStateContext);
  const settings = useSettings();

  const [dialogMode, setDialogMode] = useState<DialogMode>('select-model');
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const removableEntries = useMemo(
    () =>
      getRemovableEntries(
        settings.merged.modelProviders as ModelProvidersConfig | undefined,
        settings.merged.env as Record<string, unknown> | undefined,
      ),
    [settings.merged.env, settings.merged.modelProviders],
  );

  const selectedEntry = useMemo(
    () =>
      removableEntries.find((entry) => entry.key === selectedEntryKey) ?? null,
    [removableEntries, selectedEntryKey],
  );

  const resetState = useCallback(() => {
    setDialogMode('select-model');
    setSelectedEntryKey(null);
    setErrorMessage(null);
  }, []);

  useKeypress(
    (key) => {
      if (key.name !== 'escape') {
        return;
      }
      if (dialogMode === 'select-model') {
        onClose();
        return;
      }
      setErrorMessage(null);
      setDialogMode('select-model');
    },
    { isActive: true },
  );

  const removeSelectedModel = useCallback(async () => {
    if (!config || !selectedEntry) {
      return;
    }

    const persistScope = getPersistScopeForModelSelection(settings);
    const previousModelProviders = settings.merged
      .modelProviders as ModelProvidersConfig | undefined;
    const previousCurrentAuthType = config.getContentGeneratorConfig()?.authType;
    const previousCurrentModelId = config.getModel();
    const previousEnvKey = selectedEntry.config.envKey;
    const previousEnvValue =
      previousEnvKey && typeof process.env[previousEnvKey] === 'string'
        ? process.env[previousEnvKey]
        : undefined;

    const updatedProviderEntries = (
      previousModelProviders?.[selectedEntry.authType] ?? []
    ).filter((entry) => !isSameModelEntry(entry, selectedEntry.config));

    const nextModelProviders: ModelProvidersConfig = {
      ...(previousModelProviders ?? {}),
      [selectedEntry.authType]: updatedProviderEntries,
    };

    const fallbackEntry =
      removableEntries.find(
        (entry) =>
          entry.key !== selectedEntry.key &&
          entry.authType === selectedEntry.authType,
      ) ??
      removableEntries.find((entry) => entry.key !== selectedEntry.key) ??
      null;

    const removedActiveModel =
      previousCurrentAuthType === selectedEntry.authType &&
      previousCurrentModelId === selectedEntry.config.id;

    const shouldRemoveEnvKey =
      typeof previousEnvKey === 'string' &&
      previousEnvKey.length > 0 &&
      !hasEnvKeyReference(nextModelProviders, previousEnvKey);

    config.reloadModelProvidersConfig(nextModelProviders);
    if (shouldRemoveEnvKey && previousEnvKey) {
      delete process.env[previousEnvKey];
    }

    try {
      const settingsFile = settings.forScope(persistScope);
      backupSettingsFile(settingsFile.path);

      if (shouldRemoveEnvKey && previousEnvKey) {
        settings.setValue(persistScope, `env.${previousEnvKey}`, undefined);
      }
      settings.setValue(
        persistScope,
        `modelProviders.${selectedEntry.authType}`,
        updatedProviderEntries,
      );

      if (removedActiveModel && fallbackEntry) {
        await config.switchModel(fallbackEntry.authType, fallbackEntry.config.id);
        settings.setValue(
          persistScope,
          'security.auth.selectedType',
          fallbackEntry.authType,
        );
        settings.setValue(persistScope, 'model.name', fallbackEntry.config.id);
      } else if (removedActiveModel) {
        settings.setValue(persistScope, 'model.name', undefined);
      }

      uiState?.historyManager.addItem(
        {
          type: 'success',
          text:
            fallbackEntry && removedActiveModel
              ? t(
                  'Model "{{modelId}}" removed from settings.json. Switched to "{{fallbackModelId}}".',
                  {
                    modelId: selectedEntry.config.id,
                    fallbackModelId: fallbackEntry.config.id,
                  },
                )
              : t('Model "{{modelId}}" removed from settings.json.', {
                  modelId: selectedEntry.config.id,
                }),
        },
        Date.now(),
      );

      resetState();
      onClose();
    } catch (error) {
      config.reloadModelProvidersConfig(previousModelProviders);
      if (previousEnvKey && previousEnvValue !== undefined) {
        process.env[previousEnvKey] = previousEnvValue;
      }
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }, [config, onClose, removableEntries, resetState, selectedEntry, settings, uiState]);

  const selectItems = useMemo(
    () =>
      removableEntries.map((entry) => ({
        key: entry.key,
        value: entry.key,
        title: (
          <Text>
            <Text color={theme.text.accent}>[{entry.authType}]</Text>
            <Text>{` ${entry.config.name ?? entry.config.id}`}</Text>
          </Text>
        ),
        description: `${entry.config.id} · ${entry.config.baseUrl ?? t('(default)')} · ${maskApiKey(entry.envValue)}`,
      })),
    [removableEntries],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Remove Model')}</Text>

      {dialogMode === 'select-model' ? (
        removableEntries.length === 0 ? (
          <Box marginTop={1} flexDirection="column">
            <Text color={theme.status.warning}>
              {t(
                'No removable model configurations were found in settings.json.',
              )}
            </Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              items={selectItems}
              onSelect={(value) => {
                setSelectedEntryKey(value);
                setErrorMessage(null);
                setDialogMode('confirm-remove');
              }}
              showNumbers={true}
            />
          </Box>
        )
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.text.secondary}>
            {t('Delete model "{{modelName}}" from settings.json?', {
              modelName:
                selectedEntry?.config.name ?? selectedEntry?.config.id ?? '',
            })}
          </Text>
          <Box marginTop={1}>
            <DescriptiveRadioButtonSelect
              key={`confirm-remove-${selectedEntry?.key ?? 'none'}`}
              items={[
                {
                  key: 'confirm',
                  value: 'confirm',
                  title: t('Yes'),
                  description: t('Remove this model configuration now'),
                },
                {
                  key: 'cancel',
                  value: 'cancel',
                  title: t('Cancel'),
                  description: t('Go back without deleting anything'),
                },
              ]}
              onSelect={async (value) => {
                if (value === 'confirm') {
                  await removeSelectedModel();
                  return;
                }
                setDialogMode('select-model');
              }}
            />
          </Box>
        </Box>
      )}

      {errorMessage && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{errorMessage}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {dialogMode === 'select-model'
            ? t('Select a saved model to remove. Press Esc to close.')
            : t('Choose Yes to delete or Cancel to go back. Press Esc to return.')}
        </Text>
      </Box>
    </Box>
  );
}
